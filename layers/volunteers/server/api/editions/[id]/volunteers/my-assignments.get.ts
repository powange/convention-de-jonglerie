import { exigerPlanningPublie } from '../../../../utils/planning-publie'
import { selectionCreneauLisible } from '../../../../utils/selection-creneau-lisible'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET .../volunteers/my-assignments — les créneaux que je tiens sur cette édition.
 *
 * Sert à choisir celui qu'on cède dans un échange. Les créneaux passés sont écartés : on
 * n'échange pas un service déjà rendu.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Refus franc plutôt que liste vide : cet endpoint sert à choisir le créneau qu'on cède dans
    // un échange. Rendre une liste vide ferait croire qu'on n'a aucun créneau échangeable, alors
    // que la vraie raison est que le planning n'est pas publié — et les échanges sont fermés tant
    // qu'il ne l'est pas.
    await exigerPlanningPublie(editionId, false)

    const assignments = await prisma.volunteerAssignment.findMany({
      where: {
        userId: user.id,
        timeSlot: { eventId: editionId, endDateTime: { gt: new Date() } },
      },
      select: {
        id: true,
        timeSlot: {
          select: {
            ...selectionCreneauLisible,
            // L'occupation se compte sur les affectations réelles, comme partout dans le dépôt.
            maxVolunteers: true,
            _count: { select: { assignments: true } },
          },
        },
      },
      orderBy: { timeSlot: { startDateTime: 'asc' } },
    })

    return createSuccessResponse({ assignments })
  },
  { operationName: 'ListMyVolunteerAssignments' }
)
