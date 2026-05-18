import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())
const mockCanAccessStock = vi.hoisted(() => vi.fn())
const mockGetReservedQty = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEditionWithPermissions,
  canManageStock: vi.fn(),
}))

vi.mock('#server/utils/stock-helpers', () => ({
  canAccessStock: mockCanAccessStock,
  getReservedQuantityOnPeriod: mockGetReservedQty,
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../../server/api/editions/[id]/stock-items/[itemId]/reservations.post'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'user@test.com', pseudo: 'testuser' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}
const mockItem = { id: 5, quantity: 10 }

const baseEvent = {
  context: {
    params: { id: '1', itemId: '5' },
    user: mockUser,
  },
}

const validBody = {
  startsAt: '2026-06-10T10:00:00.000Z',
  endsAt: '2026-06-10T18:00:00.000Z',
  usage: 'Spectacle de feu samedi',
  quantityReserved: 2,
}

describe('POST /api/editions/[id]/stock-items/[itemId]/reservations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanAccessStock.mockResolvedValue(true)
    mockGetReservedQty.mockResolvedValue(0)
    prismaMock.stockItem.findFirst.mockReset()
    prismaMock.stockReservation.create.mockReset()
    prismaMock.stockItem.findFirst.mockResolvedValue(mockItem)
    prismaMock.stockReservation.create.mockResolvedValue({
      id: 100,
      stockItemId: 5,
      userId: 1,
      ...validBody,
      startsAt: new Date(validBody.startsAt),
      endsAt: new Date(validBody.endsAt),
      status: 'RESERVED',
      user: { id: 1, pseudo: 'testuser', emailHash: 'abc' },
    })
    global.readBody = vi.fn().mockResolvedValue(validBody)
  })

  it('crée une réservation quand la dispo est suffisante', async () => {
    const result = await handler(baseEvent as any)
    expect(result.success).toBe(true)
    expect(prismaMock.stockReservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stockItemId: 5,
          userId: 1,
          quantityReserved: 2,
          usage: 'Spectacle de feu samedi',
        }),
      })
    )
  })

  it('refuse 409 si la quantité demandée dépasse la dispo restante', async () => {
    // 10 total, 9 déjà réservés sur la période, demande 2 → indisponible
    mockGetReservedQty.mockResolvedValue(9)
    await expect(handler(baseEvent as any)).rejects.toThrow(/Quantité indisponible/)
    expect(prismaMock.stockReservation.create).not.toHaveBeenCalled()
  })

  it('refuse 400 si la quantité demandée dépasse le stock total', async () => {
    global.readBody = vi.fn().mockResolvedValue({ ...validBody, quantityReserved: 11 })
    await expect(handler(baseEvent as any)).rejects.toThrow(/stock total/)
    expect(prismaMock.stockReservation.create).not.toHaveBeenCalled()
  })

  it('refuse si endsAt <= startsAt', async () => {
    global.readBody = vi.fn().mockResolvedValue({
      ...validBody,
      endsAt: validBody.startsAt,
    })
    await expect(handler(baseEvent as any)).rejects.toThrow(/date de fin/)
  })

  it("rejette si l'édition est introuvable", async () => {
    mockGetEditionWithPermissions.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Édition non trouvée')
  })

  it("rejette si l'item est introuvable", async () => {
    prismaMock.stockItem.findFirst.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Objet introuvable')
  })

  it("rejette si l'utilisateur n'a pas accès au stock", async () => {
    mockCanAccessStock.mockResolvedValue(false)
    await expect(handler(baseEvent as any)).rejects.toThrow('Droits insuffisants')
  })

  it('passe correctement la période à getReservedQuantityOnPeriod', async () => {
    await handler(baseEvent as any)
    expect(mockGetReservedQty).toHaveBeenCalledWith(
      5,
      new Date(validBody.startsAt),
      new Date(validBody.endsAt)
    )
  })

  it('accepte une réservation qui utilise exactement la dispo restante', async () => {
    // 10 total, 8 déjà réservés, demande 2 → exactement disponible
    mockGetReservedQty.mockResolvedValue(8)
    await expect(handler(baseEvent as any)).resolves.toBeDefined()
    expect(prismaMock.stockReservation.create).toHaveBeenCalled()
  })

  it("rejette si l'usage est vide", async () => {
    global.readBody = vi.fn().mockResolvedValue({ ...validBody, usage: '' })
    await expect(handler(baseEvent as any)).rejects.toThrow()
    expect(prismaMock.stockReservation.create).not.toHaveBeenCalled()
  })
})
