import { requireAuth } from '@@/server/utils/auth-utils'
import {
  getActiveAccessControlSlot,
  isActiveAccessControlVolunteer,
} from '@@/server/utils/permissions/access-control-permissions'

export default defineEventHandler(async (event) => {
  // Authentification requise
  const user = requireAuth(event)

  // Validation des paramètres
  const editionId = parseInt(getRouterParam(event, 'id') as string)

  if (!editionId || isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      message: "ID d'édition invalide",
    })
  }

  try {
    // Vérifier si l'utilisateur est actuellement en créneau de contrôle d'accès
    const isActive = await isActiveAccessControlVolunteer(user.id, editionId)

    // Récupérer les détails du créneau actif si applicable
    const activeSlot = isActive ? await getActiveAccessControlSlot(user.id, editionId) : null

    return {
      isActive,
      activeSlot,
    }
  } catch (error) {
    console.error("Erreur lors de la vérification du statut de contrôle d'accès:", error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la vérification du statut',
    })
  }
})
