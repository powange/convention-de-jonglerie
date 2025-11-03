import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { deleteProfilePicture } from '@@/server/utils/image-deletion'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    // Utiliser l'utilitaire de suppression
    const result = await deleteProfilePicture(user.id)

    return {
      success: result.success,
      user: result.entity,
    }
  },
  { operationName: 'DeleteProfilePicture' }
)
