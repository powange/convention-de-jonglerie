import { wrapApiHandler } from '#server/utils/api-helpers'
import { transformCarpoolRequest } from '#server/utils/carpool-transform'
import { carpoolRequestFullInclude } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)
    const viewerId = event.context.user?.id as number | undefined
    const query = getQuery(event) || {}
    const includeArchived = query.includeArchived === 'true'

    const now = new Date()

    const carpoolRequests = await prisma.carpoolRequest.findMany({
      where: {
        editionId,
        ...(includeArchived ? {} : { tripDate: { gte: now } }),
      },
      include: {
        ...carpoolRequestFullInclude,
        comments: {
          ...carpoolRequestFullInclude.comments,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { tripDate: 'asc' },
    })

    return carpoolRequests.map((request) => transformCarpoolRequest(request, viewerId))
  },
  { operationName: 'GetCarpoolRequests' }
)
