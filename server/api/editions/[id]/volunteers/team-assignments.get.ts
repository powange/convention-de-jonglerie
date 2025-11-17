import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { validateEditionId } from '@@/server/utils/validation-helpers'

/**
 * Route dédiée pour récupérer tous les bénévoles acceptés avec leurs assignations d'équipes
 * Cette route n'est pas paginée car elle est utilisée pour afficher la répartition par équipes
 */
export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)

  const allowed = await canAccessEditionData(editionId, user.id, event)

  // Si l'utilisateur n'a pas accès complet, vérifier s'il est team leader
  let isTeamLeader = false
  let leaderTeamIds: string[] = []

  if (!allowed) {
    // Vérifier si l'utilisateur est team leader
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
        teamId: true,
      },
    })

    if (leaderAssignments.length === 0) {
      throw createError({
        statusCode: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })
    }

    isTeamLeader = true
    leaderTeamIds = leaderAssignments.map((a) => a.teamId)
  }

  // Récupérer tous les bénévoles acceptés avec leurs équipes
  const applications = await prisma.editionVolunteerApplication.findMany({
    where: {
      editionId,
      status: 'ACCEPTED',
      // Si team leader, filtrer uniquement les bénévoles de ses équipes
      ...(isTeamLeader && {
        teamAssignments: {
          some: {
            teamId: {
              in: leaderTeamIds,
            },
          },
        },
      }),
    },
    select: {
      id: true,
      userId: true,
      teamPreferences: true,
      user: {
        select: {
          id: true,
          pseudo: true,
          email: true,
          emailHash: true,
          prenom: true,
          nom: true,
          profilePicture: true,
        },
      },
      teamAssignments: {
        select: {
          teamId: true,
          isLeader: true,
          assignedAt: true,
          team: {
            select: {
              id: true,
              name: true,
              description: true,
              color: true,
              maxVolunteers: true,
            },
          },
        },
        orderBy: {
          assignedAt: 'asc',
        },
      },
    },
    orderBy: [{ user: { prenom: 'asc' } }, { user: { nom: 'asc' } }],
  })

  return applications
}, 'GetVolunteerTeamAssignments')
