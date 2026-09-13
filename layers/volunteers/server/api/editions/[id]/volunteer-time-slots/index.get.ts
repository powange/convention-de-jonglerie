import { exigerPlanningPublie } from '../../../../utils/planning-publie'

import { wrapApiHandler } from '#server/utils/api-helpers'
import {
  requireVolunteerPlanningAccess,
  isAcceptedVolunteer,
} from '#server/utils/permissions/volunteer-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    // Validation des paramètres
    const editionId = validateEditionId(event)

    // Vérifier l'accès au planning (bénévoles acceptés + gestionnaires)
    const user = await requireVolunteerPlanningAccess(event, editionId)

    // Vérifier si l'utilisateur est un bénévole accepté (pas un gestionnaire)
    const isVolunteer = await isAcceptedVolunteer(user.id, editionId)

    // C'est LA surface la plus large du réglage « planning publié » : cet endpoint rend tout le
    // planning de l'édition avec les affectations NOMINATIVES — pseudo, nom, prénom, courriel,
    // photo. Un responsable qui construit ses plannings ne veut pas que ce travail en cours soit
    // lisible, et surtout pas nommément.
    //
    // La garde vit ici et non dans `requireVolunteerPlanningAccess` : cette fonction-là est dans
    // `apps/app1`, et la dépendance de ce dépôt va des layers vers l'app, jamais l'inverse. L'y
    // mettre aurait demandé un import à contresens. Elle n'a aujourd'hui qu'un seul appelant —
    // celui-ci — donc le risque de l'oublier ailleurs est nul tant que ça reste vrai.
    await exigerPlanningPublie(editionId, !isVolunteer)

    // Récupérer les créneaux de bénévoles pour cette édition
    const timeSlots = await prisma.volunteerTimeSlot.findMany({
      where: {
        eventId: editionId,
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
                pronouns: true,
                email: true,
                emailHash: true,
                profilePicture: true,
                updatedAt: true,
              },
            },
          },
        },
        // Organisateurs affectés au créneau. Le `_count` ne porte que les bénévoles ; le
        // client additionne les deux pour connaître les places occupées.
        organizerAssignments: {
          select: {
            editionOrganizer: {
              select: {
                id: true,
                organizer: {
                  select: {
                    user: {
                      select: {
                        id: true,
                        pseudo: true,
                        nom: true,
                        prenom: true,
                        pronouns: true,
                        emailHash: true,
                        profilePicture: true,
                        updatedAt: true,
                      },
                    },
                  },
                },
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
          pronouns: assignment.user.pronouns,
          emailHash: assignment.user.emailHash,
          // Les gestionnaires ont aussi accès à l'email en clair
          ...(isVolunteer ? {} : { email: assignment.user.email }),
          profilePicture: assignment.user.profilePicture,
          updatedAt: assignment.user.updatedAt,
        },
      })),
      organizerAssignments: slot.organizerAssignments.map((affectation) => ({
        editionOrganizerId: affectation.editionOrganizer.id,
        user: affectation.editionOrganizer.organizer.user,
      })),
      color: slot.team?.color || '#6b7280',
      resourceId: slot.teamId || 'unassigned',
    }))

    return formattedTimeSlots
  },
  { operationName: 'GetVolunteerTimeSlots' }
)
