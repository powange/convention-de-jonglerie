import { canAccessEditionData } from '../../../../../utils/edition-permissions'
import { getReturnableItems } from '../../../../../utils/editions/ticketing/returnable-items'

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à ces données',
    })

  try {
    return await getReturnableItems(editionId)
  } catch (error: any) {
    console.error('Failed to fetch returnable items:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des items à restituer',
    })
  }
})
