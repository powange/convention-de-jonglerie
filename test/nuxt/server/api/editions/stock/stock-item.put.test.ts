import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())
const mockCanManageStock = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEditionWithPermissions,
  canManageStock: mockCanManageStock,
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../../server/api/editions/[id]/stock-items/[itemId]/index.put'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'u@t.com', pseudo: 'u' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}

const baseEvent = { context: { params: { id: '1', itemId: '5' }, user: mockUser } }

describe('PUT /api/editions/[id]/stock-items/[itemId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageStock.mockReturnValue(true)
    prismaMock.stockItem.findFirst.mockReset()
    prismaMock.stockGroup.findFirst.mockReset()
    prismaMock.editionZone.findMany.mockReset()
    prismaMock.editionMarker.findMany.mockReset()
    prismaMock.stockItem.update.mockReset()
    prismaMock.stockItemLocation.deleteMany.mockReset()
    prismaMock.stockItemLocation.createMany.mockReset()
    prismaMock.stockItemLocation.findMany.mockReset()
    prismaMock.stockItemLocation.findMany.mockResolvedValue([])
    prismaMock.stockReservation.findMany.mockReset()
    prismaMock.stockReservation.findMany.mockResolvedValue([])
    prismaMock.stockItem.findUniqueOrThrow.mockReset()
    prismaMock.stockItem.findFirst.mockResolvedValue({
      id: 5,
      stockGroupId: 2,
      name: 'Old',
      quantity: 3,
    })
    prismaMock.stockItem.update.mockResolvedValue({ id: 5, name: 'New', quantity: 5 })
    prismaMock.stockItem.findUniqueOrThrow.mockResolvedValue({
      id: 5,
      name: 'New',
      quantity: 5,
      locations: [],
    })
    // Simule l'exécution de la transaction en appelant le callback avec prismaMock
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(prismaMock))
    global.readBody = vi.fn().mockResolvedValue({ name: 'New', quantity: 5 })
  })

  it('met à jour les champs scalaires fournis', async () => {
    const result = await handler(baseEvent as any)
    expect(result.success).toBe(true)
    expect(prismaMock.stockItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: { name: 'New', quantity: 5 },
      })
    )
  })

  it("vérifie l'appartenance du groupe cible à la même édition", async () => {
    global.readBody = vi.fn().mockResolvedValue({ stockGroupId: 99 })
    prismaMock.stockGroup.findFirst.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow(/groupe cible/)
  })

  it('accepte un changement de groupe valide', async () => {
    global.readBody = vi.fn().mockResolvedValue({ stockGroupId: 99 })
    prismaMock.stockGroup.findFirst.mockResolvedValue({ id: 99 })
    await handler(baseEvent as any)
    expect(prismaMock.stockItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ stockGroupId: 99 }) })
    )
  })

  it("n'appelle pas la vérification du groupe si même groupe", async () => {
    global.readBody = vi.fn().mockResolvedValue({ stockGroupId: 2, name: 'New' })
    await handler(baseEvent as any)
    expect(prismaMock.stockGroup.findFirst).not.toHaveBeenCalled()
  })

  it('rejette 404 si item introuvable', async () => {
    prismaMock.stockItem.findFirst.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Objet introuvable')
  })

  it('rejette 403 sans canManageStock', async () => {
    mockCanManageStock.mockReturnValue(false)
    await expect(handler(baseEvent as any)).rejects.toThrow('Droits insuffisants')
  })

  it('remplace tous les sous-emplacements si locations est fourni', async () => {
    global.readBody = vi.fn().mockResolvedValue({
      quantity: 5,
      locations: [
        { location: 'A', quantity: 3 },
        { location: 'B', quantity: 2 },
      ],
    })
    await handler(baseEvent as any)
    expect(prismaMock.stockItemLocation.deleteMany).toHaveBeenCalledWith({
      where: { stockItemId: 5 },
    })
    expect(prismaMock.stockItemLocation.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ stockItemId: 5, location: 'A', quantity: 3 }),
        expect.objectContaining({ stockItemId: 5, location: 'B', quantity: 2 }),
      ]),
    })
  })

  it('rejette si la somme des locations dépasse la nouvelle quantité', async () => {
    global.readBody = vi.fn().mockResolvedValue({
      quantity: 4,
      locations: [{ location: 'A', quantity: 5 }],
    })
    await expect(handler(baseEvent as any)).rejects.toThrow(/d.passe/)
    expect(prismaMock.stockItemLocation.createMany).not.toHaveBeenCalled()
  })

  it('rejette une baisse de quantité incompatible avec les locations existantes', async () => {
    // Pas de `locations` dans le body → on vérifie contre les locations existantes
    global.readBody = vi.fn().mockResolvedValue({ quantity: 2 })
    prismaMock.stockItemLocation.findMany.mockResolvedValue([{ quantity: 3 }, { quantity: 1 }])
    await expect(handler(baseEvent as any)).rejects.toThrow(/somme/i)
  })

  it("rejette si un sous-emplacement n'a aucune localisation", async () => {
    global.readBody = vi.fn().mockResolvedValue({
      locations: [{ location: '', zoneId: null, markerId: null, quantity: 1 }],
    })
    await expect(handler(baseEvent as any)).rejects.toThrow()
  })

  it('rejette une baisse de quantité incompatible avec une réservation active', async () => {
    // existing.quantity = 3, on tente de descendre à 1 alors qu'une réservation de 2 est en cours
    global.readBody = vi.fn().mockResolvedValue({ quantity: 1 })
    prismaMock.stockReservation.findMany.mockResolvedValue([
      {
        quantityReserved: 2,
        startsAt: new Date(Date.now() + 1000),
        endsAt: new Date(Date.now() + 86_400_000),
      },
    ])
    await expect(handler(baseEvent as any)).rejects.toThrow(/pic de r.servations/i)
  })

  it('permet de vider la liste des emplacements (tout devient non localisé)', async () => {
    global.readBody = vi.fn().mockResolvedValue({ locations: [] })
    await handler(baseEvent as any)
    expect(prismaMock.stockItemLocation.deleteMany).toHaveBeenCalledWith({
      where: { stockItemId: 5 },
    })
    expect(prismaMock.stockItemLocation.createMany).not.toHaveBeenCalled()
  })
})
