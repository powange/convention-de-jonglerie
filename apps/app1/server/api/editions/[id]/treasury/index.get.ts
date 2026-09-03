import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import { userWithProfileAndGravatarSelect } from '#server/utils/prisma-select-helpers'
import {
  computeTreasury,
  aggregateTicketingItems,
  type TicketingTotals,
  type TreasurySourceKey,
} from '#server/utils/treasury-compute'
import { validateEditionId } from '#server/utils/validation-helpers'

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

    const [artists, orderItems, manualEntries, sourceCodeRows, codes] = await Promise.all([
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
      // Descendre à la ligne de commande est la seule façon de distinguer une entrée d'une
      // vente annexe : le partage vit sur le tarif, pas sur la commande.
      prisma.ticketingOrderItem.findMany({
        where: { order: { editionId } },
        select: {
          amount: true,
          type: true,
          order: { select: { status: true } },
          tier: { select: { countAsParticipant: true } },
          // Le prix d'une option n'est nulle part ailleurs : ni dans la ligne, ni dans le total
          // de la commande, tous deux calculés avant que les options n'existent.
          selectedOptions: { select: { amount: true } },
        },
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
          imageUrl: true,
          isForecast: true,
          reimbursed: true,
          advancedBy: { select: userWithProfileAndGravatarSelect },
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

    const ticketing: TicketingTotals = aggregateTicketingItems(
      orderItems.map((item) => ({
        amount: item.amount + item.selectedOptions.reduce((sum, option) => sum + option.amount, 0),
        orderStatus: item.order.status,
        countAsParticipant: item.tier?.countAsParticipant ?? null,
        type: item.type,
      }))
    )
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
