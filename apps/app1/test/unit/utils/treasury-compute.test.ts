import { describe, it, expect } from 'vitest'

import {
  aggregateTicketingItems,
  computeTreasury,
  type ArtistAmountsRow,
  type ComputeInput,
  type TicketingStatusTotals,
  type TicketingTotals,
} from '../../../server/utils/treasury-compute'

const statusTotals = (over: Partial<TicketingStatusTotals> = {}): TicketingStatusTotals => ({
  processed: 0,
  onsite: 0,
  pending: 0,
  refunded: 0,
  canceled: 0,
  ...over,
})

const ticketingTotals = (
  over: {
    participants?: Partial<TicketingStatusTotals>
    donations?: Partial<TicketingStatusTotals>
    other?: Partial<TicketingStatusTotals>
  } = {}
): TicketingTotals => ({
  participants: statusTotals(over.participants),
  donations: statusTotals(over.donations),
  other: statusTotals(over.other),
})

function artist(overrides: Partial<ArtistAmountsRow> = {}): ArtistAmountsRow {
  return {
    payment: null,
    paymentPaid: false,
    reimbursementMax: null,
    reimbursementActual: null,
    reimbursementActualPaid: false,
    consumablesMax: null,
    consumablesActual: null,
    consumablesActualPaid: false,
    ...overrides,
  }
}

function input(overrides: Partial<ComputeInput> = {}): ComputeInput {
  return {
    artists: [],
    ticketing: ticketingTotals(),
    manualEntries: [],
    sourceCodes: {},
    ...overrides,
  }
}

const lineOf = (report: ReturnType<typeof computeTreasury>, key: string) =>
  report.lines.find((l) => l.key === key)!

describe('computeTreasury — montants d’artistes', () => {
  // Les indicateurs `*Paid` existent déjà : les ignorer afficherait comme réglé ce qui ne l'est
  // pas, ce qui viderait le solde de son sens.
  it('sépare ce qui est réglé de ce qui est seulement engagé', () => {
    const report = computeTreasury(
      input({
        artists: [
          artist({ payment: 65000, paymentPaid: true }),
          artist({ payment: 20000, paymentPaid: false }),
        ],
      })
    )

    expect(lineOf(report, 'source:ARTIST_PAYMENT')).toMatchObject({
      settled: 65000,
      pending: 20000,
    })
  })

  it('ignore les montants absents sans les compter comme zéro réglé', () => {
    const report = computeTreasury(
      input({ artists: [artist({ payment: null, paymentPaid: true }), artist()] })
    )
    expect(lineOf(report, 'source:ARTIST_PAYMENT')).toMatchObject({ settled: 0, pending: 0 })
  })

  it('traite défraiements et consommables avec leur propre indicateur', () => {
    const report = computeTreasury(
      input({
        artists: [
          artist({ reimbursementActual: 9851, reimbursementActualPaid: true }),
          artist({ consumablesActual: 6250, consumablesActualPaid: false }),
        ],
      })
    )

    expect(lineOf(report, 'source:ARTIST_REIMBURSEMENT')).toMatchObject({
      settled: 9851,
      pending: 0,
    })
    expect(lineOf(report, 'source:ARTIST_CONSUMABLES')).toMatchObject({
      settled: 0,
      pending: 6250,
    })
  })
})

