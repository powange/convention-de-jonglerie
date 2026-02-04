import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessMealValidation } from '#server/utils/permissions/meal-validation-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Endpoint pour vérifier si un utilisateur peut accéder à la validation des repas
 * (leader d'équipe de validation ou bénévole en créneau actif)
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    try {
      const hasAccess = await canAccessMealValidation(user.id, editionId)

      return {
        canAccess: hasAccess,
      }
    } catch (error: unknown) {
      console.error('Erreur lors de la vérification des permissions:', error)
      return {
        canAccess: false,
      }
    }
  },
  { operationName: 'CheckMealValidationAccess' }
)
