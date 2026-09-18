import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageTasks,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/task-groups/[groupId]/tags
 *
 * Liste les tags définis sur un groupe de tâches (ordonnés par displayOrder).
 *
 * Demande le droit de GESTION des tâches, comme les autres points de ce groupe.
 *
 * ⚠️ Ce point a longtemps été ouvert à tout compte authentifié, au motif qu'il servait au filtre
 * de « Mes tâches » côté bénévoles. Ce n'était plus vrai : cette page agrège les tags depuis les
 * tâches qu'elle a déjà reçues et n'appelle pas ce point. La justification avait survécu à ce
 * qu'elle justifiait, et laissait n'importe quel inscrit lire les noms de tags de n'importe quelle
 * édition en énumérant les identifiants — un nom de tag dit souvent quelque chose de
 * l'organisation interne. Les deux seuls appelants sont la page de gestion d'un groupe et la
 * modale qui gère les tags, toutes deux réservées aux organisateurs.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const groupId = Number(getRouterParam(event, 'groupId'))
    if (isNaN(groupId)) {
      throw createError({ status: 400, message: 'Identifiant de groupe invalide' })
    }

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!canManageTasks(edition, user)) {
      throw createError({
        status: 403,
        message: "Vous n'êtes pas autorisé à gérer les tâches de cette édition",
      })
    }

    const group = await prisma.taskGroup.findFirst({
      where: { id: groupId, editionId },
      select: { id: true },
    })
    if (!group) {
      throw createError({ status: 404, message: 'Groupe introuvable' })
    }

    const tags = await prisma.taskTag.findMany({
      where: { taskGroupId: groupId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, color: true, displayOrder: true },
    })

    return createSuccessResponse({ tags })
  },
  { operationName: 'GetTaskGroupTags' }
)
