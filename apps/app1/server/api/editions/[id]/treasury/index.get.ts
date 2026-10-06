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

    const [artists, orderItems, manualEntries, tiers, sourceCodeRows, codes] = await Promise.all([
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
          // L'état de la LIGNE, distinct du statut de sa commande : une ligne annulée vit dans une
          // commande encaissée, et elle était comptée comme un produit.
          state: true,
          order: { select: { status: true } },
          // `id` en plus de `countAsParticipant` : c'est lui qui permet de réacheminer la ligne
          // vers un produit nommé qui a rattaché ce tarif.
          tier: { select: { id: true, countAsParticipant: true } },
          // Le prix d'une option n'est nulle part ailleurs : ni dans la ligne, ni dans le total
          // de la commande, tous deux calculés avant que les options n'existent.
          selectedOptions: { select: { amount: true } },
        },
      }),
      prisma.treasuryEntry.findMany({
        where: { editionId },
        // La date d'opération commande, la date de saisie départage. Les entrées antérieures au
        // champ n'en ont pas : MySQL les range en tête sur un tri croissant, c'est-à-dire là où on
        // les attend — ce sont les plus anciennes — et elles y gardent leur ordre de saisie.
        orderBy: [{ operationDate: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          kind: true,
          title: true,
          description: true,
          amount: true,
          operationDate: true,
          imageUrl: true,
          isForecast: true,
          reimbursed: true,
          advancedBy: { select: userWithProfileAndGravatarSelect },
          advancedByName: true,
          code: { select: codeSelect },
          // Les tarifs dont la ligne tire son montant. Non vide ⇒ `amount` ci-dessus n'est pas lu.
          tiers: { select: { tierId: true } },
        },
      }),
      /*
       * Les tarifs de l'édition, pour le sélecteur de la modale.
       *
       * 📍 Renvoyés avec la trésorerie plutôt que par un second appel, comme `codes` juste
       * au-dessus : la modale en a besoin dès son ouverture, et un appel séparé la ferait
       * s'afficher vide le temps d'un battement.
       *
       * `customName` l'emporte sur `name` quand il est posé — même règle qu'ailleurs dans la
       * billetterie.
       */
      prisma.ticketingTier.findMany({
        where: { editionId },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          customName: true,
          countAsParticipant: true,
          treasuryEntries: { select: { entryId: true } },
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

    /*
     * Les regroupements, tirés des entrées : chaque ligne qui porte des tarifs réclame les ventes
     * de ceux-ci. Passés à l'agrégation AVANT qu'elle ne ventile, pour que le montant parte au bon
     * endroit du premier coup — rien n'est retranché après coup.
     */
    const regroupements = manualEntries
      .filter((entry) => entry.tiers.length > 0)
      .map((entry) => ({ entryId: entry.id, tierIds: entry.tiers.map((lien) => lien.tierId) }))

    const ticketing: TicketingTotals = aggregateTicketingItems(
      orderItems.map((item) => ({
        amount: item.amount + item.selectedOptions.reduce((sum, option) => sum + option.amount, 0),
        orderStatus: item.order.status,
        itemState: item.state,
        countAsParticipant: item.tier?.countAsParticipant ?? null,
        tierId: item.tier?.id ?? null,
        type: item.type,
      })),
      regroupements
    )
    const sourceCodes = Object.fromEntries(
      sourceCodeRows.map((row) => [row.source as TreasurySourceKey, row.code])
    )

    const report = computeTreasury({
      artists,
      ticketing,
      manualEntries: manualEntries.map((entry) => ({
        ...entry,
        tierIds: entry.tiers.map((lien) => lien.tierId),
      })),
      sourceCodes,
    })

    return createSuccessResponse({
      currency: edition.currency,
      codes,
      /*
       * `prisPar` dit à quelle ligne un tarif est déjà rattaché — `null` s'il est libre.
       *
       * Un tarif n'appartient qu'à UNE ligne (index unique en base) : sans cette information, le
       * sélecteur proposerait un tarif déjà pris, l'enregistrement serait refusé, et l'utilisateur
       * ne saurait pas par qui.
       */
      tiers: tiers.map((tier) => ({
        id: tier.id,
        label: tier.customName || tier.name,
        countAsParticipant: tier.countAsParticipant,
        prisPar: tier.treasuryEntries[0]?.entryId ?? null,
      })),
      ...report,
    })
  },
  { operationName: 'GetEditionTreasury' }
)
