import { canAccessEditionData } from '../../../../utils/permissions/edition-permissions'
import { prisma } from '../../../../utils/prisma'

/**
 * Route dédiée pour récupérer tous les bénévoles acceptés avec leurs assignations d'équipes
 * Cette route n'est pas paginée car elle est utilisée pour afficher la répartition par équipes
 */
export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  const allowed = await canAccessEditionData(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à ces données',
    })

  // Récupérer tous les bénévoles acceptés avec leurs équipes
  const applications = await prisma.editionVolunteerApplication.findMany({
    where: {
      editionId,
      status: 'ACCEPTED',
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
})
