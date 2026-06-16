import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)
  const body = await readBody(event)

  // Valider le body
  if (!body.selections || !Array.isArray(body.selections)) {
    throw createError({
      status: 400,
      message: 'Format de données invalide',
    })
  }

  // Étape 1bis : mise à jour des acceptations déléguée au module repas.
  const meals = await useVolunteerPorts().meals.setVolunteerSelfMealAcceptances(
    editionId,
    user.id,
    body.selections
  )

  return createSuccessResponse({ meals })
}, 'UpdateMyVolunteerMeals')
