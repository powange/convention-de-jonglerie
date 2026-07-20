import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'
import { showZoneMarkerInclude } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)

    const shows = await prisma.show.findMany({
      where: {
        editionId,
        isPublic: true,
      },
      // technicalNeeds est une note d'organisation : on l'exclut de la réponse publique
      omit: {
        technicalNeeds: true,
      },
      include: {
        ...showZoneMarkerInclude,
      },
      orderBy: {
        startDateTime: 'asc',
      },
    })

    return createSuccessResponse({ shows })
  },
  { operationName: 'GetPublicEditionShows' }
)
