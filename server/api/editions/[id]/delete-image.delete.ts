import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { deleteEditionImage } from '#server/utils/image-deletion'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Utiliser l'utilitaire de suppression
    const result = await deleteEditionImage(editionId, user.id)

    return {
      success: result.success,
      edition: result.entity,
    }
  },
  { operationName: 'DeleteEditionImage' }
)