describe('computeTreasury — repli sur le plafond', () => {
  // Tant que le justificatif n'est pas arrivé, le plafond est ce que l'édition s'est engagée à
  // couvrir. L'ignorer sous-estimerait la dépense à venir.
  it('retient le plafond quand le réel est inconnu', () => {
    const report = computeTreasury(
      input({ artists: [artist({ reimbursementMax: 15000, reimbursementActual: null })] })
    )
    expect(lineOf(report, 'source:ARTIST_REIMBURSEMENT')).toMatchObject({
      settled: 0,
      pending: 15000,
    })
  })

  it('préfère le réel dès qu’il est connu, même inférieur au plafond', () => {
    const report = computeTreasury(
      input({
        artists: [
          artist({
            reimbursementMax: 15000,
            reimbursementActual: 9851,
            reimbursementActualPaid: true,
          }),
        ],
      })
    )
    expect(lineOf(report, 'source:ARTIST_REIMBURSEMENT')).toMatchObject({
      settled: 9851,
      pending: 0,
    })
  })

  // On ne paie pas une somme qu'on ne connaît pas encore : un montant issu du plafond reste
  // engagé, quel que soit l'indicateur de règlement.
  it('ne compte jamais un plafond comme réglé', () => {
    const report = computeTreasury(
      input({
        artists: [
          artist({
            reimbursementMax: 15000,
            reimbursementActual: null,
            reimbursementActualPaid: true,
          }),
        ],
      })
    )
    expect(lineOf(report, 'source:ARTIST_REIMBURSEMENT')).toMatchObject({
      settled: 0,
      pending: 15000,
    })
  })

  it('applique la même règle aux consommables', () => {
    const report = computeTreasury(
      input({ artists: [artist({ consumablesMax: 8000, consumablesActual: null })] })
    )
    expect(lineOf(report, 'source:ARTIST_CONSUMABLES')).toMatchObject({
      settled: 0,
      pending: 8000,
    })
  })

  // Un réel explicitement nul est une information : le défraiement a été renoncé, il ne faut pas
  // retomber sur le plafond.
  it('respecte un réel à zéro plutôt que de revenir au plafond', () => {
    const report = computeTreasury(
      input({ artists: [artist({ reimbursementMax: 15000, reimbursementActual: 0 })] })
    )
    expect(lineOf(report, 'source:ARTIST_REIMBURSEMENT')).toMatchObject({
      settled: 0,
      pending: 0,
    })
  })
})

describe('computeTreasury — billetterie', () => {
  /*
   * LE CORRECTIF. Ces deux tests affirmaient l'inverse : « déduit les remboursements des produits »
   * et « accepte que les remboursements dépassent les encaissements », ce dernier attendant un
   * produit de −1500.
   *
   * Le statut de commande est EXCLUSIF. Une commande `Refunded` n'a jamais rejoint `processed` :
   * elle n'atterrit que dans `refunded`. La soustraire comptait donc le remboursement deux fois, et
   * le total négatif que le second test consacrait n'était pas une tolérance — c'était le symptôme.
   */
  it('ne soustrait pas une commande remboursée, qui n’a jamais été ajoutée', () => {
    const report = computeTreasury(
      input({
        ticketing: ticketingTotals({
          participants: { processed: 820062, onsite: 345250, pending: 31000, refunded: 4600 },
        }),
      })
    )

    expect(lineOf(report, 'source:TICKETING_PARTICIPANTS')).toMatchObject({
      kind: 'INCOME',
      settled: 820062 + 345250,
      pending: 31000,
    })
  })

  it('une commande annulée ne change ni le réglé ni l’engagé', () => {
    const sansRemboursement = computeTreasury(
      input({
        ticketing: ticketingTotals({
          participants: { processed: 1000, onsite: 500, pending: 200 },
        }),
      })
    )
    const avecRemboursement = computeTreasury(
      input({
        ticketing: ticketingTotals({
          participants: { processed: 1000, onsite: 500, pending: 200, refunded: 2500 },
        }),
      })
    )

    const attendu = { settled: 1500, pending: 200 }
    expect(lineOf(sansRemboursement, 'source:TICKETING_PARTICIPANTS')).toMatchObject(attendu)
    expect(lineOf(avecRemboursement, 'source:TICKETING_PARTICIPANTS')).toMatchObject(attendu)
  })

  it('un produit ne devient jamais négatif à cause des remboursements', () => {
    // Le cas que l'ancien comportement rendait possible : plus de remboursé que d'encaissé.
    const report = computeTreasury(
      input({
        ticketing: ticketingTotals({
          participants: { processed: 1000, onsite: 0, pending: 0, refunded: 2500 },
        }),
      })
    )

    expect(lineOf(report, 'source:TICKETING_PARTICIPANTS').settled).toBe(1000)
  })

  it('une ligne annulée ne compte pas davantage', () => {
    const report = computeTreasury(
      input({
        ticketing: ticketingTotals({
          participants: { processed: 1000, onsite: 0, pending: 0, canceled: 700 },
        }),
      })
    )

    expect(lineOf(report, 'source:TICKETING_PARTICIPANTS').settled).toBe(1000)
  })
})

