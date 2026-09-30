import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { invalidateEditionCache } from '#server/utils/cache-helpers'
import { deletePhysicalImageFile } from '#server/utils/image-deletion'
import { getEditionForDelete } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Récupère l'édition et vérifie les permissions de suppression
    const edition = await getEditionForDelete(editionId, user)

    /*
     * L'affiche quitte le disque AVANT la cascade.
     *
     * ⚠️ APRÈS, IL SERAIT TROP TARD : la ligne effacée, plus rien ne dit quel fichier lui
     * appartenait, et il resterait indéfiniment sous `/uploads/editions/<id>/`. Une édition
     * supprimée laissait donc son affiche sur le disque pour toujours — invisible, et
     * irretrouvable autrement qu'en comparant le dossier à la base.
     *
     * L'échec est toléré (`deleteOldFile` avale ses erreurs) : un fichier déjà absent ne doit pas
     * empêcher de supprimer l'édition.
     */
    await deletePhysicalImageFile(edition.imageUrl, { entityId: editionId, dossier: 'editions' })

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
