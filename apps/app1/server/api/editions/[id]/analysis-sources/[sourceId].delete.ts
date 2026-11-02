import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionForEdit } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Retire une source d'information d'une édition.
 *
 * ⚠️ Même précaution que la modification : la suppression est adressée par `{ id, editionId }`.
 * Sans l'édition dans le `where`, un organisateur pourrait supprimer la source d'une AUTRE édition
 * en changeant l'identifiant dans l'URL — la garde ne vérifie que ses droits sur l'édition du
 * chemin, pas l'appartenance de la ligne visée.
 *
 * 📍 `deleteMany` plutôt que `delete` : `delete` lève une erreur Prisma brute sur une ligne
 * absente, que l'écran afficherait telle quelle. Ici un 404 explicite dit ce qui s'est passé.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    await getEditionForEdit(editionId, user)

    const sourceId = Number(getRouterParam(event, 'sourceId'))
    if (!Number.isInteger(sourceId) || sourceId <= 0) {
      throw createError({ status: 400, message: 'Identifiant de source invalide' })
    }

    const resultat = await prisma.editionAnalysisSource.deleteMany({
      where: { id: sourceId, editionId },
    })

    if (resultat.count === 0) {
      throw createError({ status: 404, message: 'Source introuvable pour cette édition' })
    }

    return createSuccessResponse({ id: sourceId })
  },
  { operationName: 'SupprimerSourceAnalyse' }
)
