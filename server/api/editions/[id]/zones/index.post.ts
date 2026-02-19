import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { editionZoneSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { createZoneSchema } from '#server/utils/zone-validation'

// ZONE_LIMITS est auto-importé depuis shared/utils/zone-types.ts

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour créer une zone',
      })
    }

    // Vérifier la limite de zones par édition
    const currentCount = await prisma.editionZone.count({
      where: { editionId },
    })

    if (currentCount >= ZONE_LIMITS.MAX_ZONES_PER_EDITION) {
      throw createError({
        status: 400,
        message: `Limite de ${ZONE_LIMITS.MAX_ZONES_PER_EDITION} zones atteinte pour cette édition`,
      })
    }

    const body = await readBody(event)
    const data = createZoneSchema.parse(body)

    // Obtenir l'ordre maximum actuel
    const maxOrderResult = await prisma.editionZone.aggregate({
      where: { editionId },
      _max: { order: true },
    })
    const nextOrder = (maxOrderResult._max.order ?? -1) + 1

    const zone = await prisma.editionZone.create({
      data: {
        editionId,
        name: data.name,
        description: data.description,
        color: data.color,
        coordinates: data.coordinates,
        zoneTypes: data.zoneTypes,
        order: nextOrder,
      },
      select: editionZoneSelect,
    })

    return {
      success: true,
      zone,
    }
  },
  { operationName: 'CreateEditionZone' }
)
