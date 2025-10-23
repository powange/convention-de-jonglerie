import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const customFieldId = parseInt(getRouterParam(event, 'customFieldId') || '0')

  if (!editionId || !customFieldId)
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à cette fonctionnalité',
    })

  try {
    // Vérifier que le custom field existe et appartient à l'édition
    const customField = await prisma.ticketingTierCustomField.findFirst({
      where: {
        id: customFieldId,
        editionId,
      },
    })

    if (!customField) {
      throw createError({
        statusCode: 404,
        message: 'Custom field introuvable',
      })
    }

    // Vérifier qu'il ne vient pas de HelloAsso (non supprimable)
    if (customField.helloAssoCustomFieldId !== null) {
      throw createError({
        statusCode: 403,
        message: 'Les custom fields synchronisés depuis HelloAsso ne peuvent pas être supprimés',
      })
    }

    // Supprimer le custom field (les associations seront supprimées automatiquement grâce à onDelete: Cascade)
    await prisma.ticketingTierCustomField.delete({
      where: { id: customFieldId },
    })

    return {
      success: true,
      message: 'Custom field supprimé avec succès',
    }
  } catch (error: unknown) {
    console.error('Erreur lors de la suppression du custom field:', error)
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la suppression du custom field',
    })
  }
})
