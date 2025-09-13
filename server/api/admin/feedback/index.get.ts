import { requireGlobalAdminWithDbCheck } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification et les droits admin (mutualisé)
  await requireGlobalAdminWithDbCheck(event)

  try {
    const query = getQuery(event)
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 20
    const type = query.type as string
    const resolved =
      query.resolved === 'true' ? true : query.resolved === 'false' ? false : undefined
    const search = query.search as string

    const offset = (page - 1) * limit

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
        skip: offset,
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
      feedbacks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats: statsFormatted,
    }
  } catch (error: any) {
    console.error('Erreur lors de la récupération des feedbacks:', error?.message, error)
    // Mode debug optionnel pour admin: ?debug=1 retourne détails (sans données sensibles majeures)
    const query = getQuery(event)
    const isDebug = query.debug === '1'
    if (isDebug) {
      return {
        error: true,
        message: 'Erreur lors de la récupération des feedbacks',
        prismaError: {
          message: error?.message,
          code: error?.code,
          meta: error?.meta,
        },
      }
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la récupération des feedbacks',
    })
  }
})
