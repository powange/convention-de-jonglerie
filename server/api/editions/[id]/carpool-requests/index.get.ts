import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { prisma } from '@@/server/utils/prisma'
import { validateEditionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)
    const query = getQuery(event) || {}
    const includeArchived = query.includeArchived === 'true'

    const now = new Date()

    const carpoolRequests = await prisma.carpoolRequest.findMany({
      where: {
        editionId,
        // Filtrer les covoiturages passés si includeArchived est false
        ...(includeArchived ? {} : { tripDate: { gte: now } }),
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            emailHash: true,
            profilePicture: true,
            updatedAt: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                emailHash: true,
                profilePicture: true,
                updatedAt: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        tripDate: 'asc',
      },
    })

    // Transformer les données pour masquer les emails et ajouter les hash
    const transformedRequests = carpoolRequests.map((request) => ({
      ...request,
      user: {
        id: request.user.id,
        pseudo: request.user.pseudo,
        emailHash: request.user.emailHash,
        profilePicture: request.user.profilePicture,
        updatedAt: request.user.updatedAt,
      },
      comments: request.comments.map((comment) => ({
        ...comment,
        user: {
          id: comment.user.id,
          pseudo: comment.user.pseudo,
          emailHash: comment.user.emailHash,
          profilePicture: comment.user.profilePicture,
          updatedAt: comment.user.updatedAt,
        },
      })),
    }))

    return transformedRequests
  },
  { operationName: 'GetCarpoolRequests' }
)
