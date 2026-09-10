import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())
const mockCanManageStock = vi.hoisted(() => vi.fn())
const mockValidateReservationLocation = vi.hoisted(() => vi.fn())
const mockAssertTags = vi.hoisted(() => vi.fn())
const mockAssertResponsables = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEditionWithPermissions,
  canManageStock: mockCanManageStock,
}))

vi.mock('#server/utils/stock-helpers', () => ({
  validateReservationLocation: mockValidateReservationLocation,
  stockItemLocationInclude: {},
}))

vi.mock('#server/utils/stock-tags-helpers', () => ({
  assertTagsBelongToEdition: mockAssertTags,
}))

vi.mock('#server/utils/personnes-edition', () => ({
  assertResponsablesDeLEdition: mockAssertResponsables,
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../../../../layers/stock/server/api/editions/[id]/stock-items/bulk.patch'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'u@t.com', pseudo: 'u' }
const mockEdition = {
  id: 1,
  conventionId: 10,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}

const baseEvent = { context: { params: { id: '1' }, user: mockUser } }

/**
 * Le comptage d'inventaire écrit une valeur différente par objet — ce qui le distingue de tout le
 * reste du lot, où la même valeur va à toute la sélection. Une séance écrit trente valeurs en une
 * fois, et les écrire une par une laisserait un inventaire à moitié saisi si le réseau lâche au
 * milieu. On compte dans un hangar.
 */
describe('PATCH /api/editions/[id]/stock-items/bulk — comptage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageStock.mockReturnValue(true)
    mockValidateReservationLocation.mockResolvedValue(undefined)
    mockAssertTags.mockResolvedValue(undefined)
    mockAssertResponsables.mockResolvedValue(undefined)

    // Le mock répond ce qu'on lui demande : le gestionnaire compare le nombre d'objets trouvés
    // au nombre demandé, et un mock figé ferait échouer les tests pour la mauvaise raison.
    prismaMock.stockItem.findMany.mockReset()
    prismaMock.stockItem.findMany.mockImplementation(async ({ where }: any) =>
      (where?.id?.in ?? []).map((id: number) => ({
        id,
        isExternalLoan: false,
        pickedUpAt: null,
        returnedAt: null,
      }))
    )
    prismaMock.stockItem.update.mockReset()
    prismaMock.stockItem.update.mockResolvedValue({})
    prismaMock.stockItem.updateMany.mockReset()
    prismaMock.$transaction.mockImplementation(async (arg: any) => {
      if (typeof arg === 'function') return arg(prismaMock)
      return Promise.all(arg)
    })
  })

  it('écrit une valeur par objet', async () => {
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({
      itemIds: [10, 11],
      comptage: [
        { id: 10, finalQuantity: 8 },
        { id: 11, finalQuantity: 0 },
      ],
    })

    const resultat = await handler(baseEvent as any)

    expect(prismaMock.stockItem.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { finalQuantity: 8 },
    })
    // Zéro est une nouvelle, pas une absence : tout a disparu, et il faut pouvoir l'écrire.
    expect(prismaMock.stockItem.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { finalQuantity: 0 },
    })
    expect(resultat.data.comptages).toBe(2)
  })

  it('laisse effacer un comptage', async () => {
    // C'est le geste qui défait un comptage écrit par erreur : la ligne redevient « jamais
    // comptée », ce qui n'est pas « comptée à zéro ».
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({
      itemIds: [10],
      comptage: [{ id: 10, finalQuantity: null }],
    })

    await handler(baseEvent as any)

    expect(prismaMock.stockItem.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { finalQuantity: null },
    })
  })

  it('écrit tout dans la même transaction', async () => {
    // Un inventaire à moitié écrit serait pire que pas d'inventaire : on ne saurait pas quelles
    // caisses ont été comptées.
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({
      itemIds: [10, 11],
      comptage: [
        { id: 10, finalQuantity: 1 },
        { id: 11, finalQuantity: 2 },
      ],
    })

    await handler(baseEvent as any)

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
  })

  it('refuse un objet compté hors de la sélection', async () => {
    // La sélection est ce qui a été confronté à l'édition. Un identifiant qui la contourne
    // écrirait dans une autre convention avec la permission d'ici.
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({
      itemIds: [10],
      comptage: [{ id: 999, finalQuantity: 3 }],
    })

    await expect(handler(baseEvent as any)).rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.stockItem.update).not.toHaveBeenCalled()
  })

  it('refuse une quantité comptée au-delà de la borne', async () => {
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({
      itemIds: [10],
      comptage: [{ id: 10, finalQuantity: 10001 }],
    })

    await expect(handler(baseEvent as any)).rejects.toThrow()
  })

  it("n'écrit rien sans comptage", async () => {
    // Une demande qui ne porte que sur d'autres champs ne doit pas toucher aux quantités
    // constatées.
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({
      itemIds: [10],
      location: 'Local technique',
    })

    await handler(baseEvent as any)

    expect(prismaMock.stockItem.update).not.toHaveBeenCalled()
  })
})
