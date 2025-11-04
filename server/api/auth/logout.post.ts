import { wrapApiHandler } from '@@/server/utils/api-helpers'

import { clearUserSession } from '#imports'

export default wrapApiHandler(
  async (event) => {
    await clearUserSession(event)
    return { success: true }
  },
  { operationName: 'Logout' }
)
