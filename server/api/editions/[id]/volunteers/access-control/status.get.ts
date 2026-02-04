import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  getActiveAccessControlSlot,
  isActiveAccessControlVolunteer,
} from '#server/utils/permissions/access-control-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(async (event) => {
  // Authentification requise
  const user = requireAuth(event)
  const editionId = validateEditionId(event)

  // Vérifier si l'utilisateur est actuellement en créneau de contrôle d'accès
  const isActive = await isActiveAccessControlVolunteer(user.id, editionId)

  // Récupérer les détails du créneau actif si applicable
  const activeSlot = isActive ? await getActiveAccessControlSlot(user.id, editionId) : null

  return {
    isActive,
    activeSlot,
  }
}, 'GetVolunteerAccessControlStatus')
