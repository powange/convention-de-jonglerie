import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { editionMarkerSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

const reorderSchema = z.object({
  markerIds: z.array(z.number().int().positive()).min(1),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour réorganiser les points de repère',
      })
    }

    const body = await readBody(event)
    const { markerIds } = reorderSchema.parse(body)

    // Vérifier que tous les marqueurs appartiennent à cette édition
    const existingMarkers = await prisma.editionMarker.findMany({
      where: {
        editionId,
        id: { in: markerIds },
      },
      select: { id: true },
    })

    if (existingMarkers.length !== markerIds.length) {
      throw createError({
        status: 400,
        message:
          "Certains points de repère sont introuvables ou n'appartiennent pas à cette édition",
      })
    }

    // Mettre à jour l'ordre de chaque marqueur
    await prisma.$transaction(
      markerIds.map((markerId, index) =>
        prisma.editionMarker.update({
          where: { id: markerId },
          data: { order: index },
        })
      )
    )

    // Récupérer les marqueurs mis à jour
    const markers = await prisma.editionMarker.findMany({
      where: { editionId },
      select: editionMarkerSelect,
      orderBy: { order: 'asc' },
    })

    return {
      success: true,
      markers,
    }
  },
  { operationName: 'ReorderEditionMarkers' }
)
