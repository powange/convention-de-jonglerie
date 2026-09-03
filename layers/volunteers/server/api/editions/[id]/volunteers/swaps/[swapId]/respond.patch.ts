import { z } from 'zod'

import {
  demandeExpiree,
  echangePossiblePourLaCible,
  type AffectationCandidate,
} from '../../../../../../utils/echange-creneaux'


import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { NotificationHelpers, safeNotify } from '#server/utils/notification-service'
import { validateEditionId } from '#server/utils/validation-helpers'

const bodySchema = z.object({ accept: z.boolean() })

/**
 * PATCH .../swaps/:swapId/respond — le bénévole visé accepte ou refuse.
 *
 * Son accord ne déclenche rien sur le planning : il fait passer la demande en attente d'un
 * organisateur. Un arrangement entre deux personnes peut dégarnir un poste que ni l'une ni
 * l'autre ne voit.
 */
export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)
  const swapId = String(getRouterParam(event, 'swapId') || '')
  if (!swapId) throw createError({ status: 400, message: 'Demande invalide' })

  const { accept } = bodySchema.parse(await readBody(event))

  const creneau = {
    select: { id: true, startDateTime: true, endDateTime: true, teamId: true, eventId: true },
  }
  const demande = await prisma.volunteerSwapRequest.findFirst({
    where: { id: swapId, eventId: editionId },
    select: {
      id: true,
      status: true,
      targetId: true,
      requesterId: true,
      requester: { select: { id: true, pseudo: true } },
      requesterAssignment: { select: { id: true, userId: true, timeSlot: creneau } },
      targetAssignment: { select: { id: true, userId: true, timeSlot: creneau } },
    },
  })

  if (!demande) throw createError({ status: 404, message: 'Demande introuvable' })
  if (demande.targetId !== user.id) {
    throw createError({ status: 403, message: 'Cette demande ne vous est pas adressée' })
  }
  if (demande.status !== 'PENDING_PEER') {
    throw createError({ status: 409, message: 'Cette demande a déjà été traitée' })
  }

  // Contrôlé ici et pas seulement par la tâche planifiée : entre deux passages de celle-ci, une
  // demande périmée pourrait être acceptée.
  if (demandeExpiree(demande.requesterAssignment.timeSlot, demande.targetAssignment.timeSlot)) {
    await prisma.volunteerSwapRequest.update({
      where: { id: demande.id },
      data: { status: 'EXPIRED' },
    })
    throw createError({ status: 409, message: 'L’un des deux créneaux est passé' })
  }

  if (!accept) {
    await prisma.volunteerSwapRequest.update({
      where: { id: demande.id },
      data: { status: 'REFUSED', peerRespondedAt: new Date() },
    })
    await prevenir(demande.requesterId, 'REFUSED')
    return createSuccessResponse({ status: 'REFUSED' })
  }

  // Le chevauchement se rejuge au moment de répondre : depuis la proposition, la cible a pu
  // recevoir une autre affectation.
  const siennes = await prisma.volunteerAssignment.findMany({
    where: { userId: user.id, timeSlot: { eventId: editionId } },
    select: { id: true, userId: true, timeSlot: creneau },
  })
  const possible = echangePossiblePourLaCible(
    user.id,
    demande.targetAssignment.id,
    demande.requesterAssignment.timeSlot,
    siennes as unknown as AffectationCandidate[]
  )
  if (!possible) {
    throw createError({
      status: 409,
      message: 'Ce créneau chevaucherait désormais l’un des vôtres',
    })
  }

  await prisma.volunteerSwapRequest.update({
    where: { id: demande.id },
    data: { status: 'PENDING_MANAGER', peerRespondedAt: new Date() },
  })

  // Le demandeur sait que son pair a dit oui ; les organisateurs qui gèrent les bénévoles sont
  // sollicités maintenant, et pas avant : une demande refusée entre bénévoles ne les atteint pas.
  await prevenir(demande.requesterId, 'PEER_ACCEPTED')
  await prevenirLesResponsables()

  return createSuccessResponse({ status: 'PENDING_MANAGER' })

  async function prevenir(destinataire: number, kind: 'REFUSED' | 'PEER_ACCEPTED') {
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { name: true, convention: { select: { name: true } } },
    })
    await safeNotify(
      () =>
        NotificationHelpers.volunteerSwap(destinataire, kind, {
          editionId,
          editionName: edition?.name || edition?.convention.name || `Édition #${editionId}`,
          swapId: demande!.id,
          otherName: user.pseudo,
        }),
      'volunteer swap response'
    )
  }

  /**
   * Les organisateurs habilités à gérer les bénévoles de cette édition.
   *
   * Le droit se porte soit sur la convention entière, soit par édition : les deux sources sont
   * réunies, et un même compte présent dans les deux n'est prévenu qu'une fois.
   */
  async function prevenirLesResponsables() {
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: {
        name: true,
        conventionId: true,
        convention: { select: { name: true } },
      },
    })
    if (!edition) return

    const [surLaConvention, surLEdition] = await Promise.all([
      prisma.conventionOrganizer.findMany({
        where: { conventionId: edition.conventionId, canManageVolunteers: true },
        select: { userId: true },
      }),
      prisma.editionOrganizerPermission.findMany({
        where: { editionId, canManageVolunteers: true },
        select: { organizer: { select: { userId: true } } },
      }),
    ])

    const destinataires = new Set<number>(surLaConvention.map((o) => o.userId))
    for (const p of surLEdition) if (p.organizer) destinataires.add(p.organizer.userId)

    for (const destinataire of destinataires) {
      await safeNotify(
        () =>
          NotificationHelpers.volunteerSwap(destinataire, 'PEER_ACCEPTED', {
            editionId,
            editionName: edition.name || edition.convention.name || `Édition #${editionId}`,
            swapId: demande!.id,
            otherName: user.pseudo,
          }),
        'volunteer swap awaiting decision'
      )
    }
  }
}, 'RespondToVolunteerSwapRequest')
