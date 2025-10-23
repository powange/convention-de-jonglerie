import { requireAuth } from '@@/server/utils/auth-utils'
import { canEditWorkshop } from '@@/server/utils/permissions/workshop-permissions'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id')!)
  const workshopId = parseInt(getRouterParam(event, 'workshopId')!)

  if (isNaN(editionId) || isNaN(workshopId)) {
    throw createError({
      statusCode: 400,
      message: 'ID invalide',
    })
  }

  try {
    // Vérifier que le workshop existe et appartient à l'édition
    const workshop = await prisma.workshop.findFirst({
      where: {
        id: workshopId,
        editionId,
      },
    })

    if (!workshop) {
      throw createError({
        statusCode: 404,
        message: 'Workshop non trouvé',
      })
    }

    // Vérifier les permissions pour supprimer le workshop
    const hasPermission = await canEditWorkshop(user.id, workshopId)
    if (!hasPermission) {
      throw createError({
        statusCode: 403,
        message:
          "Vous n'êtes pas autorisé à supprimer ce workshop. Seuls le créateur ou les organisateurs peuvent le faire.",
      })
    }

    // Supprimer le workshop
    await prisma.workshop.delete({
      where: { id: workshopId },
    })

    return { success: true, message: 'Workshop supprimé avec succès' }
  } catch (error: unknown) {
    if ((error as any).statusCode) {
      throw error
    }

    console.error('Erreur lors de la suppression du workshop:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur interne du serveur',
    })
  }
})
