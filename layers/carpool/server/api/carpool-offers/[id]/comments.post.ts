import { wrapApiHandler } from '#server/utils/api-helpers'
import { createCommentForEntity } from '#server/utils/commentsHandler'

export default wrapApiHandler(
  async (event) => {
    const comment = await createCommentForEntity(event, {
      entityType: 'carpoolOffer',
      entityIdField: 'carpoolOfferId',
      requireAuth: true,
    })
    return createSuccessResponse(comment)
  },
  { operationName: 'CreateCarpoolOfferComment' }
)
