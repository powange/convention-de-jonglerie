import { requireAuth } from '@@/server/utils/auth-utils'
import { deleteConventionImage } from '@@/server/utils/image-deletion'
import { validateConventionId } from '@@/server/utils/permissions/convention-permissions'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  const user = requireAuth(event)

  try {
    const conventionId = validateConventionId(getRouterParam(event, 'id'))

    // Utiliser l'utilitaire de suppression avec l'objet user complet
    const result = await deleteConventionImage(conventionId, user)

    return {
      success: result.success,
      message: result.message,
      convention: result.entity,
    }
  } catch (error: unknown) {
    // Si c'est déjà une erreur HTTP, la relancer
    const httpError = error as { statusCode?: number; message?: string }
    if (httpError.statusCode) {
      throw error
    }

    console.error("Erreur lors de la suppression de l'image:", error)
    throw createError({
      statusCode: 500,
      message: "Erreur serveur lors de la suppression de l'image",
    })
  }
})
