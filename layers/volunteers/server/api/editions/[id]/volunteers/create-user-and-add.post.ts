import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { createPendingUserAndInvite } from '#server/utils/invitation'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { generateVolunteerQrCodeToken } from '#server/utils/token-generator'
import { sanitizeEmail, validateEditionId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

const bodySchema = z.object({
  email: z.string().email(),
  prenom: z.string().min(1),
  nom: z.string().min(1),
})

export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)

  // Vérifier les permissions
  const allowed = await useVolunteerPorts().organizers.canManage(editionId, user.id, event)
  if (!allowed)
    throw createError({
      status: 403,
      message: 'Droits insuffisants pour gérer les bénévoles',
    })

  const body = bodySchema.parse(await readBody(event))
  const cleanEmail = sanitizeEmail(body.email)

  // L'email ne doit pas déjà exister (sinon → utiliser le flux "ajouter existant")
  const existingUser = await prisma.user.findUnique({
    where: { email: cleanEmail },
  })
  if (existingUser) {
    throw createError({
      status: 409,
      message:
        "Cet email est déjà utilisé. Veuillez rechercher l'utilisateur existant dans la liste.",
    })
  }

  // Nom d'affichage générique de l'événement (étape 0bis)
  const eventRecord = await fetchResourceOrFail(prisma.event, editionId, {
    errorMessage: 'Événement introuvable',
    select: { name: true },
  })

  // Créer le compte « en attente » + envoyer l'email d'invitation (lien d'activation).
  const { user: newUser } = await createPendingUserAndInvite({
    email: cleanEmail,
    prenom: body.prenom,
    nom: body.nom,
    role: 'volunteer',
    eventName: eventRecord.name || '',
    event,
  })

  // Générer un token unique pour la candidature
  let qrCodeToken = generateVolunteerQrCodeToken()
  let isUnique = false
  let attempts = 0
  const maxAttempts = 10

  while (!isUnique && attempts < maxAttempts) {
    const existingToken = await prisma.editionVolunteerApplication.findUnique({
      where: { qrCodeToken },
    })

    if (!existingToken) {
      isUnique = true
    } else {
      qrCodeToken = generateVolunteerQrCodeToken()
      attempts++
    }
  }

  if (!isUnique) {
    throw createError({
      status: 500,
      message: 'Impossible de générer un token unique',
    })
  }

  // Créer la candidature de bénévole avec le statut ACCEPTED
  const application = await prisma.editionVolunteerApplication.create({
    data: {
      eventId: editionId,
      userId: newUser.id,
      status: 'ACCEPTED',
      motivation: 'Ajouté manuellement par un organisateur',
      userSnapshotPhone: null,
      // Le régime vit sur le profil ; la colonne garde sa valeur par défaut.
      setupAvailability: null,
      teardownAvailability: null,
      eventAvailability: null,
      source: 'MANUAL',
      addedById: user.id,
      addedAt: new Date(),
      qrCodeToken,
    },
    select: {
      id: true,
      status: true,
    },
  })

  // Créer automatiquement les sélections de repas
  try {
    await useVolunteerPorts().meals.createVolunteerMealSelections(application.id, editionId)
  } catch (mealError) {
    console.error('Erreur lors de la création des repas du bénévole:', mealError)
    // Ne pas faire échouer l'ajout si la création des repas échoue
  }

  return createSuccessResponse({ user: newUser, application })
}, { operationName: 'CreateUserAndAddVolunteer' })
