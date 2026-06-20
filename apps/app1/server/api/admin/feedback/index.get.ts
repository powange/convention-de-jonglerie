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
    const resolved =
      query.resolved === 'true' ? true : query.resolved === 'false' ? false : undefined
    const search = query.search as string

    // Construction des filtres
    const where: any = {}

    if (type) {
      where.type = type
    }

    if (resolved !== undefined) {
      where.resolved = resolved
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
      by: ['type', 'resolved'],
      _count: { id: true },
    })

    const statsFormatted = {
      total,
      byType: {} as Record<string, number>,
      byStatus: {
        resolved: 0,
        pending: 0,
      },
    }

    stats.forEach((stat) => {
      statsFormatted.byType[stat.type] = (statsFormatted.byType[stat.type] || 0) + stat._count.id
      if (stat.resolved) {
        statsFormatted.byStatus.resolved += stat._count.id
      } else {
        statsFormatted.byStatus.pending += stat._count.id
      }
    })

    return {
      ...createPaginatedResponse(feedbacks, total, page, limit),
      stats: statsFormatted,
    }
  },
  { operationName: 'GetAdminFeedbacks' }
)
