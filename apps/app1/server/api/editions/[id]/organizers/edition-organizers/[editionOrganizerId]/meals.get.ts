import { requireAuth } from '#server/utils/auth-utils'
import { infosAlimentaires, infosPersonnellesSelect } from '#server/utils/infos-personnelles'
import { canManageMealsById } from '#server/utils/permissions/edition-permissions'

/**
 * Repas d'un organisateur présent sur l'édition.
 *
 * Un organisateur a accès par défaut à TOUS les repas activés de l'édition : les lignes
 * OrganizerMealSelection ne stockent que les exceptions (`accepted: false`) et les
 * consommations. L'absence de ligne vaut donc « accepté ».
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)
    const editionOrganizerId = validateResourceId(event, 'editionOrganizerId', 'organisateur')

    const allowed = await canManageMealsById(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour gérer les repas',
      })
    }

    const editionOrganizer = await prisma.editionOrganizer.findFirst({
      where: { id: editionOrganizerId, editionId },
      select: {
        id: true,
        organizer: { select: { user: { select: infosPersonnellesSelect } } },
      },
    })

    if (!editionOrganizer) {
      throw createError({
        status: 404,
        message: 'Organisateur introuvable sur cette édition',
      })
    }

    const meals = await prisma.volunteerMeal.findMany({
      where: { editionId, enabled: true },
      orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
    })

    const selections = await prisma.organizerMealSelection.findMany({
      where: { editionOrganizerId, mealId: { in: meals.map((m) => m.id) } },
    })
    const selectionsByMealId = new Map(selections.map((s) => [s.mealId, s]))

    return createSuccessResponse({
      meals: meals.map((meal) => {
        const selection = selectionsByMealId.get(meal.id)
        return {
          id: meal.id,
          date: meal.date,
          mealType: meal.mealType,
          phases: meal.phases,
          accepted: selection?.accepted ?? true,
          consumedAt: selection?.consumedAt ?? null,
        }
      }),
      // Le profil fait foi ; la ligne d'organisateur ne sert que de repli.
      ...infosAlimentaires(editionOrganizer.organizer?.user as never),
    })
  },
  { operationName: 'GetOrganizerMeals' }
)
