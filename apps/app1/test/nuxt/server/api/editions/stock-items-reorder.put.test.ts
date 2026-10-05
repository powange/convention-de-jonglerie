import { describe, it, expect, beforeEach, vi } from 'vitest'

/*
 * ⚠️ `readBody` ET `getRouterParam` SE POSENT PAR `global.`, PAS DANS UN `vi.hoisted`.
 *
 * Une première version les définissait dans un préambule hoisté ; le harnais du dépôt
 * (`test/setup.ts`) les remplace ensuite par ses propres mocks, qui rendent `undefined`. Le corps
 * n'arrivait donc jamais, zod refusait, et TROIS cas passaient au vert pour cette raison : ils
 * attendaient un 400, et le 400 venait de la validation, pas de la règle éprouvée.
 */
vi.hoisted(() => {
  const g = globalThis as any
  if (!g.wrapApiHandler) g.wrapApiHandler = (handler: any) => handler
  if (!g.validateEditionId) g.validateEditionId = (e: any) => parseInt(e?.context?.params?.id, 10)
  if (!g.createSuccessResponse)
    g.createSuccessResponse = (data: unknown, message?: string) => ({
      success: true,
      data,
      message,
    })
})

import { global } from '../../../globales-nitro'

const canManageStockMock = vi.hoisted(() => vi.fn())
const getEditionMock = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageStock: canManageStockMock,
  getEditionWithPermissions: getEditionMock,
}))
vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: (event: any) => {
    if (!event.context.user) {
      const erreur = new Error('Non authentifié')
      ;(erreur as any).statusCode = 401
      throw erreur
    }
    return event.context.user
  },
}))

const handler = (
  await import('../../../../../../../layers/stock/server/api/editions/[id]/stock-groups/[groupId]/items/reorder.put')
).default

const prismaMock = (globalThis as any).prisma

/**
 * L'ordre des objets d'un groupe de stock.
 *
 * ⚠️ CE QUE CE POINT D'API AJOUTE. `displayOrder` existait en base, la création l'attribuait, la
 * lecture triait dessus — mais RIEN ne permettait de le changer. L'ordre valait donc l'ordre
 * d'ajout, définitivement.
 *
 * 🔬 LA GARDE QUI COMPTE EST LA COMPLÉTUDE DE LA LISTE, et c'est le cas qu'on éprouve en premier.
 * Accepter une liste partielle laisserait les objets absents sur leur ancien rang, mêlés aux
 * nouveaux : un ordre que personne n'a demandé, et que rien ne signalerait à l'écran.
 */
describe('PUT stock-groups/[groupId]/items/reorder', () => {
  const evenement = (itemIds: number[] | undefined, userId: number | null = 1) => {
    global.readBody = vi.fn().mockResolvedValue({ itemIds })
    return { context: { params: { id: '22' }, user: userId ? { id: userId } : null } }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn((_event: unknown, cle: string) =>
      cle === 'groupId' ? '7' : '22'
    )
    getEditionMock.mockResolvedValue({ id: 22 })
    canManageStockMock.mockReturnValue(true)
    prismaMock.stockGroup = { findFirst: vi.fn().mockResolvedValue({ id: 7 }) }
    prismaMock.stockItem = {
      findMany: vi.fn().mockResolvedValue([{ id: 10 }, { id: 11 }, { id: 12 }]),
      update: vi.fn((args: unknown) => args),
    }
    prismaMock.$transaction = vi.fn().mockResolvedValue([])
  })

  it('écrit le rang de chaque objet, dans l’ordre reçu', async () => {
    const reponse: any = await handler(evenement([12, 10, 11]) as never)

    expect(reponse.data.count).toBe(3)
    // 🔬 Le rang est la POSITION dans la liste, pas l'identifiant : c'est tout l'objet du point
    // d'API, et une inversion ici passerait inaperçue à la relecture.
    const rangs = prismaMock.stockItem.update.mock.calls.map(([args]: any[]) => [
      args.where.id,
      args.data.displayOrder,
    ])
    expect(rangs).toEqual([
      [12, 0],
      [10, 1],
      [11, 2],
    ])
  })

  it('refuse une liste incomplète', async () => {
    await expect(handler(evenement([10, 11]) as never)).rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('refuse un objet répété', async () => {
    // Trois identifiants pour trois objets, mais l'un est compté deux fois : le troisième
    // garderait son ancien rang en silence.
    await expect(handler(evenement([10, 10, 11]) as never)).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('refuse un objet étranger au groupe', async () => {
    await expect(handler(evenement([10, 11, 99]) as never)).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('refuse qui n’a pas le droit de gérer le stock', async () => {
    canManageStockMock.mockReturnValue(false)

    await expect(handler(evenement([10, 11, 12]) as never)).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('refuse un groupe qui n’est pas de cette édition', async () => {
    // Sans cette garde, le droit de gérer SON stock permettrait de réordonner celui d'une autre
    // convention.
    prismaMock.stockGroup.findFirst = vi.fn().mockResolvedValue(null)

    await expect(handler(evenement([10, 11, 12]) as never)).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})
