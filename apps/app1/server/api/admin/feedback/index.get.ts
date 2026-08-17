import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler, createPaginatedResponse } from '#server/utils/api-helpers'
import { validatePagination } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (mutualisé)
    await requireGlobalAdminWithDbCheck(event)
    const { page, limit, skip } = validatePagination(event)
    const query = getQuery(event)
    const type = query.type as string
    const statutsConnus = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED']
    const status = statutsConnus.includes(query.status as string)
      ? (query.status as string)
      : undefined
    const search = query.search as string

    // Construction des filtres
    const where: any = {}

    if (type) {
      where.type = type
    }

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { subject: { contains: search } },
        { message: { contains: search } },
        { email: { contains: search } },
        { name: { contains: search } },
      ]
    }

    // Récupérer les feedbacks avec pagination
    const [feedbacks, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              pseudo: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.feedback.count({ where }),
    ])

    // Statistiques rapides
    const stats = await prisma.feedback.groupBy({
      by: ['type', 'status'],
      _count: { id: true },
    })

    const statsFormatted = {
      total,
      byType: {} as Record<string, number>,
      byStatus: {
        NEW: 0,
        IN_PROGRESS: 0,
        RESOLVED: 0,
        REJECTED: 0,
      } as Record<string, number>,
    }

    stats.forEach((stat) => {
      statsFormatted.byType[stat.type] = (statsFormatted.byType[stat.type] || 0) + stat._count.id
      statsFormatted.byStatus[stat.status] =
        (statsFormatted.byStatus[stat.status] || 0) + stat._count.id
    })

    return {
      ...createPaginatedResponse(feedbacks, total, page, limit),
      stats: statsFormatted,
    }
  },
  { operationName: 'GetAdminFeedbacks' }
)
