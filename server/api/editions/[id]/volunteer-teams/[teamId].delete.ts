import { requireAuth } from '../../../../utils/auth-utils'
import { prisma } from '../../../../utils/prisma'
import { requireVolunteerManagementAccess } from '../../../../utils/volunteer-permissions'

export default defineEventHandler(async (event) => {
  // Authentification requise
  await requireAuth(event)

  // Validation des paramètres
  const editionId = parseInt(getRouterParam(event, 'id') as string)
  const teamId = getRouterParam(event, 'teamId') as string

  if (!editionId || isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: "ID d'édition invalide",
    })
  }

  if (!teamId) {
    throw createError({
      statusCode: 400,
      statusMessage: "ID d'équipe invalide",
    })
  }

  // Vérifier les permissions de gestion des bénévoles
  await requireVolunteerManagementAccess(event, editionId)

  try {
    // Vérifier que l'équipe existe et appartient à cette édition
    const existingTeam = await prisma.volunteerTeam.findFirst({
      where: {
        id: teamId,
        editionId,
      },
      include: {
        _count: {
          select: {
            timeSlots: true,
          },
        },
      },
    })

    if (!existingTeam) {
      throw createError({
        statusCode: 404,
        statusMessage: "Équipe non trouvée ou n'appartient pas à cette édition",
      })
    }

    // Vérifier s'il y a des créneaux assignés à cette équipe
    if (existingTeam._count.timeSlots > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Impossible de supprimer une équipe avec des créneaux assignés',
      })
    }

    // Supprimer l'équipe
    await prisma.volunteerTeam.delete({
      where: { id: teamId },
    })

    setResponseStatus(event, 204)
    return null
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Erreur lors de la suppression de l'équipe",
    })
  }
})
