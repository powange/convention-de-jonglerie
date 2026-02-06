import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const markerId = validateResourceId(event, 'markerId', 'marker')

    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour supprimer ce point de repère',
      })
    }

    // Vérifier que le marqueur existe et appartient à cette édition
    const existingMarker = await prisma.editionMarker.findFirst({
      where: {
        id: markerId,
        editionId,
      },
    })

    if (!existingMarker) {
      throw createError({
        status: 404,
        message: 'Point de repère introuvable',
      })
    }

    await prisma.editionMarker.delete({
      where: { id: markerId },
    })

    return {
      success: true,
      message: 'Point de repère supprimé avec succès',
    }
  },
  { operationName: 'DeleteEditionMarker' }
)
