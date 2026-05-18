import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())
const mockCanAccessStock = vi.hoisted(() => vi.fn())
const mockCanManageStock = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEditionWithPermissions,
  canManageStock: mockCanManageStock,
}))

vi.mock('#server/utils/stock-helpers', () => ({
  canAccessStock: mockCanAccessStock,
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../../server/api/editions/[id]/stock-reservations/[reservationId].delete'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'u@t.com', pseudo: 'u' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}

const baseEvent = {
  context: { params: { id: '1', reservationId: '100' }, user: mockUser },
}

describe('DELETE /api/editions/[id]/stock-reservations/[reservationId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanAccessStock.mockResolvedValue(true)
    mockCanManageStock.mockReturnValue(false)
    prismaMock.stockReservation.findFirst.mockReset()
    prismaMock.stockReservation.delete.mockReset()
    prismaMock.stockReservation.delete.mockResolvedValue({ id: 100 })
  })

  it("permet à l'auteur de supprimer sa réservation", async () => {
    prismaMock.stockReservation.findFirst.mockResolvedValue({ userId: 1 })
    await handler(baseEvent as any)
    expect(prismaMock.stockReservation.delete).toHaveBeenCalledWith({ where: { id: 100 } })
  })

  it("permet à un modérateur de supprimer une réservation d'autrui", async () => {
    prismaMock.stockReservation.findFirst.mockResolvedValue({ userId: 999 })
    mockCanManageStock.mockReturnValue(true)
    await handler(baseEvent as any)
    expect(prismaMock.stockReservation.delete).toHaveBeenCalled()
  })

  it("refuse si autre user et non modérateur", async () => {
    prismaMock.stockReservation.findFirst.mockResolvedValue({ userId: 999 })
    mockCanManageStock.mockReturnValue(false)
    await expect(handler(baseEvent as any)).rejects.toThrow('Droits insuffisants')
    expect(prismaMock.stockReservation.delete).not.toHaveBeenCalled()
  })

  it("rejette 404 si réservation introuvable (ou autre édition)", async () => {
    prismaMock.stockReservation.findFirst.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Réservation introuvable')
  })

  it("vérifie le scope édition via stockItem.group.editionId", async () => {
    prismaMock.stockReservation.findFirst.mockResolvedValue({ userId: 1 })
    await handler(baseEvent as any)
    expect(prismaMock.stockReservation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 100, stockItem: { group: { editionId: 1 } } },
      })
    )
  })
})
