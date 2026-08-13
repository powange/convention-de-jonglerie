import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageProgram } from '#server/utils/permissions/program-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const itemId = Number(getRouterParam(event, 'itemId'))
    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw createError({ status: 400, message: 'Identifiant d’élément invalide' })
    }

    const allowed = await canManageProgram(editionId, user, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    // Voir le PUT : le filtre sur l'édition empêche d'atteindre l'élément d'une autre convention.
    const supprime = await prisma.editionProgramItem.deleteMany({
      where: { id: itemId, editionId },
    })
    if (supprime.count === 0) {
      throw createError({ status: 404, message: 'Élément de programmation introuvable' })
    }

    return { success: true }
  },
  { operationName: 'Suppression d’un élément de programmation' }
)
