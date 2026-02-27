import { wrapApiHandler } from '#server/utils/api-helpers'
import { createCommentForEntity } from '#server/utils/commentsHandler'

export default wrapApiHandler(
  async (event) => {
    const comment = await createCommentForEntity(event, {
      entityType: 'carpoolRequest',
      entityIdField: 'carpoolRequestId',
      requireAuth: true,
    })
    return createSuccessResponse(comment)
  },
  { operationName: 'CreateCarpoolRequestComment' }
)
