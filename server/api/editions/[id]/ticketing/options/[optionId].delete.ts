import { canAccessEditionData } from '../../../../../utils/edition-permissions'
import { prisma } from '../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const optionId = parseInt(getRouterParam(event, 'optionId') || '0')

  if (!editionId || !optionId)
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à cette fonctionnalité',
    })

  try {
    // Vérifier que l'option existe et appartient bien à l'édition
    const existingOption = await prisma.helloAssoOption.findFirst({
      where: {
        id: optionId,
        editionId,
      },
    })

    if (!existingOption) {
      throw createError({
        statusCode: 404,
        message: 'Option non trouvée',
      })
    }

    // Ne pas permettre la suppression d'une option HelloAsso
    if (existingOption.helloAssoOptionId !== null) {
      throw createError({
        statusCode: 400,
        message: 'Les options HelloAsso ne peuvent pas être supprimées',
      })
    }

    await prisma.helloAssoOption.delete({
      where: { id: optionId },
    })

    return {
      success: true,
    }
  } catch (error: any) {
    console.error('Delete option error:', error)
    throw createError({
      statusCode: 500,
      message: "Erreur lors de la suppression de l'option",
    })
  }
})
