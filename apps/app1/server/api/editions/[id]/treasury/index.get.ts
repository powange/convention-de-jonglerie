import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import {
  computeTreasury,
  type TicketingTotals,
  type TreasurySourceKey,
} from '#server/utils/treasury-compute'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Statuts de commande, tels que la billetterie les enregistre.
 *
 * `Processed` et `Onsite` sont encaissés — l'un par la billetterie externe, l'autre sur place ;
 * ils restent distincts parce que le calcul les additionne lui-même.
 */
const PENDING_STATUSES = ['Pending']
const REFUNDED_STATUSES = ['Refunded']

/**
 * GET /api/editions/:id/treasury
 *
 * Charges et produits de l'édition. Les lignes venant des artistes et de la billetterie sont
 * calculées à la lecture, jamais recopiées : un montant corrigé à la source se répercute donc
 * immédiatement.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageTreasuryById(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à la trésorerie',
      })
    }

    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true, currency: true, conventionId: true },
    })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }

    const codeSelect = { id: true, code: true, label: true } as const

    const [artists, ordersByStatus, manualEntries, sourceCodeRows, codes] = await Promise.all([
      prisma.editionArtist.findMany({
        where: { editionId },
        select: {
          payment: true,
          paymentPaid: true,
          reimbursementMax: true,
          reimbursementActual: true,
          reimbursementActualPaid: true,
          consumablesMax: true,
          consumablesActual: true,
          consumablesActualPaid: true,
        },
      }),
      prisma.ticketingOrder.groupBy({
        by: ['status'],
        where: { editionId },
        _sum: { amount: true },
      }),
      prisma.treasuryEntry.findMany({
        where: { editionId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          kind: true,
          title: true,
          description: true,
          amount: true,
          code: { select: codeSelect },
        },
      }),
      prisma.treasurySourceCode.findMany({
        where: { editionId },
        select: { source: true, code: { select: codeSelect } },
      }),
      prisma.treasuryCode.findMany({
        where: { conventionId: edition.conventionId },
        orderBy: { code: 'asc' },
        select: codeSelect,
      }),
    ])

    const sumOf = (statuses: string[]) =>
      ordersByStatus
        .filter((row) => statuses.includes(row.status))
        .reduce((total, row) => total + (row._sum.amount ?? 0), 0)

    const ticketing: TicketingTotals = {
      processed: sumOf(['Processed']),
      onsite: sumOf(['Onsite']),
      pending: sumOf(PENDING_STATUSES),
      refunded: sumOf(REFUNDED_STATUSES),
    }
    const sourceCodes = Object.fromEntries(
      sourceCodeRows.map((row) => [row.source as TreasurySourceKey, row.code])
    )

    const report = computeTreasury({ artists, ticketing, manualEntries, sourceCodes })

    return createSuccessResponse({
      currency: edition.currency,
      codes,
      ...report,
    })
  },
  { operationName: 'GetEditionTreasury' }
)
