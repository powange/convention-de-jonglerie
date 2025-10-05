import { canAccessEditionData } from '../../../../../utils/edition-permissions'
import { deleteTier } from '../../../../../utils/editions/ticketing/tiers'

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const tierId = parseInt(getRouterParam(event, 'tierId') || '0')

  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })
  if (!tierId) throw createError({ statusCode: 400, message: 'Tarif invalide' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à cette fonctionnalité',
    })

  try {
    return await deleteTier(tierId, editionId)
  } catch (error: any) {
    console.error('Delete tier error:', error)
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la suppression du tarif',
    })
  }
})
