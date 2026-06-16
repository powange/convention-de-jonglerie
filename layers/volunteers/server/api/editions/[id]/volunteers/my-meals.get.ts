import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)

  // Étape 1bis : repas éligibles du bénévole (auto-création des sélections) délégués au module repas.
  const meals = await useVolunteerPorts().meals.getVolunteerSelfMeals(editionId, user.id)

  return createSuccessResponse({ meals })
}, 'GetMyVolunteerMeals')
