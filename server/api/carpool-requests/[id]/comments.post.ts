import { wrapApiHandler } from '#server/utils/api-helpers'
import { createCommentForEntity } from '#server/utils/commentsHandler'

export default wrapApiHandler(
  async (event) => {
    return createCommentForEntity(event, {
      entityType: 'carpoolRequest',
      entityIdField: 'carpoolRequestId',
      requireAuth: true,
    })
  },
  { operationName: 'CreateCarpoolRequestComment' }
)
