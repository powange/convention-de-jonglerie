import { requireAuth } from '@@/server/utils/auth-utils'
import { deleteOption } from '@@/server/utils/editions/ticketing/options'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const optionId = parseInt(getRouterParam(event, 'optionId') || '0')

  if (!editionId || !optionId)
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à cette fonctionnalité',
    })

  try {
    return await deleteOption(optionId, editionId)
  } catch (error: any) {
    console.error('Delete option error:', error)
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: "Erreur lors de la suppression de l'option",
    })
  }
})