describe('computeTreasury — lignes saisies', () => {
  it('ajoute charges et produits saisis à la main', () => {
    const report = computeTreasury(
      input({
        manualEntries: [
          {
            id: 1,
            kind: 'EXPENSE',
            title: 'Location salle',
            description: null,
            amount: 150000,
            code: null,
          },
          {
            id: 2,
            kind: 'INCOME',
            title: 'Subvention',
            description: 'Mairie',
            amount: 200000,
            code: null,
          },
        ],
      })
    )

    expect(lineOf(report, 'entry:1')).toMatchObject({
      kind: 'EXPENSE',
      settled: 150000,
      readOnly: false,
    })
    expect(lineOf(report, 'entry:2')).toMatchObject({ kind: 'INCOME', settled: 200000 })
  })

  it('marque les lignes calculées comme non modifiables, les saisies comme modifiables', () => {
    const report = computeTreasury(
      input({
        manualEntries: [
          { id: 1, kind: 'EXPENSE', title: 'x', description: null, amount: 1, code: null },
        ],
      })
    )
    expect(report.lines.filter((l) => l.readOnly).map((l) => l.origin)).toEqual([
      'source',
      'source',
      'source',
      'source',
      'source',
      'source',
    ])
    expect(lineOf(report, 'entry:1').readOnly).toBe(false)
  })
})

describe('computeTreasury — totaux', () => {
  it('compte le réglé et l’engagé dans le résultat, en les distinguant', () => {
    const report = computeTreasury(
      input({
        artists: [artist({ payment: 50000, paymentPaid: true }), artist({ payment: 10000 })],
        ticketing: ticketingTotals({
          participants: { processed: 120000, onsite: 0, pending: 5000, refunded: 0 },
        }),
      })
    )

    expect(report.totals.expense).toEqual({ settled: 50000, pending: 10000 })
    expect(report.totals.income).toEqual({ settled: 120000, pending: 5000 })
    // Résultat : (120000 + 5000) - (50000 + 10000). Ne retenir que le réglé afficherait 70000 et
    // masquerait les 10000 encore dus.
    expect(report.totals.balance).toBe(65000)
  })

  it('rend un solde négatif quand l’édition est déficitaire', () => {
    const report = computeTreasury(
      input({
        artists: [artist({ payment: 200000, paymentPaid: true })],
        ticketing: ticketingTotals({
          participants: { processed: 50000, onsite: 0, pending: 0, refunded: 0 },
        }),
      })
    )
    expect(report.totals.balance).toBe(-150000)
  })

  it('rend des totaux nuls sur une édition sans rien', () => {
    const report = computeTreasury(input())
    expect(report.totals).toEqual({
      expense: { settled: 0, pending: 0 },
      income: { settled: 0, pending: 0 },
      balance: 0,
      // Rien d'avancé, donc rien à rembourser — mais la clé existe, et `toEqual` la veut.
      toReimburse: { total: 0, detail: [] },
    })
    // Trois origines côté artistes, trois côté billetterie depuis son partage.
    expect(report.lines).toHaveLength(6)
  })
})

describe('computeTreasury — codes d’imputation', () => {
  it('rattache le code retenu à sa ligne calculée', () => {
    const code = { id: 7, code: '6257', label: 'Rémunérations d’intermédiaires' }
    const report = computeTreasury(input({ sourceCodes: { ARTIST_PAYMENT: code } }))

    expect(lineOf(report, 'source:ARTIST_PAYMENT').code).toEqual(code)
    expect(lineOf(report, 'source:TICKETING_PARTICIPANTS').code).toBeNull()
  })
})

