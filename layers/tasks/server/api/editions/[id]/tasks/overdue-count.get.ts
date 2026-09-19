import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageTasks,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/tasks/overdue-count
 *
 * Combien de tâches de l'édition ont dépassé leur échéance sans être closes.
 *
 * Un point dédié, et non un champ ajouté à la liste des groupes : aucun écran n'affiche ce nombre,
 * seule la pastille du menu le lit. Le greffer sur la liste ferait payer un agrégat à la page
 * d'accueil du module, qu'on vient précisément d'alléger.
 *
 * Ce qui compte comme « en retard » : une échéance passée, sur une tâche encore à faire ou en
 * cours. Une tâche TERMINÉE ou ANNULÉE n'attend plus rien — la compter allumerait la pastille à
 * jamais et lui ferait perdre tout sens. Même règle que les listes de courses et les emprunts de
 * matériel, où seul ce qui reste à faire s'affiche.
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

    const overdue = await prisma.task.count({
      where: {
        group: { editionId },
        status: { in: ['TODO', 'IN_PROGRESS'] },
        deadline: { lt: new Date() },
      },
    })

    return createSuccessResponse({ overdue })
  },
  { operationName: 'GetOverdueTaskCount' }
)
