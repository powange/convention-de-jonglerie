import { requireGlobalAdminWithDbCheck } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    // Vérifier l'authentification et les droits admin (mutualisé)
    await requireGlobalAdminWithDbCheck(event)

    // Récupérer les paramètres de requête pour la pagination et le filtrage
    const query = getQuery(event)
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 20
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

    // Calculer l'offset pour la pagination
    const offset = (page - 1) * limit

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
          createdAt: true,
          updatedAt: true,
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
            : sortBy === 'email'
              ? { email: sortOrder }
              : sortBy === 'nom'
                ? { nom: sortOrder }
                : { createdAt: sortOrder },
        skip: offset,
        take: limit,
      }),
      prisma.user.count({
        where: searchConditions,
      }),
    ])

    // Calculer les métadonnées de pagination
    const totalPages = Math.ceil(totalCount / limit)
    const hasNextPage = page < totalPages
    const hasPrevPage = page > 1

    return {
      users,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
      filters: {
        search,
        sortBy,
        sortOrder,
      },
    }
  } catch (error: unknown) {
    console.error('Erreur lors de la récupération des utilisateurs:', error)
    const err = error as { message?: string; stack?: string; code?: unknown; statusCode?: number }
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      code: err.code,
    })

    if (err.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: `Erreur interne du serveur: ${err.message}`,
    })
  }
})
