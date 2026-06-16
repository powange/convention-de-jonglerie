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

    // Si on arrive ici, l'utilisateur a les droits.
    // On supprime l'ancre Event (id == eventId) : la cascade efface l'Edition ET les données
    // bénévoles (candidatures, équipes, créneaux, commentaires, groupes de notif) qui pendent
    // désormais sur Event. Supprimer seulement l'Edition laisserait ces données orphelines.
    await prisma.event.delete({
      where: { id: editionId },
    })

    // Invalider le cache après suppression
    await invalidateEditionCache(editionId)

    return createSuccessResponse(null, 'Edition deleted successfully')
  },
  { operationName: 'DeleteEdition' }
)
