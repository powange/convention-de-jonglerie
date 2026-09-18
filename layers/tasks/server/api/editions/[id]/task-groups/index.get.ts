import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageTasks,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/task-groups
 *
 * Les groupes de tâches d'une édition, en RÉSUMÉ : de quoi remplir la page d'accueil du module et
 * le sélecteur « déplacer vers un autre groupe », rien de plus.
 *
 * ⚠️ Ce point rendait auparavant chaque groupe avec TOUTES ses tâches, leurs assignations, leurs
 * checklists et leurs étiquettes. Or ses deux appelants n'en voulaient presque rien : la page
 * d'accueil ne lit que le NOMBRE de tâches pour l'afficher sur une carte, et l'écran d'un groupe
 * n'utilisait cette liste que pour retrouver le sien — il passe désormais par
 * `[groupId]/index.get`, qui ne rend que celui-là.
 *
 * `_count` remplace donc `tasks`. Le reste — assignés, checklists, étiquettes — était transféré,
 * désérialisé, puis jeté.
 *
 * Accessible aux utilisateurs avec le droit `canManageTasks`.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

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

    const groups = await prisma.taskGroup.findMany({
      where: { editionId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        displayOrder: true,
        _count: { select: { tasks: true } },
      },
    })

    return createSuccessResponse({ groups })
  },
  { operationName: 'GetTaskGroups' }
)
