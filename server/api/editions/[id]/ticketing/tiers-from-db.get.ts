import { canAccessEditionData } from '../../../../utils/edition-permissions'
import { prisma } from '../../../../utils/prisma'

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
    // Récupérer la configuration de billeterie externe
    const config = await prisma.externalTicketing.findUnique({
      where: { editionId },
      include: {
        helloAssoTiers: {
          orderBy: { price: 'asc' },
        },
        helloAssoOptions: {
          orderBy: { name: 'asc' },
        },
      },
    })

    if (!config) {
      return {
        tiers: [],
        options: [],
      }
    }

    return {
      tiers: config.helloAssoTiers,
      options: config.helloAssoOptions,
    }
  } catch (error: any) {
    console.error('Failed to fetch tiers from DB:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des tarifs',
    })
  }
})
