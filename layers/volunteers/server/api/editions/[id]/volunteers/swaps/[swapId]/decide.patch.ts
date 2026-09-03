import { z } from 'zod'

import { demandeExpiree } from '../../../../../../utils/echange-creneaux'
import {
  permutationPossible,
  permuterAffectations,
} from '../../../../../../utils/permuter-affectations'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { NotificationHelpers, safeNotify } from '#server/utils/notification-service'
import { requireVolunteerManagementAccess } from '#server/utils/permissions/volunteer-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

const bodySchema = z.object({ approve: z.boolean() })

/**
 * PATCH .../swaps/:swapId/decide — l'organisateur tranche, et le planning bouge.
 *
 * C'est le seul endroit où les affectations changent de titulaire. Les deux accords précédents
 * ne préparaient que le terrain.
 */
export default wrapApiHandler(async (event) => {
  const editionId = validateEditionId(event)
  const user = await requireVolunteerManagementAccess(event, editionId)

  const swapId = String(getRouterParam(event, 'swapId') || '')
  if (!swapId) throw createError({ status: 400, message: 'Demande invalide' })

  const { approve } = bodySchema.parse(await readBody(event))

  const affectation = {
    select: {
      id: true,
      userId: true,
      timeSlotId: true,
      timeSlot: { select: { id: true, startDateTime: true, endDateTime: true } },
    },
  }
  const demande = await prisma.volunteerSwapRequest.findFirst({
    where: { id: swapId, eventId: editionId },
    select: {
      id: true,
      status: true,
      requesterId: true,
      targetId: true,
      requesterAssignment: affectation,
      targetAssignment: affectation,
    },
  })

  if (!demande) throw createError({ status: 404, message: 'Demande introuvable' })
  if (demande.status !== 'PENDING_MANAGER') {
    throw createError({
      status: 409,
      message: 'Cette demande n’attend pas de décision',
    })
  }

  if (demandeExpiree(demande.requesterAssignment.timeSlot, demande.targetAssignment.timeSlot)) {
    await prisma.volunteerSwapRequest.update({
      where: { id: demande.id },
      data: { status: 'EXPIRED' },
    })
    throw createError({ status: 409, message: 'L’un des deux créneaux est passé' })
  }

  if (!approve) {
    await prisma.volunteerSwapRequest.update({
      where: { id: demande.id },
      data: { status: 'REFUSED', decidedById: user.id, decidedAt: new Date() },
    })
    await prevenirLesDeux('REFUSED')
    return createSuccessResponse({ status: 'REFUSED' })
  }

  // Sur un créneau à plusieurs places, l'un des deux peut déjà occuper celui qu'il recevrait.
  // La contrainte d'unicité le refuserait avec une erreur de base illisible.
  if (!(await permutationPossible(demande.requesterAssignment, demande.targetAssignment))) {
    throw createError({
      status: 409,
      message: 'L’un des deux bénévoles occupe déjà le créneau qu’il recevrait',
    })
  }

  await permuterAffectations(demande.requesterAssignment, demande.targetAssignment)

  await prisma.volunteerSwapRequest.update({
    where: { id: demande.id },
    data: { status: 'ACCEPTED', decidedById: user.id, decidedAt: new Date() },
  })

  await prevenirLesDeux('DECIDED')

  return createSuccessResponse({ status: 'ACCEPTED' })

  /** Les deux bénévoles apprennent la décision, quelle qu'elle soit. */
  async function prevenirLesDeux(kind: 'DECIDED' | 'REFUSED') {
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { name: true, convention: { select: { name: true } } },
    })
    const nom = edition?.name || edition?.convention.name || `Édition #${editionId}`

    for (const destinataire of [demande!.requesterId, demande!.targetId]) {
      await safeNotify(
        () =>
          NotificationHelpers.volunteerSwap(destinataire, kind, {
            editionId,
            editionName: nom,
            swapId: demande!.id,
            otherName: user.pseudo,
          }),
        'volunteer swap decided'
      )
    }
  }
}, 'DecideVolunteerSwapRequest')
