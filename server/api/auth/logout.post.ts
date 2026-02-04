import { clearUserSession } from '#imports'

import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'

export default wrapApiHandler(
  async (event) => {
    await clearUserSession(event)
    return createSuccessResponse(null)
  },
  { operationName: 'Logout' }
)
