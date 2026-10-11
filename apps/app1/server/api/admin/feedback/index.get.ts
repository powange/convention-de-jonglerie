import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler, createPaginatedResponse } from '#server/utils/api-helpers'
import { validatePagination } from '#server/utils/validation-helpers'
import {
  STATUTS_DE_RETOUR,
  TYPES_DE_RETOUR,
  valeurDEnumeration,
} from '~~/shared/utils/filtres-enum'

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (mutualisé)
    await requireGlobalAdminWithDbCheck(event)
    const { page, limit, skip } = validatePagination(event)
    const query = getQuery(event)
    /*
     * ⚠️ LE TYPE ÉTAIT RECOPIÉ TEL QUEL dans le `where` — constat B8. `Feedback.type` est une
     * énumération : `?type=PIZZA` faisait rejeter la requête ENTIÈRE par Prisma, donc une liste
     * vide, un 500 dans le journal d'erreurs, et rien à l'écran. Le filtre voisin, `status`,
     * était déjà gardé six lignes plus bas depuis toujours.
     */
    const type = valeurDEnumeration(TYPES_DE_RETOUR, query.type)
    const status = valeurDEnumeration(STATUTS_DE_RETOUR, query.status)
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
