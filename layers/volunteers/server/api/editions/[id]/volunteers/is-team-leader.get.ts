import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { equipesDontIlEstResponsable } from '#server/utils/editions/volunteers/responsables-equipe'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Vérifie si l'utilisateur connecté est responsable d'au moins une équipe de bénévoles pour cette édition
 * Renvoie true si l'utilisateur est leader d'au moins une équipe, false sinon
 */
export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)

  // Bénévole responsable ou organisateur responsable : les deux titres se valent ici.
  const teamIds = await equipesDontIlEstResponsable(editionId, user.id)

  return createSuccessResponse({
    isTeamLeader: teamIds.length > 0,
  })
}, { operationName: 'IsVolunteerTeamLeader' })
