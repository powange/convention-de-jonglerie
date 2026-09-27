import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
  if (!(globalThis as any).validateEditionId) {
    ;(globalThis as any).validateEditionId = (event: any) =>
      parseInt(event?.context?.params?.id, 10)
  }
})

const mockCanManage = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTreasuryById: mockCanManage,
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../server/api/editions/[id]/treasury/entries/reimburse.post'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Solder en un versement les avances d'une personne SANS COMPTE.
 *
 * Le panneau « à rembourser » regroupe « Jean-Luc » et « jean-luc » sur une seule dette. Verser la
 * somme doit donc solder les deux lignes : si ce point d'API en retient moins que l'agrégat, on
 * paie une personne et il reste des lignes ouvertes à son nom — un écart qu'on ne découvre qu'en
 * relisant le tableau, longtemps après.
 *
 * D'où la comparaison par `cleDuNomAvance` plutôt que par égalité de chaîne, et ces tests dessus.
 */
describe('POST /api/editions/[id]/treasury/entries/reimburse', () => {
  const evenement = (body: unknown) =>
    ({ context: { params: { id: '42' }, user: { id: 1 } }, __body: body }) as any

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.treasuryEntry.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.treasuryEntry.findMany.mockResolvedValue([])
  })

  const avecCorps = (body: unknown) => {
    global.readBody = vi.fn().mockResolvedValue(body)
    return evenement(body)
  }

  it('solde les avances d’un compte par son identifiant', async () => {
    prismaMock.treasuryEntry.updateMany.mockResolvedValue({ count: 3 })

    const reponse = (await handler(avecCorps({ advancedById: 7 }))) as any

    expect(reponse.data.count).toBe(3)
    expect(prismaMock.treasuryEntry.updateMany).toHaveBeenCalledWith({
      where: {
        editionId: 42,
        kind: 'EXPENSE',
        reimbursed: false,
        isForecast: false,
        advancedById: 7,
      },
      data: { reimbursed: true },
    })
    // Aucune lecture préalable : le compte se retrouve par égalité, rien à normaliser.
    expect(prismaMock.treasuryEntry.findMany).not.toHaveBeenCalled()
  })

  it('solde toutes les orthographes d’un même nom libre', async () => {
    /*
     * Le test qui porte le risque. Une égalité de chaîne n'aurait retenu que la première ligne ;
     * s'en remettre à la collation de MySQL aurait rattrapé la casse et les accents, mais pas
     * l'espace en trop.
     */
    prismaMock.treasuryEntry.findMany.mockResolvedValue([
      { id: 10, advancedByName: 'Jean-Luc' },
      { id: 11, advancedByName: 'jean-luc' },
      { id: 12, advancedByName: '  JEAN-LUC ' },
      { id: 13, advancedByName: 'Camille' },
    ])
    prismaMock.treasuryEntry.updateMany.mockResolvedValue({ count: 3 })

    await handler(avecCorps({ advancedByName: 'Jean-Luc' }))

    const argument = prismaMock.treasuryEntry.updateMany.mock.calls[0][0]
    expect(argument.where.id).toEqual({ in: [10, 11, 12] })
    // Camille n'est pas soldée : le regroupement ne déborde pas sur une autre personne.
    expect(argument.where.id.in).not.toContain(13)
    expect(argument.data).toEqual({ reimbursed: true })
  })

  it('accepte la clé déjà normalisée que le panneau envoie', async () => {
    // La page envoie `n:jean-luc` sans son préfixe, donc une valeur DÉJÀ normalisée. Le
    // normaliseur étant idempotent, elle retrouve bien les lignes.
    prismaMock.treasuryEntry.findMany.mockResolvedValue([
      { id: 10, advancedByName: 'Jean-Luc' },
      { id: 11, advancedByName: 'jean-luc' },
    ])
    prismaMock.treasuryEntry.updateMany.mockResolvedValue({ count: 2 })

    await handler(avecCorps({ advancedByName: 'jean-luc' }))

    expect(prismaMock.treasuryEntry.updateMany.mock.calls[0][0].where.id).toEqual({ in: [10, 11] })
  })

  it('ne cherche que parmi les avances non remboursées, non prévisionnelles et sans compte', async () => {
    // Le lot doit être EXACTEMENT celui que totalise le panneau : mêmes filtres, sinon on solde
    // une ligne prévisionnelle — dont l'argent n'est pas encore sorti d'une poche.
    await handler(avecCorps({ advancedByName: 'Jean-Luc' }))

    expect(prismaMock.treasuryEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          editionId: 42,
          kind: 'EXPENSE',
          reimbursed: false,
          isForecast: false,
          advancedById: null,
          NOT: { advancedByName: null },
        },
      })
    )
  })

  it('n’écrit rien quand aucun nom ne correspond', async () => {
    prismaMock.treasuryEntry.findMany.mockResolvedValue([{ id: 13, advancedByName: 'Camille' }])

    const reponse = (await handler(avecCorps({ advancedByName: 'Jean-Luc' }))) as any

    expect(reponse.data.count).toBe(0)
    expect(prismaMock.treasuryEntry.updateMany).not.toHaveBeenCalled()
  })

  it('refuse un corps qui donne les deux, ou aucun des deux', async () => {
    // Sans cette exclusivité, le point d'API devrait choisir à la place de l'appelant.
    await expect(
      handler(avecCorps({ advancedById: 7, advancedByName: 'Jean-Luc' }))
    ).rejects.toThrow()
    await expect(handler(avecCorps({}))).rejects.toThrow()
  })

  it('refuse un utilisateur sans droit sur la trésorerie', async () => {
    mockCanManage.mockResolvedValue(false)

    await expect(handler(avecCorps({ advancedByName: 'Jean-Luc' }))).rejects.toThrow()
    expect(prismaMock.treasuryEntry.findMany).not.toHaveBeenCalled()
    expect(prismaMock.treasuryEntry.updateMany).not.toHaveBeenCalled()
  })
})
