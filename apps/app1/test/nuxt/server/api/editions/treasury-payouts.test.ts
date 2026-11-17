import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
})

const mockCanManage = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTreasuryById: mockCanManage,
  canAccessEditionData: vi.fn(async () => true),
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../server/api/editions/[id]/treasury/payouts.get'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Le point d'API des versements à faire : ce qu'il LIT, et pour qui.
 *
 * ## ⚠️ POURQUOI CE FICHIER EXISTE
 *
 * Le calcul et les traductions sont couverts par `test/unit/server/treasury-payouts.test.ts`. Ce
 * qui ne l'était pas, c'est **l'assemblage** : les deux requêtes et leurs filtres `where`. Or c'est
 * là que j'ai dû deviner le schéma — et me tromper une fois, en supposant un champ `artistName`
 * sur `EditionArtist`, qui porte en réalité un `userId`.
 *
 * Le typage a rattrapé ce cas-là. Il ne rattraperait PAS un filtre mal posé : un `where` qui
 * oublierait `disbursed: false` compilerait parfaitement et ferait virer deux fois.
 */
const EDITION = 22

const appeler = () => {
  global.getRouterParam = vi.fn(() => String(EDITION))
  return (handler as (e: unknown) => Promise<any>)({
    context: { user: { id: 7 }, params: { id: String(EDITION) } },
  })
}

describe('GET /api/editions/[id]/treasury/payouts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.treasuryEntry.findMany.mockResolvedValue([])
    prismaMock.editionArtist.findMany.mockResolvedValue([])
  })

  it('⚠️ refuse qui n’a pas le droit de gérer la trésorerie — ce point rend des IBAN', async () => {
    /*
     * C'est le SEUL point d'API de la trésorerie à rendre des coordonnées bancaires, artistes
     * compris. Sa garde est donc ce qui tient l'élargissement d'accès décidé le 17/11.
     */
    mockCanManage.mockResolvedValue(false)

    await expect(appeler()).rejects.toBeDefined()
    expect(prismaMock.treasuryEntry.findMany).not.toHaveBeenCalled()
    expect(prismaMock.editionArtist.findMany).not.toHaveBeenCalled()
  })

  it('⚠️ ne lit QUE les dépenses à régler NON ENCORE VERSÉES', async () => {
    /*
     * Un `where` qui oublierait `disbursed: false` compilerait parfaitement et ferait apparaître
     * des virements déjà faits : on paierait deux fois. Le filtre est donc asséré en entier.
     */
    await appeler()

    expect(prismaMock.treasuryEntry.findMany.mock.calls[0]![0].where).toEqual({
      editionId: EDITION,
      kind: 'EXPENSE',
      payeeId: { not: null },
      disbursed: false,
    })
  })

  it('⚠️ ne lit que les artistes à qui il RESTE quelque chose à verser', async () => {
    /*
     * Les trois sommes sont indépendantes : un artiste peut avoir touché son cachet et pas son
     * défraiement. Le filtre les regarde donc séparément, en `OR`. Les lier ferait disparaître des
     * dettes réelles.
     */
    await appeler()

    const where = prismaMock.editionArtist.findMany.mock.calls[0]![0].where
    expect(where.editionId).toBe(EDITION)
    expect(where.OR).toEqual([
      { paymentPaid: false, payment: { gt: 0 } },
      { reimbursementActualPaid: false, reimbursementActual: { gt: 0 } },
      { consumablesActualPaid: false, consumablesActual: { gt: 0 } },
    ])
  })

  it('📍 lit le nom de l’artiste depuis son COMPTE, pas depuis sa fiche', async () => {
    /*
     * `EditionArtist` n'a pas de champ de nom : il porte un `userId`. Le supposer aurait produit
     * un libellé vide sur un ordre de virement — ou une erreur Prisma à l'exécution.
     */
    const select = prismaMock.editionArtist.findMany.mock.calls
    await appeler()

    expect(
      select[0]?.[0]?.select ?? prismaMock.editionArtist.findMany.mock.calls[0]![0].select
    ).toHaveProperty('user')
  })

  it('⚠️ fond les DEUX sources dans un seul total', async () => {
    /*
     * Le cœur du lot : une facture et un cachet alimentent la même carte. Si l'une des deux
     * sources était oubliée à l'assemblage, le total serait juste dans sa forme et incomplet —
     * exactement le genre de chiffre comptable qu'on ne recoupe jamais.
     */
    prismaMock.treasuryEntry.findMany.mockResolvedValue([
      {
        id: 1,
        title: 'Location',
        amount: 100_00,
        isForecast: false,
        code: null,
        payee: { id: 1, label: 'Chapiteaux du Sud', iban: null, bic: null },
      },
    ])
    prismaMock.editionArtist.findMany.mockResolvedValue([
      {
        id: 5,
        user: { id: 9, pseudo: 'Jongleur' },
        iban: null,
        bic: null,
        payment: 300_00,
        paymentPaid: false,
        reimbursementActual: null,
        reimbursementActualPaid: false,
        consumablesActual: null,
        consumablesActualPaid: false,
      },
    ])

    const resultat = await appeler()

    expect(resultat.data.total).toBe(400_00)
    expect(resultat.data.destinataires).toHaveLength(2)
    expect(resultat.data.destinataires.map((d: any) => d.origine).sort()).toEqual([
      'artist',
      'payee',
    ])
  })

  it('⚠️ compte une dépense PRÉVISIONNELLE pour son montant, pas pour zéro', async () => {
    /*
     * Le montant d'une ligne prévisionnelle vit dans `pending`. Si l'assemblage ne retenait que
     * `settled`, un devis signé non encore viré — le cas le plus courant — compterait pour zéro.
     */
    prismaMock.treasuryEntry.findMany.mockResolvedValue([
      {
        id: 1,
        title: 'Devis signé',
        amount: 250_00,
        isForecast: true,
        code: null,
        payee: { id: 1, label: 'Chapiteaux du Sud', iban: null, bic: null },
      },
    ])

    const resultat = await appeler()

    expect(resultat.data.total).toBe(250_00)
  })
})
