import { wrapApiHandler } from '@@/server/utils/api-helpers'

export default wrapApiHandler(
  async () => {
    // Récupérer toutes les éditions publiques avec covoiturage actif
    const editions = await prisma.edition.findMany({
      where: {
        convention: {
          isArchived: false,
        },
        status: 'PUBLISHED', // Inclure uniquement les éditions publiées
      },
      select: {
        id: true,
        updatedAt: true,
        startDate: true,
        endDate: true,
        _count: {
          select: {
            carpoolOffers: true,
            carpoolRequests: true,
          },
        },
      },
    })

    return editions.map((edition) => {
      // Priorité plus élevée pour les éditions avec beaucoup de covoiturages
      const now = new Date()
      const isUpcoming = new Date(edition.startDate) > now
      const isRecent =
        new Date(edition.endDate) > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 jours

      // Calculer la priorité en fonction de l'activité de covoiturage
      const carpoolActivity = edition._count.carpoolOffers + edition._count.carpoolRequests
      let priority = 0.4 // Priorité de base pour les pages de covoiturage

      if (isUpcoming && carpoolActivity > 5) priority = 0.8
      else if (isUpcoming) priority = 0.6
      else if (isRecent && carpoolActivity > 0) priority = 0.5

      // Fréquence de changement plus élevée pour les éditions à venir
      const changefreq = isUpcoming ? ('daily' as const) : ('weekly' as const)

      return {
        loc: `/editions/${edition.id}/carpool`,
        lastmod: edition.updatedAt.toISOString(),
        changefreq,
        priority,
      }
    })
  },
  { operationName: 'GenerateCarpoolSitemap' }
)
