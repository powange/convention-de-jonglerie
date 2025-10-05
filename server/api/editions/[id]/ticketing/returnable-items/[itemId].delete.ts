import { deleteReturnableItem } from '../../../../../utils/editions/ticketing/returnable-items'
import { canAccessEditionData } from '../../../../../utils/permissions/edition-permissions'

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const itemId = parseInt(getRouterParam(event, 'itemId') || '0')

  if (!editionId || !itemId) {
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })
  }

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour modifier ces données',
    })

  try {
    return await deleteReturnableItem(itemId, editionId)
  } catch (error: any) {
    console.error('Failed to delete returnable item:', error)
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: "Erreur lors de la suppression de l'item à restituer",
    })
  }
})
