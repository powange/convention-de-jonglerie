import { exigerEchangesOuverts } from '../../../../../../utils/echanges-ouverts'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * DELETE .../swaps/:swapId — le demandeur retire sa demande.
 *
 * Marquée annulée plutôt que supprimée : la cible a pu recevoir la notification, et un
 * effacement pur lui laisserait une demande fantôme dont plus rien n'expliquerait la disparition.
 */
export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)
  await exigerEchangesOuverts(editionId)
  const swapId = String(getRouterParam(event, 'swapId') || '')

  const demande = await prisma.volunteerSwapRequest.findFirst({
    where: { id: swapId, eventId: editionId },
    select: { id: true, requesterId: true, status: true },
  })
  if (!demande) throw createError({ status: 404, message: 'Demande introuvable' })
  if (demande.requesterId !== user.id) {
    throw createError({ status: 403, message: 'Seul l’auteur peut retirer sa demande' })
  }
  if (!['PENDING_PEER', 'PENDING_MANAGER'].includes(demande.status)) {
    throw createError({ status: 409, message: 'Cette demande est déjà close' })
  }

  await prisma.volunteerSwapRequest.update({
    where: { id: demande.id },
    data: { status: 'CANCELLED' },
  })

  return createSuccessResponse({ status: 'CANCELLED' })
}, 'CancelVolunteerSwapRequest')
