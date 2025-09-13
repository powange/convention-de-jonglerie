import { requireGlobalAdminWithDbCheck } from '../../utils/admin-auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    // Vérifier l'authentification et les droits admin (mutualisé)
    await requireGlobalAdminWithDbCheck(event)

    // Calculer les dates pour les statistiques mensuelles
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Récupérer toutes les statistiques en parallèle
    const [
      totalUsers,
      newUsersThisMonth,
      totalConventions,
      newConventionsThisMonth,
      totalEditions,
      newEditionsThisMonth,
      totalAdmins,
      unresolvedFeedbacks,
      unresolvedErrorLogs,
    ] = await Promise.all([
      // Total utilisateurs
      prisma.user.count(),

      // Nouveaux utilisateurs ce mois
      prisma.user.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
      }),

      // Total conventions
      prisma.convention.count(),

      // Nouvelles conventions ce mois
      prisma.convention.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
      }),

      // Total éditions
      prisma.edition.count(),

      // Nouvelles éditions ce mois
      prisma.edition.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
      }),

      // Total super administrateurs
      prisma.user.count({
        where: {
          isGlobalAdmin: true,
        },
      }),

      // Feedbacks non résolus
      prisma.feedback.count({
        where: {
          resolved: false,
        },
      }),

      // Logs d'erreur non résolus
      prisma.apiErrorLog.count({
        where: {
          resolved: false,
        },
      }),
    ])

    return {
      totalUsers,
      newUsersThisMonth,
      totalConventions,
      newConventionsThisMonth,
      totalEditions,
      newEditionsThisMonth,
      totalAdmins,
      unresolvedFeedbacks,
      unresolvedErrorLogs,
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur interne du serveur',
    })
  }
})
