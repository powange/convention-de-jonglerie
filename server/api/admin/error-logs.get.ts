import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler, createPaginatedResponse } from '#server/utils/api-helpers'
import { validatePagination } from '#server/utils/validation-helpers'

const DEFAULT_PAGE_SIZE = 20

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (mutualisé)
    await requireGlobalAdminWithDbCheck(event)

    const query = getQuery(event)

    // Paramètres de pagination
    // Support pour pagination par curseur (plus performant) ET pagination classique (rétrocompatibilité)
    const cursor = (query.cursor as string) || undefined // ID du dernier log de la page précédente

    // Utiliser validatePagination seulement si on n'utilise pas le curseur
    const pagination = cursor ? null : validatePagination(event)
    const page = pagination?.page
    const pageSize = pagination?.limit || DEFAULT_PAGE_SIZE

    // Paramètres de filtrage
    const statusFilter = query.status as string | undefined // 'resolved' | 'unresolved'
    const errorTypeFilter = query.errorType as string | undefined
    const statusCodeFilter = query.statusCode ? parseInt(query.statusCode as string) : undefined
    const pathFilter = query.path as string | undefined
    const userIdFilter = query.userId ? parseInt(query.userId as string) : undefined
    const search = (query.search as string)?.trim()

    // Filtre de période (pour limiter la charge mémoire)
    // Par défaut, ne montrer que les 7 derniers jours pour éviter les problèmes de mémoire MySQL
    // Si on filtre par "unresolved", réduire à 1 jour par défaut car il y a généralement beaucoup de logs non résolus
    const timeRangeFilter = query.timeRange as string | undefined // '1d' | '7d' | '30d' | '90d' | 'all'
    const defaultTimeRange = statusFilter === 'unresolved' ? '1d' : '7d'
    const timeRange = timeRangeFilter || defaultTimeRange

    // Paramètres de tri
    const sortField = (query.sortField as string) || 'createdAt'
    const sortDir = (query.sortDir as string) === 'asc' ? 'asc' : 'desc'

    // Construction des filtres WHERE
    const conditions: any[] = []

    // Filtre de période pour éviter les problèmes de mémoire MySQL
    if (timeRange !== 'all') {
      const daysMap: Record<string, number> = {
        '1d': 1,
        '7d': 7,
        '30d': 30,
        '90d': 90,
      }
      const days = daysMap[timeRange] || 7
      conditions.push({
        createdAt: {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        },
      })
    }

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

    // Filtre par code de statut HTTP
    if (statusCodeFilter) {
      conditions.push({ statusCode: statusCodeFilter })
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

    // Comptage total pour la pagination (avec timeout sur les grands nombres)
    let total = 0
    try {
      total = await prisma.apiErrorLog.count({ where })
    } catch (countError) {
      // Si le comptage échoue, estimer à partir du nombre de pages max supportées
      console.warn('Count query failed, using estimate:', countError)
      total = 1000 // Estimation conservative
    }

    // Configuration du tri - limiter aux champs indexés pour éviter les problèmes de mémoire
    const orderBy: any = []
    if (sortField === 'createdAt') {
      orderBy.push({ createdAt: sortDir })
    } else if (sortField === 'statusCode') {
      orderBy.push({ statusCode: sortDir })
    } else if (sortField === 'path') {
      orderBy.push({ path: sortDir })
    } else {
      // Par défaut, tri par createdAt descendant (plus récent en premier) - champ indexé
      orderBy.push({ createdAt: 'desc' })
    }

    // Pagination par curseur (performant) ou offset (rétrocompatibilité)
    let errorLogs
    if (cursor) {
      // Pagination par curseur : beaucoup plus performant, pas de SKIP
      errorLogs = await prisma.apiErrorLog.findMany({
        where,
        orderBy,
        cursor: { id: cursor },
        skip: 1, // Skip le curseur lui-même
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
          referer: true, // Page d'origine
          origin: true, // Domaine d'origine
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
          body: true, // Inclure le body (sanitisé) pour le debug
          // prismaDetails: true, // TODO: Activer après migration en production
          headers: false, // Pas dans la liste par défaut (trop verbeux)
          stack: false, // Pas dans la liste par défaut (très verbeux)
        },
      })
    } else {
      // Pagination classique par offset (rétrocompatibilité)
      // Limiter le skip pour éviter les problèmes de performance
      const maxSkip = 1000
      const safeSkip = Math.min(pagination?.skip || 0, maxSkip)

      errorLogs = await prisma.apiErrorLog.findMany({
        where,
        orderBy,
        skip: safeSkip,
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
          referer: true,
          origin: true,
          resolved: true,
          resolvedBy: true,
          resolvedAt: true,
          adminNotes: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              pseudo: true,
              email: true,
            },
          },
          queryParams: true,
          body: true,
          // prismaDetails: true, // TODO: Activer après migration en production
          headers: false,
          stack: false,
        },
      })
    }

    // Statistiques basées sur les mêmes filtres que la liste
    // Dernières 24h pour avoir une vue récente
    const stats24hWhere = {
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    }

    const stats = await prisma.apiErrorLog.aggregate({
      where: stats24hWhere,
      _count: {
        id: true,
      },
    })

    // Compte des non résolus avec les mêmes filtres que la liste
    const unresolvedCount = await prisma.apiErrorLog.count({
      where: { ...where, resolved: false },
    })

    // Statistiques par type d'erreur (avec les mêmes filtres que la liste)
    const errorTypeStats = await prisma.apiErrorLog.groupBy({
      by: ['errorType'],
      where,
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

    // Erreurs par code de statut (avec les mêmes filtres que la liste)
    const statusCodeStats = await prisma.apiErrorLog.groupBy({
      by: ['statusCode'],
      where,
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

    // Calculer le curseur pour la page suivante (si pagination par curseur)
    const nextCursor = errorLogs.length > 0 ? errorLogs[errorLogs.length - 1].id : null
    const hasMore = errorLogs.length === pageSize // Il y a potentiellement plus de résultats

    // Préparer les stats
    const statsResponse = {
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
    }

    if (cursor) {
      // Pagination par curseur - structure différente
      return createSuccessResponse({
        logs: errorLogs,
        pagination: {
          cursor: nextCursor,
          hasMore,
          pageSize,
          total, // Le total peut être approximatif avec le curseur
        },
        stats: statsResponse,
      })
    } else {
      // Pagination classique - utiliser createPaginatedResponse
      return {
        ...createPaginatedResponse(errorLogs, total, page!, pageSize),
        stats: statsResponse,
      }
    }
  },
  { operationName: 'GetErrorLogs' }
)
