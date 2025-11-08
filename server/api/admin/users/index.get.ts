import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler, createPaginatedResponse } from '@@/server/utils/api-helpers'
import { notificationStreamManager } from '@@/server/utils/notification-stream-manager'
import { prisma } from '@@/server/utils/prisma'
import { validatePagination } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (mutualisé)
    await requireGlobalAdminWithDbCheck(event)

    // Récupérer les paramètres de requête pour la pagination et le filtrage
    const { page, limit, skip } = validatePagination(event)
    const query = getQuery(event)
    const search = (query.search as string) || ''
    const sortBy = (query.sortBy as string) || 'createdAt'
    const sortOrder = (query.sortOrder as string) === 'asc' ? 'asc' : 'desc'

    // Construire les conditions de recherche et de filtrage
    const searchConditions: Record<string, unknown> = {}

    // Filtrage par recherche textuelle
    if (search) {
      searchConditions.OR = [
        { email: { contains: search } },
        { pseudo: { contains: search } },
        { nom: { contains: search } },
        { prenom: { contains: search } },
      ]
    }

    // Filtrage par statut admin
    const adminFilter = (query.adminFilter as string) || 'all'
    if (adminFilter === 'admins') {
      searchConditions.isGlobalAdmin = true
    } else if (adminFilter === 'users') {
      searchConditions.isGlobalAdmin = false
    }

    // Filtrage par email vérifié
    const emailFilter = (query.emailFilter as string) || 'all'
    if (emailFilter === 'verified') {
      searchConditions.isEmailVerified = true
    } else if (emailFilter === 'unverified') {
      searchConditions.isEmailVerified = false
    }

    // Filtrage par utilisateurs en ligne uniquement
    const onlineOnly = query.onlineOnly === 'true'

    // Récupérer les connexions actives SSE
    const activeConnections = notificationStreamManager.getStats()
    const activeUserIds = activeConnections.connectionsByUser.map((conn) => conn.userId)

    // Ajouter le filtre pour les utilisateurs en ligne si demandé
    if (onlineOnly && activeUserIds.length > 0) {
      searchConditions.id = { in: activeUserIds }
    } else if (onlineOnly && activeUserIds.length === 0) {
      // Si on demande seulement les utilisateurs en ligne mais qu'il n'y en a aucun,
      // on retourne une condition impossible pour avoir un résultat vide
      searchConditions.id = { equals: -1 }
    }

    // Récupérer les utilisateurs avec pagination
    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where: searchConditions,
        select: {
          id: true,
          email: true,
          pseudo: true,
          nom: true,
          prenom: true,
          isEmailVerified: true,
          isGlobalAdmin: true,
          authProvider: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          profilePicture: true,
          _count: {
            select: {
              createdConventions: true,
              createdEditions: true,
              favoriteEditions: true,
            },
          },
        },
        orderBy:
          sortBy === 'createdAt'
            ? { createdAt: sortOrder }
            : sortBy === 'lastLoginAt'
              ? { lastLoginAt: sortOrder }
              : sortBy === 'email'
                ? { email: sortOrder }
                : sortBy === 'nom'
                  ? { nom: sortOrder }
                  : { createdAt: sortOrder },
        skip,
        take: limit,
      }),
      prisma.user.count({
        where: searchConditions,
      }),
    ])

    // Ajouter le statut de connexion à chaque utilisateur
    const usersWithConnectionStatus = users.map((user) => ({
      ...user,
      isConnected: activeUserIds.includes(user.id),
    }))

    const paginatedResponse = createPaginatedResponse(
      usersWithConnectionStatus,
      totalCount,
      page,
      limit
    )

    return {
      users: paginatedResponse.data,
      pagination: paginatedResponse.pagination,
      filters: {
        search,
        sortBy,
        sortOrder,
      },
      connectionStats: {
        totalActiveConnections: activeConnections.totalConnections,
        totalActiveUsers: activeConnections.activeUsers,
      },
    }
  },
  { operationName: 'GetAdminUsers' }
)
