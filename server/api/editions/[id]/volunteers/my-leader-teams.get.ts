import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Récupère les équipes dont l'utilisateur connecté est responsable
 * Retourne uniquement les équipes où l'utilisateur a au moins une assignation avec isLeader=true
 */
export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)

  // Récupérer toutes les équipes dont l'utilisateur est leader
  const leaderAssignments = await prisma.applicationTeamAssignment.findMany({
    where: {
      isLeader: true,
      application: {
        userId: user.id,
        editionId,
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
              assignments: {
                where: {
                  application: {
                    status: 'ACCEPTED',
                  },
                },
              },
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
        ...team,
        assignedVolunteersCount: team._count?.assignments || 0,
      })
    }
  }

  return Array.from(uniqueTeams.values())
}, 'GetMyLeaderTeams')
