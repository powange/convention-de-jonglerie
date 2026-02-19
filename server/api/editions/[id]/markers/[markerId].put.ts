import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { editionMarkerSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'
import { updateMarkerSchema } from '#server/utils/zone-validation'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const markerId = validateResourceId(event, 'markerId', 'marker')

    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour modifier ce point de repère',
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

    const body = await readBody(event)
    const data = updateMarkerSchema.parse(body)

    const marker = await prisma.editionMarker.update({
      where: { id: markerId },
      data: {
        name: data.name,
        description: data.description,
        latitude: data.latitude,
        longitude: data.longitude,
        markerTypes: data.markerTypes,
        color: data.color,
      },
      select: editionMarkerSelect,
    })

    return {
      success: true,
      marker,
    }
  },
  { operationName: 'UpdateEditionMarker' }
)