describe('aggregateTicketingItems', () => {
  const item = (over: Partial<Parameters<typeof aggregateTicketingItems>[0][number]> = {}) => ({
    amount: 1000,
    orderStatus: 'Processed',
    // Une ligne vivante. `Canceled` est l'état qui l'annule, et il est indépendant du statut de sa
    // commande — les deux vocabulaires ne se recouvrent pas (`billets-qui-comptent.ts`).
    itemState: 'Processed' as string | null,
    countAsParticipant: true as boolean | null,
    type: 'Registration' as string | null,
    ...over,
  })

  it('sépare les entrées des autres produits', () => {
    const totals = aggregateTicketingItems([
      item({ amount: 2500, countAsParticipant: true }),
      item({ amount: 1500, countAsParticipant: false }),
    ])

    expect(totals.participants.processed).toBe(2500)
    expect(totals.other.processed).toBe(1500)
  })

  // Dons et ventes annexes n'ont pas de tarif : les compter comme participants gonflerait le
  // produit des entrées d'un montant qui n'en est pas.
  it('range une vente annexe sans tarif dans les autres produits', () => {
    const totals = aggregateTicketingItems([
      item({ amount: 22500, countAsParticipant: null, type: 'Registration' }),
    ])

    expect(totals.participants.processed).toBe(0)
    expect(totals.other.processed).toBe(22500)
  })

  // Un don n'a pas de tarif, exactement comme un vêtement : seul son type les distingue.
  it('isole les dons des autres produits sans tarif', () => {
    const totals = aggregateTicketingItems([
      item({ amount: 6500, countAsParticipant: null, type: 'Donation' }),
      item({ amount: 4800, countAsParticipant: null, type: 'Registration' }),
    ])

    expect(totals.donations.processed).toBe(6500)
    expect(totals.other.processed).toBe(4800)
    expect(totals.participants.processed).toBe(0)
  })

  // Un don rattaché à un tarif participant reste un don : le type prime.
  it('classe un don avant tout autre critère', () => {
    const totals = aggregateTicketingItems([
      item({ amount: 5000, countAsParticipant: true, type: 'Donation' }),
    ])

    expect(totals.donations.processed).toBe(5000)
    expect(totals.participants.processed).toBe(0)
  })

  // Le statut de commande gouverne : une commande encaissée sur place porte `Onsite` quand ses
  // lignes portent `Processed`, et c'est le premier qui distingue le sur-place de l'externe.
  it('ventile selon le statut de la commande', () => {
    const totals = aggregateTicketingItems([
      item({ amount: 100, orderStatus: 'Processed' }),
      item({ amount: 200, orderStatus: 'Onsite' }),
      item({ amount: 300, orderStatus: 'Pending' }),
      item({ amount: 400, orderStatus: 'Refunded' }),
    ])

    expect(totals.participants).toEqual({
      processed: 100,
      onsite: 200,
      pending: 300,
      refunded: 400,
      canceled: 0,
    })
  })

  /*
   * L'état de la LIGNE, que ce calcul ne regardait pas du tout.
   *
   * Douze lignes `Canceled` de la production vivent dans des commandes `Processed` : elles étaient
   * comptées comme un produit encaissé. Les deux vocabulaires ne se recouvrent pas — aucune ligne
   * n'est jamais `Refunded`, aucune commande n'est jamais `Canceled` — donc filtrer sur le statut de
   * commande ne pouvait pas les attraper.
   */
  it('écarte une ligne annulée, même dans une commande encaissée', () => {
    const totals = aggregateTicketingItems([
      item({ amount: 100, itemState: 'Processed', orderStatus: 'Processed' }),
      item({ amount: 700, itemState: 'Canceled', orderStatus: 'Processed' }),
    ])

    expect(totals.participants.processed).toBe(100)
    // Conservée à titre informatif, pour qu'on puisse lire ce qui a été écarté.
    expect(totals.participants.canceled).toBe(700)
  })

  it('écarte aussi une ligne remboursée, valeur qu’aucune ligne ne porte aujourd’hui', () => {
    // `ETATS_DE_BILLET_ANNULE` la conserve parce que la garde d'origine la visait et qu'aucune trace
    // ne dit si elle a existé. La trésorerie suit la même liste que la porte.
    const totals = aggregateTicketingItems([
      item({ amount: 300, itemState: 'Refunded', orderStatus: 'Processed' }),
    ])

    expect(totals.participants.processed).toBe(0)
    expect(totals.participants.canceled).toBe(300)
  })

  it('compte une ligne dont l’état est inconnu ou absent', () => {
    /*
     * `state` est une chaîne libre. Traiter d'office une valeur inconnue comme une annulation
     * retirerait des produits réels d'un bilan comptable sur une simple nouveauté du fournisseur.
     * C'est le même arbitrage que `ETATS_DE_BILLET_ANNULE` : une liste explicite, jamais un
     * complément.
     */
    const totals = aggregateTicketingItems([
      item({ amount: 100, itemState: 'Quelque chose de neuf' }),
      item({ amount: 200, itemState: null }),
    ])

    expect(totals.participants.processed).toBe(300)
    expect(totals.participants.canceled).toBe(0)
  })

  it('ignore un statut inconnu plutôt que de l’imputer au hasard', () => {
    const totals = aggregateTicketingItems([item({ amount: 999, orderStatus: 'Draft' })])
    expect(totals.participants).toEqual({
      processed: 0,
      onsite: 0,
      pending: 0,
      refunded: 0,
      canceled: 0,
    })
  })

  /**
   * Le point qui justifie tout le reste : découper ne doit rien changer au total affiché.
   *
   * Les chiffres viennent de la base de développement — 356 commandes, 12 294,62 € — dont le
   * total se répartit exactement entre entrées, autres produits et lignes sans tarif.
   */
  it('conserve le total, quel que soit le partage', () => {
    const rows = [
      item({ amount: 1062723, countAsParticipant: true }),
      item({ amount: 132939, countAsParticipant: false }),
      item({ amount: 27300, countAsParticipant: null, type: 'Registration' }),
      item({ amount: 6500, countAsParticipant: null, type: 'Donation' }),
    ]
    const totals = aggregateTicketingItems(rows)

    const report = computeTreasury(input({ ticketing: totals }))
    const ticketingIncome = report.lines
      .filter((l) => l.source?.startsWith('TICKETING_'))
      .reduce((sum, l) => sum + l.settled + l.pending, 0)

    expect(ticketingIncome).toBe(1229462)
  })
})

