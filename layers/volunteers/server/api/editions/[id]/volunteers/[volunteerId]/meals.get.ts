import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)
  const volunteerId = validateResourceId(event, 'volunteerId')

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed)
    throw createError({
      status: 403,
      message: 'Droits insuffisants pour accéder à ces données',
    })

  // Étape 1bis : repas du bénévole (sélections + éligibilité) délégués au module repas.
  const meals = await useVolunteerPorts().meals.getVolunteerMeals(editionId, volunteerId)

  return createSuccessResponse({ meals })
}, 'GetVolunteerMealsByVolunteerId')
