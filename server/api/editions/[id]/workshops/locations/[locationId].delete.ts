import { requireAuth } from '@@/server/utils/auth-utils'
import { canEditEdition } from '@@/server/utils/permissions/edition-permissions'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id')!)
  const locationId = parseInt(getRouterParam(event, 'locationId')!)

  if (isNaN(editionId) || isNaN(locationId)) {
    throw createError({
      statusCode: 400,
      message: 'ID invalide',
    })
  }

  try {
    // Vérifier que le lieu existe et appartient à l'édition
    const location = await prisma.workshopLocation.findFirst({
      where: {
        id: locationId,
        editionId,
      },
      include: {
        edition: {
          include: {
            convention: {
              include: {
                collaborators: true,
              },
            },
            collaboratorPermissions: {
              include: {
                collaborator: true,
              },
            },
          },
        },
      },
    })

    if (!location) {
      throw createError({
        statusCode: 404,
        message: 'Lieu non trouvé',
      })
    }

    // Vérifier les permissions
    const hasPermission = canEditEdition(location.edition, user)
    if (!hasPermission) {
      throw createError({
        statusCode: 403,
        message: "Vous n'êtes pas autorisé à gérer les lieux de cette édition",
      })
    }

    // Supprimer le lieu
    await prisma.workshopLocation.delete({
      where: { id: locationId },
    })

    return { success: true }
  } catch (error: unknown) {
    if ((error as any).statusCode) {
      throw error
    }

    console.error('Erreur lors de la suppression du lieu:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur interne du serveur',
    })
  }
})
