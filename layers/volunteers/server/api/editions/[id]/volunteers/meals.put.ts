import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed)
    throw createError({
      status: 403,
      message: 'Droits insuffisants pour modifier ces données',
    })

  const body = await readBody(event)

  // Valider le body
  if (!body.meals || !Array.isArray(body.meals)) {
    throw createError({
      status: 400,
      message: 'Format de données invalide',
    })
  }
  for (const meal of body.meals) {
    if (meal.handoutItemIds !== undefined && !Array.isArray(meal.handoutItemIds)) {
      throw createError({
        status: 400,
        message: 'handoutItemIds doit être un tableau',
      })
    }
  }

  const ports = useVolunteerPorts()

  // Étape 1bis : config repas + sélections bénévoles + liaisons d'articles déléguées au module repas.
  const { meals, toggles } = await ports.meals.updateEditionMealsConfig(editionId, body.meals)

  // Sélections artistes pilotées via le port artists selon les bascules d'activation des repas.
  await Promise.all(
    toggles.map((t) =>
      t.enabled
        ? ports.artists.addEligibleMealSelections({
            editionId,
            mealId: t.mealId,
            date: t.date,
            mealType: t.mealType,
          })
        : ports.artists.removeMealSelections(t.mealId)
    )
  )

  // Détail du catalogue d'articles résolu via le port ticketing (forme conservée → front inchangé).
  const handoutItemIds = [
    ...new Set(meals.flatMap((m) => m.handoutItems.map((h) => h.handoutItemId))),
  ]
  const handoutCatalog = await ports.ticketing.getHandoutItems(handoutItemIds)
  const mealsWithHandouts = meals.map((m) => ({
    ...m,
    handoutItems: m.handoutItems.map((h) => ({
      ...h,
      handoutItem: handoutCatalog[h.handoutItemId] ?? null,
    })),
  }))

  return createSuccessResponse({ meals: mealsWithHandouts })
}, 'UpdateVolunteerMeals')
