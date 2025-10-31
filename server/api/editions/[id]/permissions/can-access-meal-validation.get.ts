import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessMealValidation } from '@@/server/utils/permissions/meal-validation-permissions'

/**
 * Endpoint pour vérifier si un utilisateur peut accéder à la validation des repas
 * (leader d'équipe de validation ou bénévole en créneau actif)
 */
export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = parseInt(getRouterParam(event, 'id') || '0')

  if (!editionId) {
    throw createError({ statusCode: 400, message: 'Edition invalide' })
  }

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
})
