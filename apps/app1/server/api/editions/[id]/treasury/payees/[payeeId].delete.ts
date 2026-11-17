import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import { listerBeneficiaires } from '#server/utils/treasury-payees'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Retire un bénéficiaire du carnet.
 *
 * ⚠️ Même précaution que la modification : adressé par `{ id, editionId }`. Sans l'édition dans le
 * `where`, un organisateur habilité sur une édition supprimerait le bénéficiaire d'une autre en
 * changeant l'identifiant dans l'URL.
 *
 * 📍 `deleteMany` plutôt que `delete` : `delete` lève une erreur Prisma brute sur une ligne
 * absente, que l'écran afficherait telle quelle. Ici un 404 explicite dit ce qui s'est passé.
 *
 * 📍 Aucune entrée de trésorerie ne le référence encore : le lien « à régler à » arrive au lot
 * suivant. Quand il existera, il faudra décider ici ce qu'on fait d'un bénéficiaire encore
 * utilisé — refuser la suppression, ou détacher les entrées. Le silence actuel n'est pas un
 * oubli, c'est qu'il n'y a rien à protéger pour l'instant.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageTreasuryById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants pour gérer la trésorerie' })
    }

    const payeeId = Number(getRouterParam(event, 'payeeId'))
    if (!Number.isInteger(payeeId) || payeeId <= 0) {
      throw createError({ status: 400, message: 'Identifiant de bénéficiaire invalide' })
    }

    const resultat = await prisma.treasuryPayee.deleteMany({
      where: { id: payeeId, editionId },
    })

    if (resultat.count === 0) {
      throw createError({ status: 404, message: 'Bénéficiaire introuvable pour cette édition' })
    }

    return createSuccessResponse({ payees: await listerBeneficiaires(editionId) })
  },
  { operationName: 'DeleteTreasuryPayee' }
)
