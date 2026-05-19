import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())
const mockCanAccessStock = vi.hoisted(() => vi.fn())
const mockCanManageStock = vi.hoisted(() => vi.fn())
const mockGetReservedQty = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEditionWithPermissions,
  canManageStock: mockCanManageStock,
}))

vi.mock('#server/utils/stock-helpers', () => ({
  canAccessStock: mockCanAccessStock,
  getReservedQuantityOnPeriod: mockGetReservedQty,
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../../server/api/editions/[id]/stock-reservations/[reservationId].put'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'u@t.com', pseudo: 'u' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}

const existingReservation = {
  id: 100,
  stockItemId: 5,
  userId: 1, // utilisateur courant = auteur
  startsAt: new Date('2026-06-10T10:00:00Z'),
  endsAt: new Date('2026-06-10T18:00:00Z'),
  usage: 'Old',
  quantityReserved: 2,
  status: 'RESERVED',
  stockItem: { id: 5, quantity: 10 },
}

const baseEvent = {
  context: { params: { id: '1', reservationId: '100' }, user: mockUser },
}

describe('PUT /api/editions/[id]/stock-reservations/[reservationId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanAccessStock.mockResolvedValue(true)
    mockCanManageStock.mockReturnValue(false)
    mockGetReservedQty.mockResolvedValue(0)
    prismaMock.stockReservation.findFirst.mockReset()
    prismaMock.stockReservation.update.mockReset()
    prismaMock.stockReservation.findFirst.mockResolvedValue(existingReservation)
    prismaMock.stockReservation.update.mockResolvedValue({
      ...existingReservation,
      usage: 'Updated',
    })
    global.readBody = vi.fn().mockResolvedValue({ usage: 'Updated' })
  })

  it("permet à l'auteur de modifier sa réservation", async () => {
    const result = await handler(baseEvent as any)
    expect(result.success).toBe(true)
    expect(prismaMock.stockReservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 100 },
        data: { usage: 'Updated' },
      })
    )
  })

  it('refuse si autre user et non modérateur', async () => {
    prismaMock.stockReservation.findFirst.mockResolvedValue({
      ...existingReservation,
      userId: 999,
    })
    mockCanManageStock.mockReturnValue(false)
    await expect(handler(baseEvent as any)).rejects.toThrow('Droits insuffisants')
  })

  it("permet à un modérateur de modifier une réservation d'autrui", async () => {
    prismaMock.stockReservation.findFirst.mockResolvedValue({
      ...existingReservation,
      userId: 999,
    })
    mockCanManageStock.mockReturnValue(true)
    await handler(baseEvent as any)
    expect(prismaMock.stockReservation.update).toHaveBeenCalled()
  })

  it('exclut la réservation courante du calcul de dispo (excludeReservationId)', async () => {
    global.readBody = vi.fn().mockResolvedValue({ quantityReserved: 5 })
    mockGetReservedQty.mockResolvedValue(0)
    await handler(baseEvent as any)
    expect(mockGetReservedQty).toHaveBeenCalledWith(
      5,
      existingReservation.startsAt,
      existingReservation.endsAt,
      100
    )
  })

  it('refuse 409 si la nouvelle quantité dépasse la dispo restante', async () => {
    global.readBody = vi.fn().mockResolvedValue({ quantityReserved: 8 })
    mockGetReservedQty.mockResolvedValue(5) // 10 - 5 = 5 disponibles, demande 8
    await expect(handler(baseEvent as any)).rejects.toThrow(/Quantité indisponible/)
  })

  it('ne vérifie pas la dispo si statut devient CANCELLED', async () => {
    global.readBody = vi.fn().mockResolvedValue({ status: 'CANCELLED' })
    await handler(baseEvent as any)
    expect(mockGetReservedQty).not.toHaveBeenCalled()
  })

  it('ne vérifie pas la dispo si statut devient RETURNED', async () => {
    global.readBody = vi.fn().mockResolvedValue({ status: 'RETURNED' })
    await handler(baseEvent as any)
    expect(mockGetReservedQty).not.toHaveBeenCalled()
  })

  it('rejette 400 si endsAt <= startsAt', async () => {
    global.readBody = vi.fn().mockResolvedValue({
      startsAt: '2026-06-10T20:00:00.000Z',
      endsAt: '2026-06-10T10:00:00.000Z',
    })
    await expect(handler(baseEvent as any)).rejects.toThrow(/date de fin/)
  })

  it('rejette 404 si réservation introuvable', async () => {
    prismaMock.stockReservation.findFirst.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Réservation introuvable')
  })

  it('rejette 403 si pas canAccessStock', async () => {
    mockCanAccessStock.mockResolvedValue(false)
    await expect(handler(baseEvent as any)).rejects.toThrow('Droits insuffisants')
  })
})
