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
  | 'TICKETING_PARTICIPANTS'
  | 'TICKETING_DONATIONS'
  | 'TICKETING_OTHER'

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
  /** Justificatif d'une ligne saisie à la main ; les lignes calculées n'en portent pas. */
  imageUrl?: string | null
  /** Montant attendu, pas encore réglé. */
  isForecast?: boolean
  /** Dépense avancée de sa poche, et son état de remboursement. */
  advancedBy?: PersonneAvance | null
  reimbursed?: boolean
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

/** Lignes de commande agrégées par statut, en centimes. */
export interface TicketingStatusTotals {
  processed: number
  onsite: number
  pending: number
  refunded: number
}

/**
 * Billetterie séparée en deux produits distincts.
 *
 * Une entrée et un tee-shirt ne se lisent pas de la même façon : la première suit la
 * fréquentation, le second est une vente annexe. Les confondre en une seule ligne empêche de
 * rapprocher le produit des entrées du nombre de participants.
 *
 * Le partage suit `countAsParticipant`, déjà porté par les tarifs et déjà utilisé par les
 * statistiques : ce qui est compté comme participant là-bas l'est ici aussi.
 *
 * Les dons forment une troisième ligne : ce ne sont ni une contrepartie ni une vente, et bien
 * des conventions les imputent à un compte distinct. Les ventes annexes — vêtements, options —
 * restent avec les autres produits.
 */
export interface TicketingTotals {
  participants: TicketingStatusTotals
  donations: TicketingStatusTotals
  other: TicketingStatusTotals
}

export interface ManualEntryRow {
  id: number
  kind: TreasuryKind
  title: string
  description: string | null
  amount: number
  code: { id: number; code: string; label: string } | null
  imageUrl?: string | null
  isForecast?: boolean
  reimbursed?: boolean
  advancedBy?: PersonneAvance | null
}

