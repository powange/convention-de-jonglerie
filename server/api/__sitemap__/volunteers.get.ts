import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async () => {
  try {
    // Récupérer toutes les éditions publiques avec candidatures bénévoles ouvertes
    const editions = await prisma.edition.findMany({
      where: {
        convention: {
          isArchived: false,
        },
        isOnline: true, // Inclure uniquement les éditions en ligne
        volunteersOpen: true, // Candidatures bénévoles ouvertes
      },
      select: {
        id: true,
        updatedAt: true,
        startDate: true,
        endDate: true,
        _count: {
          select: {
            volunteerApplications: true,
            volunteerTeams: true,
          },
        },
      },
    })

    return editions.map((edition) => {
      // Priorité plus élevée pour les éditions à venir avec candidatures ouvertes
      const now = new Date()
      const isUpcoming = new Date(edition.startDate) > now
      const startDate = new Date(edition.startDate)

      // Calculer la priorité en fonction de la proximité de l'événement et de l'activité
      let priority = 0.5 // Priorité de base pour les pages de bénévolat

      if (isUpcoming) {
        // Calculer les jours restants jusqu'au début
        const daysUntilStart = Math.floor(
          (startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )

        if (daysUntilStart <= 30) {
          priority = 0.9 // Très haute priorité si début dans 30 jours
        } else if (daysUntilStart <= 60) {
          priority = 0.8 // Haute priorité si début dans 60 jours
        } else if (daysUntilStart <= 90) {
          priority = 0.7 // Priorité moyenne pour éditions dans 90 jours
        } else {
          priority = 0.6 // Priorité normale pour éditions plus lointaines
        }
      }

      // Augmenter la priorité s'il y a beaucoup d'équipes ou de candidatures
      if (edition._count.volunteerTeams > 5 || edition._count.volunteerApplications > 20) {
        priority = Math.min(priority + 0.1, 1.0)
      }

      // Fréquence de changement en fonction de la proximité de l'événement
      let changefreq: 'daily' | 'weekly' | 'monthly' = 'weekly'
      if (isUpcoming) {
        const daysUntilStart = Math.floor(
          (startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )
        if (daysUntilStart <= 30) {
          changefreq = 'daily' // Changements quotidiens si début proche
        }
      }

      return {
        loc: `/editions/${edition.id}/volunteers`,
        lastmod: edition.updatedAt.toISOString(),
        changefreq,
        priority,
      }
    })
  } catch (error) {
    console.error('Erreur lors de la génération du sitemap bénévolat:', error)
    return []
  }
})
