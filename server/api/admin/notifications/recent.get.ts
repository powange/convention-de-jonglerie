import { requireGlobalAdminWithDbCheck } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

/**
 * API Admin - Récupérer les notifications récentes
 * GET /api/admin/notifications/recent
 *
 * Retourne les notifications récentes (derniers 30 jours par défaut) avec pagination
 *
 * Query params:
 * - page: numéro de page (défaut: 1)
 * - limit: nombre d'items par page (défaut: 10, max: 100)
 * - category: filtrer par catégorie (optionnel)
 * - type: filtrer par type (INFO, SUCCESS, WARNING, ERROR)
 * - days: nombre de jours à récupérer (défaut: 30)
 */
export default defineEventHandler(async (event) => {
  // Vérifier l'authentification et les droits admin (mutualisé)
  await requireGlobalAdminWithDbCheck(event)

  try {
    // Récupérer les paramètres depuis la query string
    const query = getQuery(event)
    const page = Math.max(1, parseInt(query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 10))
    const skip = (page - 1) * limit

    // Filtres optionnels
    const category = query.category as string | undefined
    const type = query.type as string | undefined
    const days = Math.max(1, parseInt(query.days as string) || 30)

    // Définir les critères pour les "notifications récentes"
    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - days)

    const whereClause: any = {
      createdAt: {
        gte: daysAgo,
      },
    }

    // Ajouter les filtres optionnels
    if (category) {
      whereClause.category = category
    }

    if (type) {
      whereClause.type = type
    }

    // Récupérer le nombre total de notifications récentes
    const total = await prisma.notification.count({
      where: whereClause,
    })

    // Récupérer les notifications récentes paginées avec les infos utilisateur
    const notifications = await prisma.notification.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            pseudo: true,
            nom: true,
            prenom: true,
            profilePicture: true,
          },
        },
      },
    })

    // Formatter les données pour l'affichage
    const formattedNotifications = notifications.map((notification) => ({
      id: notification.id,
      type: notification.type,
      category: notification.category,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      actionUrl: notification.actionUrl,
      actionText: notification.actionText,
      user: {
        id: notification.user.id,
        email: notification.user.email,
        pseudo: notification.user.pseudo,
        name:
          `${notification.user.prenom || ''} ${notification.user.nom || ''}`.trim() ||
          notification.user.pseudo ||
          notification.user.email,
        profilePictureUrl: notification.user.profilePicture,
      },
    }))

    return {
      notifications: formattedNotifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  } catch (error) {
    console.error('[Admin] Erreur récupération notifications récentes:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des notifications récentes',
    })
  }
})