/**
 * Prévisionnel et avances — deux ajouts demandés par les organisateurs.
 *
 * Une ligne saisie à la main était réputée réglée faute de pouvoir dire le contraire : une dépense
 * seulement prévue gonflait le réglé au même titre qu'une facture payée.
 *
 * L'avance est un axe distinct : la dépense est réglée du point de vue du fournisseur, mais
 * l'association doit le montant à la personne qui l'a sortie de sa poche. Cette dette
 * n'apparaissait dans aucun total.
 */
const ALICE = { id: 1, pseudo: 'alice' }
const BOB = { id: 2, pseudo: 'bob' }

const depense = (over: Record<string, unknown> = {}) => ({
  id: 1,
  kind: 'EXPENSE' as const,
  title: 'Courses',
  description: null,
  amount: 5000,
  code: null,
  ...over,
})

describe('computeTreasury — prévisionnel', () => {
  it('bascule une ligne prévisionnelle du réglé vers l’engagé', () => {
    const report = computeTreasury(input({ manualEntries: [depense({ isForecast: true })] }))

    expect(report.totals.expense).toEqual({ settled: 0, pending: 5000 })
    // Le solde compte l'engagé : il ne bouge pas, c'est bien le réglé que le drapeau corrige.
    expect(report.totals.balance).toBe(-5000)
  })

  it('laisse une ligne ordinaire réglée', () => {
    const report = computeTreasury(input({ manualEntries: [depense()] }))

    expect(report.totals.expense).toEqual({ settled: 5000, pending: 0 })
    expect(report.totals.balance).toBe(-5000)
  })
})

