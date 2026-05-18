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
    prismaMock.editionZone.findFirst.mockReset()
    prismaMock.editionMarker.findFirst.mockReset()
    prismaMock.stockItem.update.mockReset()
    prismaMock.stockItem.findFirst.mockResolvedValue({
      id: 5,
      stockGroupId: 2,
      name: 'Old',
      quantity: 3,
    })
    prismaMock.stockItem.update.mockResolvedValue({ id: 5, name: 'New', quantity: 5 })
    global.readBody = vi.fn().mockResolvedValue({ name: 'New', quantity: 5 })
  })

  it('met à jour les champs fournis uniquement', async () => {
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

  it('permet de définir zoneId/markerId à null', async () => {
    global.readBody = vi.fn().mockResolvedValue({ zoneId: null, markerId: null })
    await handler(baseEvent as any)
    expect(prismaMock.stockItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { zoneId: null, markerId: null } })
    )
    // Pas de vérification de zone/marker quand null
    expect(prismaMock.editionZone.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.editionMarker.findFirst).not.toHaveBeenCalled()
  })
})
