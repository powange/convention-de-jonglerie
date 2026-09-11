import { filtreDesEquipesVisibles, VUE_DE_CANDIDATURE } from '../../../../utils/visibilite-equipes'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { optionalAuth } from '#server/utils/auth-utils'
import { isAcceptedVolunteer } from '#server/utils/permissions/volunteer-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

export default wrapApiHandler(
  async (event) => {
    // Validation des paramètres
    const editionId = validateEditionId(event)

    // Vérifier le paramètre leaderOnly
    const query = getQuery(event)
    const leaderOnly = query.leaderOnly === 'true'

    // Étape 0bis : vérif d'existence sur l'Event (id == eventId), sans dépendre d'Edition.
    const eventRecord = await prisma.event.findUnique({
      where: { id: editionId },
      select: { id: true },
    })

    if (!eventRecord) {
      throw createError({
        status: 404,
        message: 'Édition non trouvée',
      })
    }

    // Si leaderOnly, l'utilisateur doit être connecté et on filtre par ses équipes
    if (leaderOnly) {
      const user = optionalAuth(event)

      if (!user) {
        throw createError({
          status: 401,
          message: 'Authentification requise',
        })
      }

      // Récupérer uniquement les équipes dont l'utilisateur est leader
      const leaderAssignments = await prisma.applicationTeamAssignment.findMany({
        where: {
          isLeader: true,
          application: {
            userId: user.id,
            eventId: editionId,
            status: 'ACCEPTED',
          },
        },
        select: {
          team: {
            select: {
              id: true,
              name: true,
              description: true,
              color: true,
              maxVolunteers: true,
              isRequired: true,
              isAccessControlTeam: true,
              isVisibleToVolunteers: true,
              createdAt: true,
              updatedAt: true,
              _count: {
                select: {
                  timeSlots: true,
                },
              },
              assignedApplications: {
                where: {
                  application: {
                    status: 'ACCEPTED',
                  },
                },
                select: {
                  applicationId: true,
                },
              },
            },
          },
        },
      })

      // Extraire les équipes uniques et ajouter le nombre de bénévoles assignés
      const uniqueTeams = new Map()

      for (const assignment of leaderAssignments) {
        const team = assignment.team
        if (!uniqueTeams.has(team.id)) {
          uniqueTeams.set(team.id, {
            id: team.id,
            name: team.name,
            description: team.description,
            color: team.color,
            maxVolunteers: team.maxVolunteers,
            isRequired: team.isRequired,
            isAccessControlTeam: team.isAccessControlTeam,
            isVisibleToVolunteers: team.isVisibleToVolunteers,
            createdAt: team.createdAt,
            updatedAt: team.updatedAt,
            _count: team._count,
            assignedVolunteersCount: team.assignedApplications?.length || 0,
          })
        }
      }

      return Array.from(uniqueTeams.values())
    }

    // Récupérer les équipes de bénévoles pour cette édition.
    //
    // La lecture reste ouverte : le formulaire de candidature en dépend, et il est consulté avant
    // même d'avoir postulé. Mais « ouvert » ne veut pas dire « tout » — les équipes marquées
    // invisibles aux bénévoles sont écartées ici, et non dans le navigateur comme auparavant.
    const utilisateur = optionalAuth(event)

    // `pourCandidature` : le formulaire de candidature demande la liste telle qu'un candidat la
    // voit, même ouvert en aperçu par un organisateur. Le paramètre vient du client, mais il ne
    // peut que restreindre — il n'accorde jamais rien, et n'est donc pas une garde.
    const demandeur =
      utilisateur && query.pourCandidature !== 'true'
        ? {
            estGestionnaire: await useVolunteerPorts().organizers.canManage(
              editionId,
              utilisateur.id,
              event
            ),
            estBenevoleAccepte: await isAcceptedVolunteer(utilisateur.id, editionId),
          }
        : VUE_DE_CANDIDATURE

    const teams = await prisma.volunteerTeam.findMany({
      where: {
        eventId: editionId,
        ...filtreDesEquipesVisibles(demandeur),
      },
      orderBy: {
        name: 'asc',
      },
      include: {
        _count: {
          select: {
            timeSlots: true,
          },
        },
      },
    })

    return teams
  },
  { operationName: 'GetVolunteerTeams' }
)
