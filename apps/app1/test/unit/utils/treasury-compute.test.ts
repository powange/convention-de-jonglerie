import { describe, it, expect } from 'vitest'

import {
  computeTreasury,
  type ArtistAmountsRow,
  type ComputeInput,
} from '../../../server/utils/treasury-compute'

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
    ticketing: { processed: 0, onsite: 0, pending: 0, refunded: 0 },
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
  // Un remboursement est de l'argent encaissé puis rendu : il diminue les produits plutôt que
  // d'apparaître en charge.
  it('déduit les remboursements des produits', () => {
    const report = computeTreasury(
      input({ ticketing: { processed: 820062, onsite: 345250, pending: 31000, refunded: 4600 } })
    )

    expect(lineOf(report, 'source:TICKETING_ORDERS')).toMatchObject({
      kind: 'INCOME',
      settled: 820062 + 345250 - 4600,
      pending: 31000,
    })
  })

  it('accepte que les remboursements dépassent les encaissements', () => {
    const report = computeTreasury(
      input({ ticketing: { processed: 1000, onsite: 0, pending: 0, refunded: 2500 } })
    )
    expect(lineOf(report, 'source:TICKETING_ORDERS').settled).toBe(-1500)
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
    ])
    expect(lineOf(report, 'entry:1').readOnly).toBe(false)
  })
})

describe('computeTreasury — totaux', () => {
  it('compte le réglé et l’engagé dans le résultat, en les distinguant', () => {
    const report = computeTreasury(
      input({
        artists: [artist({ payment: 50000, paymentPaid: true }), artist({ payment: 10000 })],
        ticketing: { processed: 120000, onsite: 0, pending: 5000, refunded: 0 },
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
        ticketing: { processed: 50000, onsite: 0, pending: 0, refunded: 0 },
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
    })
    expect(report.lines).toHaveLength(4)
  })
})

describe('computeTreasury — codes d’imputation', () => {
  it('rattache le code retenu à sa ligne calculée', () => {
    const code = { id: 7, code: '6257', label: 'Rémunérations d’intermédiaires' }
    const report = computeTreasury(input({ sourceCodes: { ARTIST_PAYMENT: code } }))

    expect(lineOf(report, 'source:ARTIST_PAYMENT').code).toEqual(code)
    expect(lineOf(report, 'source:TICKETING_ORDERS').code).toBeNull()
  })
})
