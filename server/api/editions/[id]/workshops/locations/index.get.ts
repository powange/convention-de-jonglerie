import { wrapApiHandler } from '#server/utils/api-helpers'
import { assertResourceExists } from '#server/utils/prisma-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)

    // Vérifier que l'édition existe
    await assertResourceExists(prisma.edition, editionId, 'Édition non trouvée')

    // Récupérer les lieux
    const locations = await prisma.workshopLocation.findMany({
      where: { editionId },
      orderBy: { name: 'asc' },
    })

    return locations
  },
  { operationName: 'GetWorkshopLocations' }
)
