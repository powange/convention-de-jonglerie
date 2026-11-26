import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const presetId = getRouterParam(event, 'presetId')

    if (!presetId || isNaN(Number(presetId))) {
      throw createError({ statusCode: 400, message: 'ID de preset invalide' })
    }

    // Vérifier que le preset appartient à l'utilisateur
    const existing = await prisma.showPreset.findUnique({
      where: { id: Number(presetId) },
    })
    if (!existing || existing.userId !== user.id) {
      throw createError({ statusCode: 404, message: 'Preset non trouvé' })
    }

    await prisma.showPreset.delete({
      where: { id: Number(presetId) },
    })

    return createSuccessResponse({ deleted: true })
  },
  { operationName: 'DeleteShowPreset' }
)
