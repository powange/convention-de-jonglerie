import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const zoneId = validateResourceId(event, 'zoneId', 'zone')

    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour supprimer cette zone',
      })
    }

    // Vérifier que la zone existe et appartient à cette édition
    const existingZone = await prisma.editionZone.findFirst({
      where: {
        id: zoneId,
        editionId,
      },
    })

    if (!existingZone) {
      throw createError({
        status: 404,
        message: 'Zone introuvable',
      })
    }

    await prisma.editionZone.delete({
      where: { id: zoneId },
    })

    return {
      success: true,
      message: 'Zone supprimée avec succès',
    }
  },
  { operationName: 'DeleteEditionZone' }
)
