import { prisma } from '@@/server/utils/prisma'

/**
 * Route publique pour récupérer les tarifs actifs d'une édition
 * Utilisée pour le SEO (Schema.org)
 */
export default defineEventHandler(async (event) => {
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  try {
    const tiers = await prisma.ticketingTier.findMany({
      where: {
        editionId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        position: true,
      },
      orderBy: [{ position: 'asc' }, { price: 'desc' }],
    })

    return tiers
  } catch (error: unknown) {
    console.error('Failed to fetch public tiers from DB:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des tarifs',
    })
  }
})
