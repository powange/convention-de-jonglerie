import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())
const mockCanAccessStock = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEditionWithPermissions,
}))

vi.mock('#server/utils/stock-helpers', () => ({
  canAccessStock: mockCanAccessStock,
  stockItemLocationsInclude: {},
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../../server/api/editions/[id]/stock-items/[itemId]/index.get'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'u@t.com', pseudo: 'u' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}

const baseEvent = { context: { params: { id: '1', itemId: '5' }, user: mockUser } }

describe('GET /api/editions/[id]/stock-items/[itemId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanAccessStock.mockResolvedValue(true)
    prismaMock.stockItem.findFirst.mockReset()
    prismaMock.stockItem.findFirst.mockResolvedValue({
      id: 5,
      name: 'Rallonge',
      group: { id: 1, name: 'Éclairage' },
      reservations: [],
    })
  })

  it("retourne le détail d'un item avec ses réservations", async () => {
    const result = await handler(baseEvent as any)
    expect(result.success).toBe(true)
    expect(result.data.item.name).toBe('Rallonge')
  })

  it('vérifie le scope édition via group.editionId', async () => {
    await handler(baseEvent as any)
    expect(prismaMock.stockItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5, group: { editionId: 1 } },
      })
    )
  })

  it('rejette 404 si item introuvable', async () => {
    prismaMock.stockItem.findFirst.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Objet introuvable')
  })

  it('rejette 403 sans canAccessStock', async () => {
    mockCanAccessStock.mockResolvedValue(false)
    await expect(handler(baseEvent as any)).rejects.toThrow('Droits insuffisants')
  })
})
