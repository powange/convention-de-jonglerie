import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { getCommentsForEntity } from '@@/server/utils/commentsHandler'

export default wrapApiHandler(
  async (event) => {
    return getCommentsForEntity(event, {
      entityType: 'carpoolOffer',
      entityIdField: 'carpoolOfferId',
    })
  },
  { operationName: 'GetCarpoolOfferComments' }
)
