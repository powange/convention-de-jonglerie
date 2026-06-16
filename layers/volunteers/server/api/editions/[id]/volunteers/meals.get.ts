import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })

    const ports = useVolunteerPorts()

    // Étape 1bis : planning des repas (réconciliation montage→démontage) délégué au module repas.
    const meals = await ports.meals.getEditionMealSchedule(editionId)

    // Détail du catalogue d'articles à remettre (TicketingHandoutItem) résolu via le port ticketing,
    // ré-attaché à chaque liaison (forme `handoutItems[].handoutItem` conservée → front inchangé).
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
  },
  { operationName: 'GetVolunteerMeals' }
)
