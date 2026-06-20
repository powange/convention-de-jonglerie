import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  getEditionWithPermissions,
  canManageArtists,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Liste tous les appels à spectacles d'une édition
 * Accessible par les organisateurs ayant les droits de gestion des artistes
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const edition = await getEditionWithPermissions(editionId, {
      userId: user.id,
    })

    if (!edition) {
      throw createError({
        status: 404,
        message: 'Édition non trouvée',
      })
    }

    if (!canManageArtists(edition, user)) {
      throw createError({
        status: 403,
        message: "Vous n'avez pas les droits pour gérer les appels à spectacles de cette édition",
      })
    }

    // Récupérer tous les appels à spectacles
    const showCalls = await prisma.editionShowCall.findMany({
      where: { editionId },
      orderBy: { createdAt: 'desc' },
    })

    // Récupérer les stats groupées par showCallId et status en une seule requête
    const applicationStats = await prisma.showApplication.groupBy({
      by: ['showCallId', 'status'],
      where: {
        showCallId: { in: showCalls.map((sc) => sc.id) },
      },
      _count: true,
    })

    // Construire un map des stats par showCallId
    const statsMap = new Map<
      number,
      { pending: number; accepted: number; rejected: number; total: number }
    >()

    for (const showCall of showCalls) {
      statsMap.set(showCall.id, { pending: 0, accepted: 0, rejected: 0, total: 0 })
    }

    for (const stat of applicationStats) {
      const current = statsMap.get(stat.showCallId)
      if (current) {
        current.total += stat._count
        if (stat.status === 'PENDING') current.pending = stat._count
        else if (stat.status === 'ACCEPTED') current.accepted = stat._count
        else if (stat.status === 'REJECTED') current.rejected = stat._count
      }
    }

    // Combiner les appels avec leurs stats
    const showCallsWithStats = showCalls.map((showCall) => ({
      ...showCall,
      stats: statsMap.get(showCall.id) || { pending: 0, accepted: 0, rejected: 0, total: 0 },
    }))

    return {
      showCalls: showCallsWithStats,
    }
  },
  { operationName: 'ListShowCalls' }
)
