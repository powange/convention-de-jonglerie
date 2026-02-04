import { clearUserSession } from '#imports'

import { wrapApiHandler } from '#server/utils/api-helpers'

export default wrapApiHandler(
  async (event) => {
    // Vider la session corrompue
    await clearUserSession(event)

    return {
      success: true,
      message: 'Session cleared. Please log in again.',
    }
  },
  { operationName: 'FixSession' }
)
