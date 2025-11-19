import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'

export default wrapApiHandler(
  async (event) => {
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
  },
  { operationName: 'GetAdminStats' }
)
