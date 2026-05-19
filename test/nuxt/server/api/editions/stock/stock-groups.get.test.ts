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

import handler from '../../../../../../server/api/editions/[id]/stock-groups/index.get'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'u@t.com', pseudo: 'u' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}

const baseEvent = { context: { params: { id: '1' }, user: mockUser } }

describe('GET /api/editions/[id]/stock-groups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanAccessStock.mockResolvedValue(true)
    prismaMock.stockGroup.findMany.mockReset()
    prismaMock.stockGroup.findMany.mockResolvedValue([])
  })

  it('retourne la liste des groupes avec items', async () => {
    prismaMock.stockGroup.findMany.mockResolvedValue([
      { id: 1, name: 'Éclairage', items: [{ id: 10, _count: { reservations: 2 } }] },
    ])
    const result = await handler(baseEvent as any)
    expect(result.success).toBe(true)
    expect(result.data.groups).toHaveLength(1)
    expect(prismaMock.stockGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { editionId: 1 },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      })
    )
  })

  it('rejette 404 si édition introuvable', async () => {
    mockGetEditionWithPermissions.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Édition non trouvée')
  })

  it('rejette 403 sans canAccessStock', async () => {
    mockCanAccessStock.mockResolvedValue(false)
    await expect(handler(baseEvent as any)).rejects.toThrow('Droits insuffisants')
  })
})
