import { clearUserSession } from '#imports'

import { wrapApiHandler } from '#server/utils/api-helpers'

export default wrapApiHandler(
  async (event) => {
    // Vider la session corrompue
    await clearUserSession(event)

    return createSuccessResponse(null, 'Session cleared. Please log in again.')
  },
  { operationName: 'FixSession' }
)
