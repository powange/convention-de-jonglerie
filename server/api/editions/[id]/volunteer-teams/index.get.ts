import { requireAuth } from '../../../../utils/auth-utils'
import { prisma } from '../../../../utils/prisma'
import { requireVolunteerManagementAccess } from '../../../../utils/volunteer-permissions'

export default defineEventHandler(async (event) => {
  // Authentification requise
  await requireAuth(event)

  // Validation des paramètres
  const editionId = parseInt(getRouterParam(event, 'id') as string)

  if (!editionId || isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: "ID d'édition invalide",
    })
  }

  // Vérifier les permissions de gestion des bénévoles
  await requireVolunteerManagementAccess(event, editionId)

  try {
    // Récupérer les équipes de bénévoles pour cette édition
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
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la récupération des équipes de bénévoles',
    })
  }
})
