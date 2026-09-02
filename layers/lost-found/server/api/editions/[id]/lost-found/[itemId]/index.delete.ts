import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canEditEditionById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

/**
 * Supprimer un objet trouvé.
 *
 * Le module permettait de créer, commenter et marquer restitué — jamais de supprimer. Une entrée
 * déposée par erreur restait donc affichée indéfiniment, sans recours pour personne.
 *
 * Deux profils peuvent supprimer : l'auteur, qui retire sa propre erreur, et tout organisateur
 * de l'édition. Le second n'est pas redondant avec le premier : l'auteur peut avoir quitté
 * l'équipe entre-temps, et son objet deviendrait alors indélébile.
 *
 * Les commentaires partent avec l'objet — la cascade est déclarée sur la relation, il n'y a rien
 * à nettoyer ici. L'image reste sur le disque : les fichiers envoyés ne sont pas rattachés à une
 * entité par le stockage, et les supprimer d'ici demanderait un mécanisme qui n'existe pas
 * encore. Signalé plutôt que bricolé.
 */
export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)
    const itemId = validateResourceId(event, 'itemId', 'objet')

    const user = requireAuth(event)
    const userId = user.id

    // Vérifier que l'objet trouvé existe et appartient à l'édition
    const lostFoundItem = await prisma.lostFoundItem.findFirst({
      where: {
        id: itemId,
        editionId: editionId,
      },
      select: { id: true, userId: true },
    })

    if (!lostFoundItem) {
      throw createError({
        status: 404,
        message: 'Objet trouvé non trouvé',
      })
    }

    // L'auteur d'abord : c'est le cas courant, et il évite d'interroger les permissions.
    const estAuteur = lostFoundItem.userId === userId
    const hasPermission = estAuteur || (await canEditEditionById(editionId, userId, event))

    if (!hasPermission) {
      throw createError({
        status: 403,
        message: 'Vous devez être l’auteur ou un organisateur pour supprimer un objet trouvé',
      })
    }

    await prisma.lostFoundItem.delete({ where: { id: itemId } })

    return { success: true }
  },
  { operationName: 'DeleteLostFoundItem' }
)