describe('computeTreasury — avances à rembourser', () => {
  it('additionne les avances non remboursées, par personne', () => {
    const report = computeTreasury(
      input({
        manualEntries: [
          depense({ id: 1, amount: 5000, advancedBy: ALICE }),
          depense({ id: 2, amount: 3000, advancedBy: ALICE }),
          depense({ id: 3, amount: 9000, advancedBy: BOB }),
        ],
      })
    )

    expect(report.totals.toReimburse.total).toBe(17000)
    // Trié du plus gros au plus petit : c'est l'ordre dans lequel on rembourse.
    expect(report.totals.toReimburse.detail.map((d) => [d.personne.pseudo, d.montant])).toEqual([
      ['bob', 9000],
      ['alice', 8000],
    ])
  })

  it('exclut ce qui est déjà remboursé', () => {
    const report = computeTreasury(
      input({
        manualEntries: [
          depense({ id: 1, amount: 5000, advancedBy: ALICE, reimbursed: true }),
          depense({ id: 2, amount: 3000, advancedBy: ALICE }),
        ],
      })
    )

    expect(report.totals.toReimburse.total).toBe(3000)
  })

  it('exclut une avance seulement prévisionnelle', () => {
    // Rien n'est encore sorti de la poche de personne : il n'y a rien à rembourser.
    const report = computeTreasury(
      input({
        manualEntries: [depense({ amount: 5000, advancedBy: ALICE, isForecast: true })],
      })
    )

    expect(report.totals.toReimburse.total).toBe(0)
    expect(report.totals.toReimburse.detail).toEqual([])
  })

  it('ignore une recette et une dépense sans avance', () => {
    const report = computeTreasury(
      input({
        manualEntries: [
          depense({ id: 1, kind: 'INCOME', amount: 5000, advancedBy: ALICE }),
          depense({ id: 2, amount: 4000 }),
        ],
      })
    )

    expect(report.totals.toReimburse.total).toBe(0)
  })
})

/**
 * La date d'opération survit au passage par `computeTreasury`.
 *
 * C'est le trajet qui manquait. L'API la sélectionnait bien en base et l'écran savait la rendre,
 * mais la ligne renvoyée était assemblée ici sans elle : la colonne restait vide quoi qu'on
 * saisisse, et l'export CSV muet, sans qu'aucune erreur ne le signale.
 *
 * Les tests d'alors visaient les deux bouts — le `select` de la requête et l'écriture du champ —
 * et laissaient au milieu le seul endroit qui pouvait la perdre.
 */
describe('computeTreasury — date d’opération', () => {
  const ligneSaisie = (over: Record<string, unknown> = {}) =>
    computeTreasury(input({ manualEntries: [depense(over)] })).lines.find(
      (l) => l.origin === 'manual'
    )!

  it('reporte la date sur la ligne renvoyée', () => {
    const jour = new Date('2026-06-12T00:00:00.000Z')

    expect(ligneSaisie({ operationDate: jour }).operationDate).toBe(jour)
  })

  it('rend `null` quand l’entrée n’en porte pas', () => {
    // Les entrées antérieures au champ. `null` et non `undefined` : l'écran teste la valeur, et
    // l'absence doit se lire pareil d'une ligne à l'autre.
    expect(ligneSaisie().operationDate).toBeNull()
  })

  it('n’en invente pas sur une ligne calculée', () => {
    // Billetterie, artistes : ces lignes n'ont pas de date d'opération par nature.
    const report = computeTreasury(input({ manualEntries: [] }))

    for (const ligne of report.lines.filter((l) => l.origin === 'source')) {
      expect(ligne.operationDate).toBeUndefined()
    }
  })
})

/**
 * Un produit nommé qui tire son montant de tarifs choisis.
 *
 * ⚠️ CE N'EST PAS UNE SOUSTRACTION, C'EST UN RÉACHEMINEMENT, et c'est l'invariant que ces tests
 * gardent : la ligne de commande part vers le produit nommé AU LIEU d'aller dans « entrées » ou
 * « autres produits ». Un montant retranché après coup aurait pu dériver au centime ou être
 * compté deux fois ; ici le total ne peut pas bouger, par construction.
 */