/** Qui a avancé une dépense — juste de quoi l'afficher et la totaliser. */
export interface PersonneAvance {
  id: number
  pseudo: string
  prenom?: string | null
  nom?: string | null
  profilePicture?: string | null
  emailHash?: string | null
  updatedAt?: Date | string | null
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
    /** Avances non remboursées, total et répartition par personne. */
    toReimburse: AvancesARembourser
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

/** Une ligne de commande, réduite à ce dont le partage a besoin. */
export interface TicketingItemRow {
  /**
   * Prix de la ligne, **options comprises**.
   *
   * Le prix d'une option vit dans sa propre table et n'entrait dans aucun total : sur une
   * édition, deux cent quatre-vingt-onze euros de bouteilles étaient enregistrés sans être
   * comptés nulle part. Une option suit la ligne qui la porte, donc son produit aussi.
   */
  amount: number
  /**
   * Statut de la **commande**, qui gouverne — et non l'état de la ligne.
   *
   * Les deux divergent souvent sans que cela ait un sens comptable : une commande encaissée sur
   * place porte `Onsite` quand ses lignes portent `Processed`. Le statut de commande est le seul
   * qui distingue l'encaissement sur place de l'externe, et c'est lui qui a toujours servi de
   * base au total.
   */
  orderStatus: string
  /** `null` quand la ligne n'a pas de tarif : don, vêtement ajouté à la main. */
  countAsParticipant: boolean | null
  /**
   * Type de ligne tel que la billetterie l'enregistre. `Donation` isole les dons, que rien
   * d'autre ne distingue : ils n'ont pas de tarif, comme les ventes annexes.
   */
  type: string | null
}

/** Statuts de commande, tels que la billetterie les enregistre. */
const PENDING_STATUSES = ['Pending']
const REFUNDED_STATUSES = ['Refunded']

/**
 * Ventile les lignes de commande entre entrées et autres produits, par statut.
 *
 * Les dons passent avant tout autre critère : ils n'ont pas de tarif, exactement comme les
 * ventes annexes, et rien d'autre que leur type ne les en distingue.
 *
 * Une ligne sans tarif ni type de don rejoint les autres produits. La compter comme participant
 * gonflerait le produit des entrées d'un montant qui n'en est pas.
 */
export function aggregateTicketingItems(rows: TicketingItemRow[]): TicketingTotals {
  const empty = (): TicketingStatusTotals => ({
    processed: 0,
    onsite: 0,
    pending: 0,
    refunded: 0,
  })
  const totals: TicketingTotals = { participants: empty(), donations: empty(), other: empty() }

  for (const row of rows) {
    const bucket =
      row.type === 'Donation'
        ? totals.donations
        : row.countAsParticipant === true
          ? totals.participants
          : totals.other
    if (row.orderStatus === 'Processed') bucket.processed += row.amount
    else if (row.orderStatus === 'Onsite') bucket.onsite += row.amount
    else if (PENDING_STATUSES.includes(row.orderStatus)) bucket.pending += row.amount
    else if (REFUNDED_STATUSES.includes(row.orderStatus)) bucket.refunded += row.amount
  }

  return totals
}

/** Même règle pour les deux produits de billetterie : encaissé moins remboursé, attente à part. */
function ticketingAmounts(totals: TicketingStatusTotals): TreasuryAmounts {
  return {
    settled: totals.processed + totals.onsite - totals.refunded,
    pending: totals.pending,
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
    sourceLine('TICKETING_PARTICIPANTS', 'INCOME', ticketingAmounts(ticketing.participants)),
    sourceLine('TICKETING_DONATIONS', 'INCOME', ticketingAmounts(ticketing.donations)),
    sourceLine('TICKETING_OTHER', 'INCOME', ticketingAmounts(ticketing.other)),
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
      imageUrl: entry.imageUrl,
      isForecast: entry.isForecast ?? false,
      advancedBy: entry.advancedBy ?? null,
      reimbursed: entry.reimbursed ?? false,
      readOnly: false,
      // Une ligne saisie à la main est réglée par défaut. Marquée prévisionnelle, elle passe en
      // engagé : le solde ne bouge pas — il additionne les deux — mais le réglé cesse de compter
      // un montant qui n'a pas été payé.
      settled: entry.isForecast ? 0 : entry.amount,
      pending: entry.isForecast ? entry.amount : 0,
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
    totals: {
      expense,
      income,
      balance: engaged(income) - engaged(expense),
      toReimburse: avancesARembourser(lines),
    },
  }
}

/**
 * Ce que l'association doit à ceux qui ont avancé de leur poche.
 *
 * Dette distincte de celle des factures à payer : le fournisseur est réglé, c'est la personne qui
 * attend. Elle n'apparaît donc dans aucun des totaux existants, et sans agrégat le montant global
 * ne se lit nulle part.
 *
 * Une avance PRÉVISIONNELLE est exclue : rien n'a encore été sorti de la poche de personne, il n'y
 * a donc rien à rembourser. Le montant retenu est celui réglé de la ligne, pas son montant brut.
 */
export function avancesARembourser(lines: TreasuryLine[]): AvancesARembourser {
  const parPersonne = new Map<number, { personne: PersonneAvance; montant: number }>()

  for (const line of lines) {
    if (line.kind !== 'EXPENSE' || line.reimbursed || !line.advancedBy || !line.settled) continue

    const deja = parPersonne.get(line.advancedBy.id)
    if (deja) deja.montant += line.settled
    else parPersonne.set(line.advancedBy.id, { personne: line.advancedBy, montant: line.settled })
  }

  const detail = [...parPersonne.values()].sort((a, b) => b.montant - a.montant)
  return { total: detail.reduce((somme, d) => somme + d.montant, 0), detail }
}

export interface AvancesARembourser {
  /** Somme due, en centimes. */
  total: number
  /** Une entrée par personne, de la plus grosse avance à la plus petite. */
  detail: { personne: PersonneAvance; montant: number }[]
}
