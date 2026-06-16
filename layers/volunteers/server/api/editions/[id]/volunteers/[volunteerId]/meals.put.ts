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
      message: 'Droits insuffisants pour modifier ces données',
    })

  const body = await readBody(event)

  if (!body.selections || !Array.isArray(body.selections)) {
    throw createError({
      status: 400,
      message: 'Sélections de repas invalides',
    })
  }

  // Étape 1bis : création/MAJ des sélections du bénévole déléguée au module repas.
  const meals = await useVolunteerPorts().meals.setVolunteerMeals(
    editionId,
    volunteerId,
    body.selections
  )

  return createSuccessResponse({ meals })
}, 'UpdateVolunteerMealsByVolunteerId')
