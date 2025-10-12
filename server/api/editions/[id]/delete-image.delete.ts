import { requireAuth } from '@@/server/utils/auth-utils'
import { deleteEditionImage } from '@@/server/utils/image-deletion'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') as string)

  if (!editionId) {
    throw createError({
      statusCode: 400,
      message: "ID d'édition invalide",
    })
  }

  try {
    // Utiliser l'utilitaire de suppression
    const result = await deleteEditionImage(editionId, user.id)

    return {
      success: result.success,
      edition: result.entity,
    }
  } catch (error: unknown) {
    const httpError = error as { statusCode?: number; message?: string }
    if (httpError.statusCode) {
      throw error
    }

    console.error("Erreur lors de la suppression de l'image d'édition:", error)
    throw createError({
      statusCode: 500,
      message: "Erreur lors de la suppression de l'image",
    })
  }
})
