import { requireAuth } from '@@/server/utils/auth-utils'
import { deleteConventionCollaborator } from '@@/server/utils/collaborator-management'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  try {
    const conventionId = parseInt(getRouterParam(event, 'id') as string)
    const collaboratorId = parseInt(getRouterParam(event, 'collaboratorId') as string)

    // Utiliser l'utilitaire de suppression
    const result = await deleteConventionCollaborator(conventionId, collaboratorId, user.id)

    return {
      success: result.success,
      message: result.message,
    }
  } catch (error: unknown) {
    const httpError = error as { statusCode?: number; message?: string }
    if (httpError.statusCode) {
      throw error
    }

    console.error('Erreur lors de la suppression du collaborateur:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur',
    })
  }
})
