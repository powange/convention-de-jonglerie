import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { editionZoneSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'
import { updateZoneSchema } from '#server/utils/zone-validation'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const zoneId = validateResourceId(event, 'zoneId', 'zone')

    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour modifier cette zone',
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

    const body = await readBody(event)
    const data = updateZoneSchema.parse(body)

    const zone = await prisma.editionZone.update({
      where: { id: zoneId },
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
        coordinates: data.coordinates,
        zoneType: data.zoneType,
      },
      select: editionZoneSelect,
    })

    return {
      success: true,
      zone,
    }
  },
  { operationName: 'UpdateEditionZone' }
)
