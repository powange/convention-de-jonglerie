import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { createCommentForEntity } from '@@/server/utils/commentsHandler'

export default wrapApiHandler(
  async (event) => {
    return createCommentForEntity(event, {
      entityType: 'carpoolOffer',
      entityIdField: 'carpoolOfferId',
      requireAuth: true,
    })
  },
  { operationName: 'CreateCarpoolOfferComment' }
)
