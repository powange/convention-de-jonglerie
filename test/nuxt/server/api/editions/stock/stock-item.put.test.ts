import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())
const mockCanManageStock = vi.hoisted(() => vi.fn())
const mockValidateReservationLocation = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEditionWithPermissions,
  canManageStock: mockCanManageStock,
}))

vi.mock('#server/utils/stock-helpers', () => ({
  validateReservationLocation: mockValidateReservationLocation,
  stockItemLocationInclude: {},
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../../layers/stock/server/api/editions/[id]/stock-items/[itemId]/index.put'

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
    mockValidateReservationLocation.mockResolvedValue(undefined)
    prismaMock.stockItem.findFirst.mockReset()
    prismaMock.stockGroup.findFirst.mockReset()
    prismaMock.stockItem.update.mockReset()
    prismaMock.stockReservation.findMany.mockReset()
    prismaMock.stockReservation.findMany.mockResolvedValue([])
    prismaMock.stockItem.findFirst.mockResolvedValue({
      id: 5,
      stockGroupId: 2,
      name: 'Old',
      quantity: 3,
      location: 'Initial',
      zoneId: null,
      markerId: null,
    })
    prismaMock.stockItem.update.mockResolvedValue({ id: 5, name: 'New', quantity: 5 })
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

  it("met à jour l'emplacement de rangement (location texte)", async () => {
    global.readBody = vi.fn().mockResolvedValue({ location: 'Nouveau lieu' })
    await handler(baseEvent as any)
    expect(prismaMock.stockItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { location: 'Nouveau lieu' },
      })
    )
    expect(mockValidateReservationLocation).toHaveBeenCalledWith(
      { zoneId: null, markerId: null },
      1
    )
  })

  it("met à jour l'emplacement avec une zone", async () => {
    global.readBody = vi.fn().mockResolvedValue({ zoneId: 12 })
    await handler(baseEvent as any)
    expect(prismaMock.stockItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { zoneId: 12 } })
    )
    expect(mockValidateReservationLocation).toHaveBeenCalledWith({ zoneId: 12, markerId: null }, 1)
  })

  it('rejette zone + marker simultanés', async () => {
    global.readBody = vi.fn().mockResolvedValue({ zoneId: 12, markerId: 7 })
    await expect(handler(baseEvent as any)).rejects.toThrow(/zone.*marqueur/i)
  })

  it("permet de remettre l'emplacement à vide (location: null)", async () => {
    global.readBody = vi.fn().mockResolvedValue({ location: null })
    await handler(baseEvent as any)
    expect(prismaMock.stockItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { location: null } })
    )
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
})
