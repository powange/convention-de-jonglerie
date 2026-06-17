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

import handler from '../../../../../../layers/stock/server/api/editions/[id]/stock-groups/[groupId]/index.delete'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'u@t.com', pseudo: 'u' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}

const baseEvent = { context: { params: { id: '1', groupId: '5' }, user: mockUser } }

describe('DELETE /api/editions/[id]/stock-groups/[groupId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageStock.mockReturnValue(true)
    prismaMock.stockGroup.findFirst.mockReset()
    prismaMock.stockGroup.delete.mockReset()
    prismaMock.stockGroup.findFirst.mockResolvedValue({ id: 5 })
    prismaMock.stockGroup.delete.mockResolvedValue({ id: 5 })
  })

  it('supprime un groupe', async () => {
    const result = await handler(baseEvent as any)
    expect(result.success).toBe(true)
    expect(prismaMock.stockGroup.delete).toHaveBeenCalledWith({ where: { id: 5 } })
  })

  it('rejette 404 si groupe introuvable', async () => {
    prismaMock.stockGroup.findFirst.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Groupe introuvable')
    expect(prismaMock.stockGroup.delete).not.toHaveBeenCalled()
  })

  it('rejette 403 sans canManageStock', async () => {
    mockCanManageStock.mockReturnValue(false)
    await expect(handler(baseEvent as any)).rejects.toThrow('Droits insuffisants')
  })
})
