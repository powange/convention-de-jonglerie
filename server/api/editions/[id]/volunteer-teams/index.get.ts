import { optionalAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  // Validation des paramètres
  const editionId = parseInt(getRouterParam(event, 'id') as string)

  if (!editionId || isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      message: "ID d'édition invalide",
    })
  }

  // Vérifier le paramètre leaderOnly
  const query = getQuery(event)
  const leaderOnly = query.leaderOnly === 'true'

  try {
    // Vérifier que l'édition existe
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true },
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        message: 'Édition non trouvée',
      })
    }

    // Si leaderOnly, l'utilisateur doit être connecté et on filtre par ses équipes
    if (leaderOnly) {
      const user = optionalAuth(event)

      if (!user) {
        throw createError({
          statusCode: 401,
          message: 'Authentification requise',
        })
      }

      // Récupérer uniquement les équipes dont l'utilisateur est leader
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
                  id: true,
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

    // Récupérer les équipes de bénévoles pour cette édition
    // Accès public en lecture pour permettre l'affichage dans le formulaire de candidature
    const teams = await prisma.volunteerTeam.findMany({
      where: {
        editionId,
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
  } catch (error) {
    // Si c'est déjà une erreur HTTP, la relancer
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des équipes de bénévoles',
    })
  }
})
