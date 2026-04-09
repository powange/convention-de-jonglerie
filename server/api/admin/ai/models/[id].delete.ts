import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { createSuccessResponse, wrapApiHandler } from '#server/utils/api-helpers'

/**
 * DELETE /api/admin/ai/models/:id
 * Supprime un modèle IA de la liste
 */
export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const id = parseInt(getRouterParam(event, 'id') || '')
    if (isNaN(id)) {
      throw createError({ statusCode: 400, message: 'ID invalide' })
    }

    await prisma.aiModel.delete({
      where: { id },
    })

    return createSuccessResponse({ deleted: true })
  },
  { operationName: 'DeleteAIModel' }
)
