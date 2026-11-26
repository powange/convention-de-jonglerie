import { z } from 'zod'

import { createPendingUserAndInvite } from '../../../../utils/invitation'
import { NotificationService } from '../../../../utils/notification-service'
import {
  droitsEnBase,
  schemaDroits,
  exigerGestionDesOrganisateurs,
} from '../../../../utils/organisateurs-evenement'
import { verifierAjout } from '../../../../utils/quotas'

import { sanitizeEmail } from '#server/utils/validation-helpers'

/**
 * Ajoute un organisateur à l'événement (décision de l'utilisateur : compte existant OU invitation).
 *
 * - `identifiant` = adresse e-mail ou pseudo d'un compte existant → ajouté, et prévenu par une
 *   notification interne ;
 * - adresse e-mail sans compte → `prenom` et `nom` requis : un compte en attente est créé, et le
 *   lien d'activation est RENDU, à transmettre soi-même (Flowvent n'envoie pas de courriel).
 */
const schema = z.object({
  identifiant: z.string().trim().min(1, 'Indiquez une adresse e-mail ou un pseudo').max(191),
  prenom: z.string().trim().max(100).optional(),
  nom: z.string().trim().max(100).optional(),
  droits: schemaDroits,
})

export default defineEventHandler(async (event) => {
  const { eventId, userId } = await exigerGestionDesOrganisateurs(event)
  const resultat = schema.safeParse(await readBody(event))
  if (!resultat.success) {
    throw createError({
      status: 400,
      message: resultat.error.issues[0]?.message ?? 'Données invalides',
    })
  }
  const { identifiant, prenom, nom, droits } = resultat.data
  const estUneAdresse = identifiant.includes('@')

  // Le plafond de co-organisateurs de la formule du propriétaire (invitations en attente comprises),
  // vérifié AVANT de créer un compte invité qui resterait orphelin.
  await verifierAjout(eventId, 'organisateurs', { userId })

  const evenement = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    select: { name: true, publicId: true, ownerId: true },
  })

  let compte = await prisma.user.findFirst({
    where: estUneAdresse ? { email: sanitizeEmail(identifiant) } : { pseudo: identifiant },
    select: { id: true },
  })

  let lienInvitation: string | null = null
  if (!compte) {
    if (!estUneAdresse) {
      throw createError({ status: 404, message: 'Aucun compte avec ce pseudo' })
    }
    if (!prenom || !nom) {
      // Le client affiche alors les champs prénom et nom, pour inviter.
      throw createError({
        status: 404,
        message: 'Aucun compte avec cette adresse : indiquez un prénom et un nom pour inviter',
        data: { inviter: true },
      })
    }
    const invite = await createPendingUserAndInvite({
      email: identifiant,
      prenom,
      nom,
      role: 'organizer',
      eventName: evenement.name,
      event,
    })
    compte = { id: invite.user.id }
    lienInvitation = invite.lien
  }

  if (compte.id === evenement.ownerId) {
    throw createError({ status: 409, message: 'Le propriétaire a déjà tous les droits' })
  }
  const deja = await prisma.editionOrganizer.findFirst({
    where: { editionId: eventId, organizer: { userId: compte.id } },
    select: { id: true },
  })
  if (deja) throw createError({ status: 409, message: 'Déjà organisateur de cet événement' })

  const fiche =
    (await prisma.organizer.findFirst({ where: { userId: compte.id }, select: { id: true } })) ??
    (await prisma.organizer.create({ data: { userId: compte.id }, select: { id: true } }))
  const ligne = await prisma.editionOrganizer.create({
    data: { editionId: eventId, organizerId: fiche.id, ...droitsEnBase(droits) },
    select: { id: true },
  })

  // Une notification n'a de sens que pour un compte qui se connecte déjà.
  if (!lienInvitation) {
    const auteur = await prisma.user.findUnique({ where: { id: userId }, select: { pseudo: true } })
    await NotificationService.create({
      userId: compte.id,
      type: 'INFO',
      category: 'organizer',
      entityType: 'Event',
      entityId: String(eventId),
      titleText: `Vous êtes organisateur de « ${evenement.name} »`,
      messageText: `${auteur?.pseudo ?? 'Un organisateur'} vous a ajouté à l'équipe d'organisation.`,
      actionText: "Voir l'événement",
      actionUrl: `/events/${evenement.publicId}`,
    }).catch((e) => console.error('[organisateurs] notification non créée :', e))
  }

  return createSuccessResponse({ id: ligne.id, lienInvitation }, 'Organisateur ajouté')
})
