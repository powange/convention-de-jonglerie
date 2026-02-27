import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { invalidateEditionCache } from '#server/utils/cache-helpers'
import { getEditionForDelete } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Récupère l'édition et vérifie les permissions de suppression
    await getEditionForDelete(editionId, user)

    // Si on arrive ici, l'utilisateur a les droits
    await prisma.edition.delete({
      where: { id: editionId },
    })

    // Invalider le cache après suppression
    await invalidateEditionCache(editionId)

    return createSuccessResponse(null, 'Edition deleted successfully')
  },
  { operationName: 'DeleteEdition' }
)
