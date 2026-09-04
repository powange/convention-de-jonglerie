import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET .../volunteers/my-assignments — les créneaux que je tiens sur cette édition.
 *
 * Sert à choisir celui qu'on cède dans un échange. Les créneaux passés sont écartés : on
 * n'échange pas un service déjà rendu.
 */
export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)

  const assignments = await prisma.volunteerAssignment.findMany({
    where: {
      userId: user.id,
      timeSlot: { eventId: editionId, endDateTime: { gt: new Date() } },
    },
    select: {
      id: true,
      timeSlot: {
        select: {
          id: true,
          title: true,
          startDateTime: true,
          endDateTime: true,
          // L'occupation se compte sur les affectations réelles, comme partout dans le dépôt.
          maxVolunteers: true,
          _count: { select: { assignments: true } },
          team: { select: { id: true, name: true, color: true } },
        },
      },
    },
    orderBy: { timeSlot: { startDateTime: 'asc' } },
  })

  return createSuccessResponse({ assignments })
}, 'ListMyVolunteerAssignments')
