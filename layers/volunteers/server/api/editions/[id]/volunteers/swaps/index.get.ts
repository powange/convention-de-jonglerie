import { exigerEchangesOuverts } from '../../../../../utils/echanges-ouverts'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { userWithProfileAndGravatarSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET .../volunteers/swaps — mes demandes, envoyées et reçues.
 *
 * Les deux sens dans une seule réponse : un bénévole pense en « mes échanges », pas en deux
 * listes distinctes, et la page les affiche côte à côte.
 */
export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)
  await exigerEchangesOuverts(editionId)

  const affectation = {
    select: {
      id: true,
      user: { select: userWithProfileAndGravatarSelect },
      timeSlot: {
        select: {
          id: true,
          title: true,
          startDateTime: true,
          endDateTime: true,
          team: { select: { id: true, name: true, color: true } },
        },
      },
    },
  }

  const demandes = await prisma.volunteerSwapRequest.findMany({
    where: { eventId: editionId, OR: [{ requesterId: user.id }, { targetId: user.id }] },
    select: {
      id: true,
      status: true,
      createdAt: true,
      requesterId: true,
      targetId: true,
      requester: { select: userWithProfileAndGravatarSelect },
      target: { select: userWithProfileAndGravatarSelect },
      requesterAssignment: affectation,
      targetAssignment: affectation,
    },
    orderBy: { createdAt: 'desc' },
  })

  return createSuccessResponse({
    sent: demandes.filter((d) => d.requesterId === user.id),
    received: demandes.filter((d) => d.targetId === user.id),
  })
}, 'ListMyVolunteerSwapRequests')
