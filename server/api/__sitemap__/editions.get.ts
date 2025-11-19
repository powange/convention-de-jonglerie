import { wrapApiHandler } from '@@/server/utils/api-helpers'

export default wrapApiHandler(
  async () => {
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

    const urls: Array<{
      loc: string
      lastmod: string
      changefreq: 'weekly' | 'monthly'
      priority: number
    }> = []

    editions.forEach((edition) => {
      // Priorité plus élevée pour les éditions futures et récentes
      const now = new Date()
      const isUpcoming = new Date(edition.startDate) > now
      const isRecent =
        new Date(edition.endDate) > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 jours

      let priority = 0.5
      if (isUpcoming) priority = 0.9
      else if (isRecent) priority = 0.7

      const changefreq = isUpcoming ? ('weekly' as const) : ('monthly' as const)
      const lastmod = edition.updatedAt.toISOString()

      // Page principale de l'édition
      urls.push({
        loc: `/editions/${edition.id}`,
        lastmod,
        changefreq,
        priority,
      })

      // Page des commentaires
      urls.push({
        loc: `/editions/${edition.id}/commentaires`,
        lastmod,
        changefreq,
        priority: priority * 0.8,
      })

      // Page du covoiturage
      urls.push({
        loc: `/editions/${edition.id}/carpool`,
        lastmod,
        changefreq,
        priority: priority * 0.7,
      })

      // Page des objets trouvés (seulement si l'édition a commencé)
      const hasStarted = new Date(edition.startDate) <= now
      if (hasStarted) {
        urls.push({
          loc: `/editions/${edition.id}/lost-found`,
          lastmod,
          changefreq,
          priority: priority * 0.6,
        })
      }
    })

    return urls
  },
  { operationName: 'GenerateEditionsSitemap' }
)
