import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

/**
 * Programmation des spectacles, telle qu'il faut la connaître pour repérer les bénévoles dont
 * les créneaux couvrent toutes les représentations.
 *
 * L'endpoint des spectacles de la gestion artistes ne convient pas ici : il exige les droits
 * « artistes » ou « billetterie », que le responsable des bénévoles n'a pas nécessairement, et
 * il expose bien plus que des horaires (besoins techniques, distribution, candidatures).
 */
export default wrapApiHandler(async (event) => {
  await requireAuth(event)
  const editionId = validateEditionId(event)

  await useVolunteerPorts().organizers.requireManagementAccess(event, editionId)

  const shows = await useVolunteerPorts().artists.getShowSchedule(editionId)

  return { success: true, data: shows }
})