describe('aggregateTicketingItems — regroupement par tarifs', () => {
  const item = (over: Partial<Parameters<typeof aggregateTicketingItems>[0][number]> = {}) => ({
    amount: 1000,
    orderStatus: 'Processed',
    itemState: 'Processed' as string | null,
    countAsParticipant: false as boolean | null,
    type: 'Registration' as string | null,
    ...over,
  })

  it('détourne un tarif rattaché hors des autres produits', () => {
    const totals = aggregateTicketingItems(
      [item({ amount: 2500, tierId: 7 }), item({ amount: 1500, tierId: 9 })],
      [{ entryId: 42, tierIds: [7] }]
    )

    expect(totals.parLigne[42]!.processed).toBe(2500)
    // Le tarif 9 n'est rattaché à rien : il reste où il était.
    expect(totals.other.processed).toBe(1500)
  })

  it('détourne aussi un tarif COMPTÉ COMME PARTICIPANT', () => {
    /*
     * Décidé avec l'utilisateur le 06/10/2026 : tous les tarifs sont rattachables, pas seulement
     * ceux des « autres produits ». Le montant quitte alors « Billetterie — entrées », ce qui
     * entame la ligne qu'on rapproche du nombre de participants — c'est assumé.
     */
    const totals = aggregateTicketingItems(
      [item({ amount: 3000, countAsParticipant: true, tierId: 3 })],
      [{ entryId: 11, tierIds: [3] }]
    )

    expect(totals.participants.processed).toBe(0)
    expect(totals.parLigne[11]!.processed).toBe(3000)
  })

  it('ne touche PAS aux dons, qui n’ont pas de tarif', () => {
    const totals = aggregateTicketingItems(
      [item({ amount: 5000, countAsParticipant: null, type: 'Donation', tierId: null })],
      [{ entryId: 1, tierIds: [7] }]
    )

    expect(totals.donations.processed).toBe(5000)
    expect(totals.parLigne[1]!.processed).toBe(0)
  })

  it('applique les mêmes règles de statut que les autres lignes', () => {
    // Sans cela, le produit nommé divergerait du solde affiché juste au-dessus de lui.
    const totals = aggregateTicketingItems(
      [
        item({ amount: 100, tierId: 7, orderStatus: 'Processed' }),
        item({ amount: 200, tierId: 7, orderStatus: 'Onsite' }),
        item({ amount: 400, tierId: 7, orderStatus: 'Pending' }),
        item({ amount: 800, tierId: 7, orderStatus: 'Refunded' }),
        item({ amount: 1600, tierId: 7, itemState: 'Canceled' }),
      ],
      [{ entryId: 5, tierIds: [7] }]
    )

    const bucket = totals.parLigne[5]!
    expect(bucket.processed).toBe(100)
    expect(bucket.onsite).toBe(200)
    expect(bucket.pending).toBe(400)
    expect(bucket.refunded).toBe(800)
    expect(bucket.canceled).toBe(1600)
  })

  it('LE TOTAL NE BOUGE PAS, avec ou sans regroupement', () => {
    /*
     * L'invariant qui justifie tout le dessin. On somme les quatre seaux dans les deux cas : un
     * réacheminement ne crée ni ne détruit d'argent, il le range ailleurs.
     */
    const lignes = [
      item({ amount: 2500, countAsParticipant: true, tierId: 1 }),
      item({ amount: 1500, tierId: 2 }),
      item({ amount: 700, countAsParticipant: null, type: 'Donation', tierId: null }),
    ]
    const somme = (totals: ReturnType<typeof aggregateTicketingItems>) =>
      [
        totals.participants,
        totals.donations,
        totals.other,
        ...Object.values(totals.parLigne),
      ].reduce((t, b) => t + b.processed + b.onsite + b.pending, 0)

    expect(somme(aggregateTicketingItems(lignes))).toBe(4700)
    expect(somme(aggregateTicketingItems(lignes, [{ entryId: 8, tierIds: [1, 2] }]))).toBe(4700)
  })

  it('déclare un seau VIDE pour un regroupement sans vente', () => {
    // Sinon `parLigne[id]` serait `undefined` et la ligne afficherait un montant absent plutôt que
    // zéro — un produit créé avant la première vente doit s'afficher à 0, pas disparaître.
    const totals = aggregateTicketingItems([], [{ entryId: 3, tierIds: [7] }])

    expect(totals.parLigne[3]).toEqual({
      processed: 0,
      onsite: 0,
      pending: 0,
      refunded: 0,
      canceled: 0,
    })
  })
})
