import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageProgram } from '#server/utils/permissions/program-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Liste des éléments de programmation d'une édition, brouillons compris.
 *
 * Réservé aux organisateurs : c'est la vue de composition. Le public passe par
 * `/api/editions/:id/program`, qui réunit les trois sources et masque ce qui n'est pas publié.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageProgram(editionId, user, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const items = await prisma.editionProgramItem.findMany({
      where: { editionId },
      orderBy: [{ startDateTime: 'asc' }, { title: 'asc' }],
    })

    return { success: true, data: { items } }
  },
  { operationName: 'Liste des éléments de programmation' }
)
