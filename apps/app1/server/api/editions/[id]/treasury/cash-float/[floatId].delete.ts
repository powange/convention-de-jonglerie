import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/** DELETE /api/editions/:id/treasury/cash-float/:floatId — retire un apport saisi par erreur. */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const floatId = Number(getRouterParam(event, 'floatId'))
    if (!Number.isInteger(floatId) || floatId <= 0) {
      throw createError({ status: 400, message: 'Identifiant d’apport invalide' })
    }

    const allowed = await canManageTreasuryById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants pour gérer la trésorerie' })
    }

    /*
     * `deleteMany` avec l'édition dans le `where` plutôt qu'un `delete` par identifiant : un apport
     * d'une AUTRE édition ne doit pas pouvoir être supprimé en passant son identifiant ici, et le
     * compte rendu dit alors 404 au lieu de supprimer silencieusement.
     */
    const { count } = await prisma.treasuryCashFloat.deleteMany({
      where: { id: floatId, editionId },
    })
    if (count === 0) {
      throw createError({ status: 404, message: 'Apport introuvable' })
    }

    return createSuccessResponse({ id: floatId })
  },
  { operationName: 'DeleteTreasuryCashFloat' }
)
