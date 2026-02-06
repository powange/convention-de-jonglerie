import { wrapApiHandler } from '#server/utils/api-helpers'
import { editionZoneSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)

    // Vérifier que l'édition existe
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true },
    })

    if (!edition) {
      throw createError({
        status: 404,
        message: 'Édition introuvable',
      })
    }

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
  { operationName: 'GetEditionZones' }
)
