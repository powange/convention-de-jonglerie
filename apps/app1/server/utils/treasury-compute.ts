/**
 * Calcul des charges et produits d'une édition.
 *
 * Fonction pure : elle reçoit des agrégats déjà lus en base et n'en relit aucun. C'est ce qui
 * permet de la couvrir par des tests sans base ni réseau, alors que c'est précisément ici qu'une
 * erreur passerait inaperçue — un total faux reste un nombre plausible.
 *
 * Tous les montants sont en centimes entiers, dans la devise de l'édition.
 */

export type TreasuryKind = 'EXPENSE' | 'INCOME'

export type TreasurySourceKey =
  | 'ARTIST_PAYMENT'
  | 'ARTIST_REIMBURSEMENT'
  | 'ARTIST_CONSUMABLES'
  | 'TICKETING_ORDERS'

/** Ce qui est réellement réglé, et ce qui est engagé sans l'être encore. */
export interface TreasuryAmounts {
  settled: number
  pending: number
}

export interface TreasuryLine extends TreasuryAmounts {
  /** Identifiant stable côté client : `source:ARTIST_PAYMENT` ou `entry:12`. */
  key: string
  origin: 'source' | 'manual'
  source?: TreasurySourceKey
  entryId?: number
  kind: TreasuryKind
  title: string
  description?: string | null
  code?: { id: number; code: string; label: string } | null
  /** Vrai pour les lignes calculées : elles se corrigent à la source, pas ici. */
  readOnly: boolean
}

/** Montants d'artistes tels que la base les stocke, en centimes. */
export interface ArtistAmountsRow {
  payment: number | null
  paymentPaid: boolean
  reimbursementMax: number | null
  reimbursementActual: number | null
  reimbursementActualPaid: boolean
  consumablesMax: number | null
  consumablesActual: number | null
  consumablesActualPaid: boolean
}

/** Commandes agrégées par statut, en centimes. */
export interface TicketingTotals {
  processed: number
  onsite: number
  pending: number
  refunded: number
}

export interface ManualEntryRow {
  id: number
  kind: TreasuryKind
  title: string
  description: string | null
  amount: number
  code: { id: number; code: string; label: string } | null
}

/**
 * Additionne un montant d'artiste en séparant réglé et engagé.
 *
 * Les indicateurs `*Paid` existent déjà et distinguent les deux : les ignorer afficherait comme
 * réglé ce qui ne l'est pas, ce qui vide de son sens le solde d'une trésorerie.
 */
function sumArtistField(
  rows: ArtistAmountsRow[],
  amountOf: (row: ArtistAmountsRow) => number | null,
  paidOf: (row: ArtistAmountsRow) => boolean
): TreasuryAmounts {
  let settled = 0
  let pending = 0
  for (const row of rows) {
    const amount = amountOf(row) ?? 0
    if (amount === 0) continue
    if (paidOf(row)) settled += amount
    else pending += amount
  }
  return { settled, pending }
}

/**
 * Défraiements et consommables : le réel s'il est connu, sinon le plafond.
 *
 * Le plafond est ce que l'édition s'est engagée à couvrir ; l'ignorer tant que le justificatif
 * n'est pas arrivé sous-estimerait la dépense à venir, précisément au moment où l'organisateur a
 * besoin de l'anticiper.
 *
 * Un montant issu du plafond ne peut pas être réglé — on ne paie pas une somme qu'on ne connaît
 * pas encore — il compte donc toujours comme engagé.
 */
function sumWithMaxFallback(
  rows: ArtistAmountsRow[],
  actualOf: (row: ArtistAmountsRow) => number | null,
  maxOf: (row: ArtistAmountsRow) => number | null,
  paidOf: (row: ArtistAmountsRow) => boolean
): TreasuryAmounts {
  let settled = 0
  let pending = 0
  for (const row of rows) {
    const actual = actualOf(row)
    if (actual !== null && actual !== undefined) {
      if (actual === 0) continue
      if (paidOf(row)) settled += actual
      else pending += actual
      continue
    }
    pending += maxOf(row) ?? 0
  }
  return { settled, pending }
}

export interface ComputeInput {
  artists: ArtistAmountsRow[]
  ticketing: TicketingTotals
  manualEntries: ManualEntryRow[]
  /** Code d'imputation retenu pour chaque origine calculée. */
  sourceCodes: Partial<Record<TreasurySourceKey, { id: number; code: string; label: string }>>
}

export interface TreasuryReport {
  lines: TreasuryLine[]
  totals: {
    expense: TreasuryAmounts
    income: TreasuryAmounts
    /**
     * Résultat de l'édition : produits moins charges, **réglés ou non**.
     *
     * Ne retenir que le réglé donnerait un solde à zéro sur une édition qui n'a encore rien payé
     * mais doit déjà plusieurs milliers d'euros — une impression d'équilibre trompeuse au moment
     * précis où l'organisateur a besoin de savoir où il en est.
     */
    balance: number
  }
}

export function computeTreasury(input: ComputeInput): TreasuryReport {
  const { artists, ticketing, manualEntries, sourceCodes } = input

  const sourceLine = (
    source: TreasurySourceKey,
    kind: TreasuryKind,
    amounts: TreasuryAmounts
  ): TreasuryLine => ({
    key: `source:${source}`,
    origin: 'source',
    source,
    kind,
    title: source,
    code: sourceCodes[source] ?? null,
    readOnly: true,
    ...amounts,
  })

  const lines: TreasuryLine[] = [
    sourceLine(
      'ARTIST_PAYMENT',
      'EXPENSE',
      sumArtistField(
        artists,
        (a) => a.payment,
        (a) => a.paymentPaid
      )
    ),
    sourceLine(
      'ARTIST_REIMBURSEMENT',
      'EXPENSE',
      sumWithMaxFallback(
        artists,
        (a) => a.reimbursementActual,
        (a) => a.reimbursementMax,
        (a) => a.reimbursementActualPaid
      )
    ),
    sourceLine(
      'ARTIST_CONSUMABLES',
      'EXPENSE',
      sumWithMaxFallback(
        artists,
        (a) => a.consumablesActual,
        (a) => a.consumablesMax,
        (a) => a.consumablesActualPaid
      )
    ),
    // Un remboursement vient en déduction des produits : c'est de l'argent encaissé puis rendu,
    // pas une charge d'exploitation. Une commande en attente est engagée sans être encaissée.
    sourceLine('TICKETING_ORDERS', 'INCOME', {
      settled: ticketing.processed + ticketing.onsite - ticketing.refunded,
      pending: ticketing.pending,
    }),
  ]

  for (const entry of manualEntries) {
    lines.push({
      key: `entry:${entry.id}`,
      origin: 'manual',
      entryId: entry.id,
      kind: entry.kind,
      title: entry.title,
      description: entry.description,
      code: entry.code,
      readOnly: false,
      // Une ligne saisie à la main est réputée réglée : rien ne permettrait d'en décider
      // autrement, et laisser le montant hors du solde le rendrait faux.
      settled: entry.amount,
      pending: 0,
    })
  }

  const accumulate = (kind: TreasuryKind): TreasuryAmounts =>
    lines
      .filter((line) => line.kind === kind)
      .reduce(
        (total, line) => ({
          settled: total.settled + line.settled,
          pending: total.pending + line.pending,
        }),
        { settled: 0, pending: 0 }
      )

  const expense = accumulate('EXPENSE')
  const income = accumulate('INCOME')

  const engaged = (amounts: TreasuryAmounts) => amounts.settled + amounts.pending

  return {
    lines,
    totals: { expense, income, balance: engaged(income) - engaged(expense) },
  }
}
