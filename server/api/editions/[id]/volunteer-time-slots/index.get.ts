import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { getEmailHash } from '@@/server/utils/email-hash'
import {
  requireVolunteerPlanningAccess,
  isAcceptedVolunteer,
} from '@@/server/utils/permissions/volunteer-permissions'
import { prisma } from '@@/server/utils/prisma'
import { validateEditionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    // Validation des paramètres
    const editionId = validateEditionId(event)

    // Vérifier l'accès au planning (bénévoles acceptés + gestionnaires)
    const user = await requireVolunteerPlanningAccess(event, editionId)

    // Vérifier si l'utilisateur est un bénévole accepté (pas un gestionnaire)
    const isVolunteer = await isAcceptedVolunteer(user.id, editionId)

    // Récupérer les créneaux de bénévoles pour cette édition
    const timeSlots = await prisma.volunteerTimeSlot.findMany({
      where: {
        editionId,
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                nom: true,
                prenom: true,
                email: true,
                profilePicture: true,
                updatedAt: true,
              },
            },
          },
        },
        _count: {
          select: {
            assignments: true,
          },
        },
      },
      orderBy: {
        startDateTime: 'asc',
      },
    })

    // Transformer les données pour être compatibles avec FullCalendar
    const formattedTimeSlots = timeSlots.map((slot) => ({
      id: slot.id,
      title: slot.title,
      description: slot.description,
      start: slot.startDateTime.toISOString(),
      end: slot.endDateTime.toISOString(),
      teamId: slot.teamId,
      team: slot.team,
      maxVolunteers: slot.maxVolunteers,
      assignedVolunteers: slot._count.assignments,
      delayMinutes: slot.delayMinutes,
      assignments: slot.assignments.map((assignment) => ({
        ...assignment,
        user: {
          id: assignment.user.id,
          pseudo: assignment.user.pseudo,
          nom: assignment.user.nom,
          prenom: assignment.user.prenom,
          emailHash: getEmailHash(assignment.user.email),
          // Les gestionnaires ont aussi accès à l'email en clair
          ...(isVolunteer ? {} : { email: assignment.user.email }),
          profilePicture: assignment.user.profilePicture,
          updatedAt: assignment.user.updatedAt,
        },
      })),
      color: slot.team?.color || '#6b7280',
      resourceId: slot.teamId || 'unassigned',
    }))

    return formattedTimeSlots
  },
  { operationName: 'GetVolunteerTimeSlots' }
)
