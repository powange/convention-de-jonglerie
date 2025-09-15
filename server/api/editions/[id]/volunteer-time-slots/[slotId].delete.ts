import { requireAuth } from '../../../../utils/auth-utils'
import { prisma } from '../../../../utils/prisma'
import { requireVolunteerManagementAccess } from '../../../../utils/volunteer-permissions'

export default defineEventHandler(async (event) => {
  // Authentification requise
  await requireAuth(event)

  // Validation des paramètres
  const editionId = parseInt(getRouterParam(event, 'id') as string)
  const slotId = getRouterParam(event, 'slotId') as string

  if (!editionId || isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: "ID d'édition invalide",
    })
  }

  if (!slotId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID de créneau invalide',
    })
  }

  // Vérifier les permissions de gestion des bénévoles
  await requireVolunteerManagementAccess(event, editionId)

  try {
    // Vérifier que le créneau existe et appartient à cette édition
    const existingSlot = await prisma.volunteerTimeSlot.findFirst({
      where: {
        id: slotId,
        editionId,
      },
      include: {
        _count: {
          select: {
            assignments: true,
          },
        },
      },
    })

    if (!existingSlot) {
      throw createError({
        statusCode: 404,
        statusMessage: "Créneau non trouvé ou n'appartient pas à cette édition",
      })
    }

    // Vérifier s'il y a des bénévoles assignés
    if (existingSlot._count.assignments > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Impossible de supprimer un créneau avec des bénévoles assignés',
      })
    }

    // Supprimer le créneau
    await prisma.volunteerTimeSlot.delete({
      where: { id: slotId },
    })

    setResponseStatus(event, 204)
    return null
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la suppression du créneau',
    })
  }
})
