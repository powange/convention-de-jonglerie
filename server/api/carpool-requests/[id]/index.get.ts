import { wrapApiHandler } from '#server/utils/api-helpers'
import { transformCarpoolRequest } from '#server/utils/carpool-transform'
import { carpoolRequestFullInclude } from '#server/utils/prisma-select-helpers'
import { validateResourceId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const requestId = validateResourceId(event, 'id', 'demande')
    const viewerId = event.context.user?.id as number | undefined
    const request = await prisma.carpoolRequest.findUnique({
      where: { id: requestId },
      include: {
        ...carpoolRequestFullInclude,
        comments: {
          ...carpoolRequestFullInclude.comments,
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!request) {
      throw createError({
        status: 404,
        message: 'Demande de covoiturage introuvable',
      })
    }

    return transformCarpoolRequest(request, viewerId)
  },
  { operationName: 'GetCarpoolRequest' }
)
