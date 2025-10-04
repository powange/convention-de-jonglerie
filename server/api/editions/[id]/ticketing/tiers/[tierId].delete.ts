import { canAccessEditionData } from '../../../../../utils/edition-permissions'
import { prisma } from '../../../../../utils/prisma'

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
    // Vérifier que le tarif existe et appartient à cette édition
    const existingTier = await prisma.helloAssoTier.findFirst({
      where: {
        id: tierId,
        editionId,
      },
    })

    if (!existingTier) {
      throw createError({
        statusCode: 404,
        message: 'Tarif introuvable',
      })
    }

    // Vérifier que ce n'est pas un tarif HelloAsso (non supprimable)
    if (existingTier.helloAssoTierId !== null) {
      throw createError({
        statusCode: 403,
        message: 'Impossible de supprimer un tarif synchronisé depuis HelloAsso',
      })
    }

    await prisma.helloAssoTier.delete({
      where: { id: tierId },
    })

    return {
      success: true,
      message: 'Tarif supprimé avec succès',
    }
  } catch (error: any) {
    console.error('Delete tier error:', error)
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la suppression du tarif',
    })
  }
})
