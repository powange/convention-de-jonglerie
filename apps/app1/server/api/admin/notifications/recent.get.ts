import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler, createPaginatedResponse } from '#server/utils/api-helpers'
import { validatePagination } from '#server/utils/validation-helpers'

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
export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (mutualisé)
    await requireGlobalAdminWithDbCheck(event)
    // Récupérer les paramètres depuis la query string
    const { page, limit, skip } = validatePagination(event)
    const query = getQuery(event)

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
            emailHash: true,
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
      // Ancien système (rétrocompatibilité)
      title: notification.title,
      message: notification.message,
      // Système de traduction (notifications système)
      titleKey: notification.titleKey,
      messageKey: notification.messageKey,
      translationParams: notification.translationParams,
      actionTextKey: notification.actionTextKey,
      // Texte libre (notifications custom/orgas)
      titleText: notification.titleText,
      messageText: notification.messageText,
      actionText: notification.actionText,
      isRead: notification.isRead,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      actionUrl: notification.actionUrl,
      user: {
        id: notification.user.id,
        emailHash: notification.user.emailHash,
        pseudo: notification.user.pseudo,
        nom: notification.user.nom,
        prenom: notification.user.prenom,
        email: notification.user.email,
        profilePicture: notification.user.profilePicture,
      },
    }))

    return createPaginatedResponse(formattedNotifications, total, page, limit)
  },
  { operationName: 'GetRecentNotifications' }
)
