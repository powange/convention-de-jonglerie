import { wrapApiHandler } from '#server/utils/api-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { useWorkshopsPorts } from '#server/workshops/ports/registry'

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)

    // Vérifier que l'événement existe (via le port ; le layer ne lit pas Edition directement)
    const cfg = await useWorkshopsPorts().event.getConfig(editionId)
    if (!cfg.found) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }

    // Récupérer les lieux
    const locations = await prisma.workshopLocation.findMany({
      where: { editionId },
      orderBy: { name: 'asc' },
    })

    return createSuccessResponse({ locations })
  },
  { operationName: 'GetWorkshopLocations' }
)
