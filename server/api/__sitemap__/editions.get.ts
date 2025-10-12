import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async () => {
  try {
    // Récupérer toutes les éditions publiques (convention non archivée, éditions en ligne uniquement)
    const editions = await prisma.edition.findMany({
      where: {
        convention: {
          isArchived: false,
        },
        isOnline: true, // Inclure uniquement les éditions en ligne
      },
      select: {
        id: true,
        updatedAt: true,
        startDate: true,
        endDate: true,
      },
    })

    return editions.map((edition) => {
      // Priorité plus élevée pour les éditions futures et récentes
      const now = new Date()
      const isUpcoming = new Date(edition.startDate) > now
      const isRecent =
        new Date(edition.endDate) > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 jours

      let priority = 0.5
      if (isUpcoming) priority = 0.9
      else if (isRecent) priority = 0.7

      return {
        loc: `/editions/${edition.id}`,
        lastmod: edition.updatedAt.toISOString(),
        changefreq: isUpcoming ? ('weekly' as const) : ('monthly' as const),
        priority,
      }
    })
  } catch (error) {
    console.error('Erreur lors de la génération du sitemap éditions:', error)
    return []
  }
})
