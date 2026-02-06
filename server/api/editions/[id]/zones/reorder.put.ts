import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { editionZoneSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

const reorderSchema = z.object({
  zoneIds: z.array(z.number().int().positive()).min(1),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour réorganiser les zones',
      })
    }

    const body = await readBody(event)
    const { zoneIds } = reorderSchema.parse(body)

    // Vérifier que toutes les zones appartiennent à cette édition
    const existingZones = await prisma.editionZone.findMany({
      where: {
        editionId,
        id: { in: zoneIds },
      },
      select: { id: true },
    })

    if (existingZones.length !== zoneIds.length) {
      throw createError({
        status: 400,
        message: "Certaines zones sont introuvables ou n'appartiennent pas à cette édition",
      })
    }

    // Mettre à jour l'ordre de chaque zone
    await prisma.$transaction(
      zoneIds.map((zoneId, index) =>
        prisma.editionZone.update({
          where: { id: zoneId },
          data: { order: index },
        })
      )
    )

    // Récupérer les zones mises à jour
    const zones = await prisma.editionZone.findMany({
      where: { editionId },
      select: editionZoneSelect,
      orderBy: { order: 'asc' },
    })

    return {
      success: true,
      zones,
    }
  },
  { operationName: 'ReorderEditionZones' }
)
