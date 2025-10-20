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
        volunteerApplicationsOpen: true, // Candidatures bénévoles ouvertes
      },
      select: {
        id: true,
        updatedAt: true,
        startDate: true,
        endDate: true,
        volunteerApplicationDeadline: true,
        _count: {
          select: {
            volunteerApplications: true,
            volunteerTeams: true,
          },
        },
      },
    })

    return editions.map((edition) => {
      // Priorité plus élevée pour les éditions avec deadline proche
      const now = new Date()
      const isUpcoming = new Date(edition.startDate) > now
      const deadline = edition.volunteerApplicationDeadline
        ? new Date(edition.volunteerApplicationDeadline)
        : null

      // Calculer la priorité en fonction de la deadline et de l'activité
      let priority = 0.5 // Priorité de base pour les pages de bénévolat

      if (deadline && deadline > now) {
        // Calculer les jours restants jusqu'à la deadline
        const daysUntilDeadline = Math.floor(
          (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )

        if (daysUntilDeadline <= 7) {
          priority = 0.9 // Très haute priorité si deadline dans 7 jours
        } else if (daysUntilDeadline <= 30) {
          priority = 0.8 // Haute priorité si deadline dans 30 jours
        } else if (isUpcoming) {
          priority = 0.7 // Priorité moyenne pour éditions à venir
        }
      } else if (isUpcoming) {
        priority = 0.6 // Priorité moyenne si pas de deadline mais édition à venir
      }

      // Augmenter la priorité s'il y a beaucoup d'équipes
      if (edition._count.volunteerTeams > 5) {
        priority = Math.min(priority + 0.1, 1.0)
      }

      // Fréquence de changement en fonction de la deadline
      let changefreq: 'daily' | 'weekly' | 'monthly' = 'weekly'
      if (deadline && deadline > now) {
        const daysUntilDeadline = Math.floor(
          (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )
        if (daysUntilDeadline <= 14) {
          changefreq = 'daily' // Changements quotidiens près de la deadline
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
