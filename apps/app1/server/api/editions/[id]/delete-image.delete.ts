import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { deleteEditionImage } from '#server/utils/image-deletion'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    /*
     * L'utilisateur COMPLET et non son seul identifiant : la garde de suppression passe désormais
     * par `getEditionForEdit`, qui reconnaît l'auteur de la convention, un organisateur habilité
     * et l'admin global — ce que `creatorId === userId` refusait.
     */
    const result = await deleteEditionImage(editionId, user)

    return createSuccessResponse({ edition: result.entity })
  },
  { operationName: 'DeleteEditionImage' }
)
