import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import { listerBeneficiaires, MAX_BENEFICIAIRES_PAR_EDITION } from '#server/utils/treasury-payees'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Le carnet des bénéficiaires d'une édition.
 *
 * ⚠️ Gardé par `canManageTreasuryById` et par rien d'autre. Ce point d'API rend des IBAN : il doit
 * être exactement aussi fermé que les montants de la trésorerie qu'il accompagne. Les coordonnées
 * bancaires des artistes suivent la même règle — seule la gestion de leur module les voit.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageTreasuryById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants pour gérer la trésorerie' })
    }

    return createSuccessResponse({
      payees: await listerBeneficiaires(editionId),
      // Rendue à l'écran pour qu'il sache quand désactiver son bouton d'ajout, plutôt que de
      // laisser l'organisateur découvrir la limite en se faisant refuser sa saisie.
      max: MAX_BENEFICIAIRES_PAR_EDITION,
    })
  },
  { operationName: 'ListTreasuryPayees' }
)
