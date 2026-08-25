import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'
import { showZoneMarkerInclude } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)

    // La publication se décide représentation par représentation : une date peut être annoncée
    // pendant qu'une autre reste en préparation. On part donc des représentations publiques,
    // et non des spectacles — dont aucun n'est « public » en tant que tel.
    const performances = await prisma.showPerformance.findMany({
      where: {
        isPublic: true,
        show: { editionId },
      },
      include: {
        ...showZoneMarkerInclude,
        show: {
          // technicalNeeds est une note d'organisation : on l'exclut de la réponse publique
          omit: {
            technicalNeeds: true,
          },
        },
      },
      orderBy: {
        startDateTime: 'asc',
      },
    })

    return createSuccessResponse({ performances })
  },
  { operationName: 'GetPublicEditionShows' }
)
