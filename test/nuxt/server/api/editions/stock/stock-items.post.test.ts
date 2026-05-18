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

import handler from '../../../../../../server/api/editions/[id]/stock-groups/[groupId]/items.post'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'u@t.com', pseudo: 'u' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}

const validBody = {
  name: 'Rallonge 10m',
  location: 'Tente B',
  quantity: 5,
}

const baseEvent = { context: { params: { id: '1', groupId: '5' }, user: mockUser } }

describe('POST /api/editions/[id]/stock-groups/[groupId]/items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageStock.mockReturnValue(true)
    prismaMock.stockGroup.findFirst.mockReset()
    prismaMock.editionZone.findFirst.mockReset()
    prismaMock.editionMarker.findFirst.mockReset()
    prismaMock.stockItem.findFirst.mockReset()
    prismaMock.stockItem.create.mockReset()
    prismaMock.stockGroup.findFirst.mockResolvedValue({ id: 5 })
    prismaMock.stockItem.findFirst.mockResolvedValue(null)
    prismaMock.stockItem.create.mockResolvedValue({
      id: 100,
      stockGroupId: 5,
      ...validBody,
    })
    global.readBody = vi.fn().mockResolvedValue(validBody)
  })

  it('crée un item avec quantity par défaut', async () => {
    const result = await handler(baseEvent as any)
    expect(result.success).toBe(true)
    expect(prismaMock.stockItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stockGroupId: 5,
          name: 'Rallonge 10m',
          location: 'Tente B',
          quantity: 5,
          displayOrder: 0,
        }),
      })
    )
  })

  it('rejette si zone n\'appartient pas à l\'édition', async () => {
    global.readBody = vi.fn().mockResolvedValue({ ...validBody, zoneId: 99 })
    prismaMock.editionZone.findFirst.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow(/zone/)
  })

  it('rejette si marker n\'appartient pas à l\'édition', async () => {
    global.readBody = vi.fn().mockResolvedValue({ ...validBody, markerId: 99 })
    prismaMock.editionMarker.findFirst.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow(/marqueur/)
  })

  it('accepte zone et marker valides', async () => {
    global.readBody = vi.fn().mockResolvedValue({ ...validBody, zoneId: 10, markerId: 20 })
    prismaMock.editionZone.findFirst.mockResolvedValue({ id: 10 })
    prismaMock.editionMarker.findFirst.mockResolvedValue({ id: 20 })
    await handler(baseEvent as any)
    expect(prismaMock.stockItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ zoneId: 10, markerId: 20 }),
      })
    )
  })

  it('rejette 404 si groupe inexistant', async () => {
    prismaMock.stockGroup.findFirst.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Groupe introuvable')
  })

  it('rejette 403 sans canManageStock', async () => {
    mockCanManageStock.mockReturnValue(false)
    await expect(handler(baseEvent as any)).rejects.toThrow('Droits insuffisants')
  })

  it('rejette name vide via Zod', async () => {
    global.readBody = vi.fn().mockResolvedValue({ ...validBody, name: '' })
    await expect(handler(baseEvent as any)).rejects.toThrow()
  })

  it('rejette si ni location ni zoneId ni markerId', async () => {
    global.readBody = vi
      .fn()
      .mockResolvedValue({ ...validBody, location: '', zoneId: null, markerId: null })
    // Le refine Zod throw via handleValidationError → message "Données invalides"
    // avec le détail dans data.errors.location
    await expect(handler(baseEvent as any)).rejects.toThrow()
    expect(prismaMock.stockItem.create).not.toHaveBeenCalled()
  })

  it('accepte une location vide si zoneId est fourni', async () => {
    global.readBody = vi.fn().mockResolvedValue({ ...validBody, location: '', zoneId: 10 })
    prismaMock.editionZone.findFirst.mockResolvedValue({ id: 10 })
    await handler(baseEvent as any)
    expect(prismaMock.stockItem.create).toHaveBeenCalled()
  })

  it('accepte une location vide si markerId est fourni', async () => {
    global.readBody = vi.fn().mockResolvedValue({ ...validBody, location: '', markerId: 20 })
    prismaMock.editionMarker.findFirst.mockResolvedValue({ id: 20 })
    await handler(baseEvent as any)
    expect(prismaMock.stockItem.create).toHaveBeenCalled()
  })

  it('rejette quantity = 0 via Zod', async () => {
    global.readBody = vi.fn().mockResolvedValue({ ...validBody, quantity: 0 })
    await expect(handler(baseEvent as any)).rejects.toThrow()
  })

  it('utilise max+1 pour displayOrder si items existants dans le groupe', async () => {
    prismaMock.stockItem.findFirst.mockResolvedValue({ displayOrder: 3 })
    await handler(baseEvent as any)
    expect(prismaMock.stockItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ displayOrder: 4 }) })
    )
  })
})
