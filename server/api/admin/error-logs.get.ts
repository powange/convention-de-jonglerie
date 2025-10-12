import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { prisma } from '@@/server/utils/prisma'

const DEFAULT_PAGE_SIZE = 20

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification et les droits admin (mutualisé)
  await requireGlobalAdminWithDbCheck(event)

  const query = getQuery(event)

  // Paramètres de pagination
  const page = Math.max(1, parseInt((query.page as string) || '1'))
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt((query.pageSize as string) || `${DEFAULT_PAGE_SIZE}`))
  )

  // Paramètres de filtrage
  const statusFilter = query.status as string | undefined // 'resolved' | 'unresolved'
  const errorTypeFilter = query.errorType as string | undefined
  const pathFilter = query.path as string | undefined
  const userIdFilter = query.userId ? parseInt(query.userId as string) : undefined
  const search = (query.search as string)?.trim()

  // Paramètres de tri
  const sortField = (query.sortField as string) || 'createdAt'
  const sortDir = (query.sortDir as string) === 'asc' ? 'asc' : 'desc'

  // Construction des filtres WHERE
  const conditions: any[] = []

  // Filtre par statut de résolution
  if (statusFilter === 'resolved') {
    conditions.push({ resolved: true })
  } else if (statusFilter === 'unresolved') {
    conditions.push({ resolved: false })
  }

  // Filtre par type d'erreur
  if (errorTypeFilter) {
    conditions.push({ errorType: errorTypeFilter })
  }

  // Filtre par chemin d'API
  if (pathFilter) {
    conditions.push({ path: { contains: pathFilter } })
  }

  // Filtre par utilisateur
  if (userIdFilter) {
    conditions.push({ userId: userIdFilter })
  }

  // Recherche textuelle dans le message d'erreur
  if (search) {
    conditions.push({
      OR: [
        { message: { contains: search } },
        { path: { contains: search } },
        { errorType: { contains: search } },
      ],
    })
  }

  const where =
    conditions.length === 1 ? conditions[0] : conditions.length > 1 ? { AND: conditions } : {}

  // Comptage total pour la pagination
  const total = await prisma.apiErrorLog.count({ where })

  // Configuration du tri
  const orderBy: any = {}
  if (sortField === 'createdAt') {
    orderBy.createdAt = sortDir
  } else if (sortField === 'statusCode') {
    orderBy.statusCode = sortDir
  } else if (sortField === 'errorType') {
    orderBy.errorType = sortDir
  } else if (sortField === 'path') {
    orderBy.path = sortDir
  } else {
    orderBy.createdAt = 'desc' // Par défaut
  }

  // Récupération des logs avec pagination
  const errorLogs = await prisma.apiErrorLog.findMany({
    where,
    orderBy,
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      message: true,
      statusCode: true,
      errorType: true,
      method: true,
      path: true,
      userAgent: true,
      ip: true,
      resolved: true,
      resolvedBy: true,
      resolvedAt: true,
      adminNotes: true,
      createdAt: true,
      updatedAt: true,
      // Données utilisateur si disponible
      user: {
        select: {
          id: true,
          pseudo: true,
          email: true,
        },
      },
      // Inclure certaines métadonnées utiles sans exposer les données sensibles
      queryParams: true,
      headers: false, // Pas dans la liste par défaut (trop verbeux)
      body: false, // Pas dans la liste par défaut (peut être sensible)
      stack: false, // Pas dans la liste par défaut (très verbeux)
    },
  })

  // Statistiques rapides pour le dashboard
  const stats = await prisma.apiErrorLog.aggregate({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Dernières 24h
      },
    },
    _count: {
      id: true,
    },
  })

  const unresolvedCount = await prisma.apiErrorLog.count({
    where: { resolved: false },
  })

  // Statistiques par type d'erreur (dernières 24h)
  const errorTypeStats = await prisma.apiErrorLog.groupBy({
    by: ['errorType'],
    where: {
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
    _count: {
      id: true,
    },
    orderBy: {
      _count: {
        id: 'desc',
      },
    },
    take: 10,
  })

  // Erreurs par code de statut (dernières 24h)
  const statusCodeStats = await prisma.apiErrorLog.groupBy({
    by: ['statusCode'],
    where: {
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
    _count: {
      id: true,
    },
    orderBy: {
      _count: {
        id: 'desc',
      },
    },
    take: 10,
  })

  return {
    logs: errorLogs,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    stats: {
      totalLast24h: stats._count.id,
      unresolvedCount,
      errorTypes: errorTypeStats.map((stat) => ({
        type: stat.errorType || 'Unknown',
        count: stat._count.id,
      })),
      statusCodes: statusCodeStats.map((stat) => ({
        code: stat.statusCode,
        count: stat._count.id,
      })),
    },
  }
})
