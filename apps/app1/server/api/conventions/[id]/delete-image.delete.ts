import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { deleteConventionImage } from '#server/utils/image-deletion'
import { validateConventionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const conventionId = validateConventionId(event)

    const result = await deleteConventionImage(conventionId, user)

    return createSuccessResponse({ convention: result.entity }, result.message)
  },
  { operationName: 'DeleteConventionImage' }
)
