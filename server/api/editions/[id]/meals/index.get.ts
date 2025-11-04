import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionDataOrMealValidation } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = parseInt(getRouterParam(event, 'id') || '0')

    if (!editionId) {
      throw createError({ statusCode: 400, message: 'Edition invalide' })
    }

    const allowed = await canAccessEditionDataOrMealValidation(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        statusCode: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })
    }

    const meals = await prisma.volunteerMeal.findMany({
      where: { editionId },
      orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
    })

    return {
      success: true,
      meals,
    }
  },
  { operationName: 'GetEditionMeals' }
)
