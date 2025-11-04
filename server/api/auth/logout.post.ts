import { clearUserSession } from '#imports'
import { wrapApiHandler } from '@@/server/utils/api-helpers'

export default wrapApiHandler(
  async (event) => {
    await clearUserSession(event)
    return { success: true }
  },
  { operationName: 'Logout' }
)
