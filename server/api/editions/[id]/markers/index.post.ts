import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { editionMarkerSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { createMarkerSchema } from '#server/utils/zone-validation'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour créer un point de repère',
      })
    }

    // Vérifier la limite de marqueurs par édition
    const currentCount = await prisma.editionMarker.count({
      where: { editionId },
    })

    if (currentCount >= ZONE_LIMITS.MAX_MARKERS_PER_EDITION) {
      throw createError({
        status: 400,
        message: `Limite de ${ZONE_LIMITS.MAX_MARKERS_PER_EDITION} points de repère atteinte pour cette édition`,
      })
    }

    const body = await readBody(event)
    const data = createMarkerSchema.parse(body)

    // Obtenir l'ordre maximum actuel
    const maxOrderResult = await prisma.editionMarker.aggregate({
      where: { editionId },
      _max: { order: true },
    })
    const nextOrder = (maxOrderResult._max.order ?? -1) + 1

    const marker = await prisma.editionMarker.create({
      data: {
        editionId,
        name: data.name,
        description: data.description,
        latitude: data.latitude,
        longitude: data.longitude,
        markerTypes: data.markerTypes,
        color: data.color,
        order: nextOrder,
      },
      select: editionMarkerSelect,
    })

    return createSuccessResponse({ marker })
  },
  { operationName: 'CreateEditionMarker' }
)
