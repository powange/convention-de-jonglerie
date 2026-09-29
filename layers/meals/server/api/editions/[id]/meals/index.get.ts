import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageMealsOrValidation } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageMealsOrValidation(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })
    }

    /*
     * Seuls les repas ACTIVÉS : le seul consommateur est l'écran de validation au comptoir, et un
     * repas décoché est un repas que la cuisine ne prépare pas. Il n'a donc rien à faire dans les
     * flèches jour/type, qui le désignaient jusqu'ici comme n'importe quel autre.
     *
     * La page de CONFIGURATION, elle, doit continuer à voir les repas désactivés pour pouvoir les
     * réactiver — mais elle ne passe pas par ici : elle lit /api/editions/:id/volunteers/meals.
     */
    const meals = await prisma.volunteerMeal.findMany({
      where: { editionId, enabled: true },
      orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
    })

    return createSuccessResponse({ meals })
  },
  { operationName: 'GetEditionMeals' }
)
