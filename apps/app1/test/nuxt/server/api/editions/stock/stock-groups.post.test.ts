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

import handler from '../../../../../../../../layers/stock/server/api/editions/[id]/stock-groups/index.post'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'u@t.com', pseudo: 'u' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}

const baseEvent = { context: { params: { id: '1' }, user: mockUser } }

describe('POST /api/editions/[id]/stock-groups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageStock.mockReturnValue(true)
    prismaMock.stockGroup.findFirst.mockReset()
    prismaMock.stockGroup.create.mockReset()
    prismaMock.stockGroup.findFirst.mockResolvedValue(null) // no existing → displayOrder = 0
    prismaMock.stockGroup.create.mockResolvedValue({
      id: 1,
      name: 'Éclairage',
      description: null,
      displayOrder: 0,
    })
    global.readBody = vi.fn().mockResolvedValue({ name: 'Éclairage' })
  })

  it('crée un groupe avec displayOrder auto', async () => {
    const result = await handler(baseEvent as any)
    expect(result.success).toBe(true)
    expect(prismaMock.stockGroup.create).toHaveBeenCalledWith({
      data: { editionId: 1, name: 'Éclairage', description: null, displayOrder: 0 },
    })
  })

  it('utilise max+1 pour displayOrder si groupes existants', async () => {
    prismaMock.stockGroup.findFirst.mockResolvedValue({ displayOrder: 5 })
    await handler(baseEvent as any)
    expect(prismaMock.stockGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ displayOrder: 6 }) })
    )
  })

  it('rejette 403 sans canManageStock', async () => {
    mockCanManageStock.mockReturnValue(false)
    await expect(handler(baseEvent as any)).rejects.toThrow('Droits insuffisants')
  })

  it('rejette un nom vide via Zod', async () => {
    global.readBody = vi.fn().mockResolvedValue({ name: '' })
    await expect(handler(baseEvent as any)).rejects.toThrow()
    expect(prismaMock.stockGroup.create).not.toHaveBeenCalled()
  })

  it('trim le nom et la description', async () => {
    global.readBody = vi.fn().mockResolvedValue({ name: '  Éclairage  ', description: '  desc  ' })
    await handler(baseEvent as any)
    expect(prismaMock.stockGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Éclairage', description: 'desc' }),
      })
    )
  })
})
