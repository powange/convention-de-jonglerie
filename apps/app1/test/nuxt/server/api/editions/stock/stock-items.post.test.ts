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

import handler from '../../../../../../layers/stock/server/api/editions/[id]/stock-groups/[groupId]/items.post'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'u@t.com', pseudo: 'u' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}

const validBody = {
  name: 'Rallonge 10m',
  quantity: 5,
  location: 'Tente B',
}

const baseEvent = { context: { params: { id: '1', groupId: '5' }, user: mockUser } }

describe('POST /api/editions/[id]/stock-groups/[groupId]/items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageStock.mockReturnValue(true)
    mockValidateReservationLocation.mockResolvedValue(undefined)
    prismaMock.stockGroup.findFirst.mockReset()
    prismaMock.stockItem.findFirst.mockReset()
    prismaMock.stockItem.create.mockReset()
    prismaMock.stockGroup.findFirst.mockResolvedValue({ id: 5 })
    prismaMock.stockItem.findFirst.mockResolvedValue(null)
    prismaMock.stockItem.create.mockResolvedValue({
      id: 100,
      stockGroupId: 5,
      name: validBody.name,
      quantity: validBody.quantity,
    })
    global.readBody = vi.fn().mockResolvedValue(validBody)
  })

  it('crée un item avec son emplacement texte', async () => {
    const result = await handler(baseEvent as any)
    expect(result.success).toBe(true)
    expect(prismaMock.stockItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stockGroupId: 5,
          name: 'Rallonge 10m',
          quantity: 5,
          displayOrder: 0,
          location: 'Tente B',
          zoneId: null,
          markerId: null,
        }),
      })
    )
  })

  it('crée un item avec une zone', async () => {
    global.readBody = vi.fn().mockResolvedValue({ ...validBody, location: null, zoneId: 10 })
    await handler(baseEvent as any)
    expect(mockValidateReservationLocation).toHaveBeenCalledWith({ zoneId: 10, markerId: null }, 1)
    expect(prismaMock.stockItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ zoneId: 10, markerId: null }),
      })
    )
  })

  it('rejette zone + marker simultanés', async () => {
    global.readBody = vi.fn().mockResolvedValue({ ...validBody, zoneId: 10, markerId: 20 })
    await expect(handler(baseEvent as any)).rejects.toThrow(/zone.*marqueur/i)
    expect(prismaMock.stockItem.create).not.toHaveBeenCalled()
  })

  it('appelle validateReservationLocation avec la zone fournie', async () => {
    global.readBody = vi.fn().mockResolvedValue({ ...validBody, zoneId: 99 })
    await handler(baseEvent as any)
    expect(mockValidateReservationLocation).toHaveBeenCalledWith({ zoneId: 99, markerId: null }, 1)
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

  it('accepte un item sans emplacement (tous champs null)', async () => {
    global.readBody = vi.fn().mockResolvedValue({ name: 'X', quantity: 3 })
    await handler(baseEvent as any)
    expect(prismaMock.stockItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          location: null,
          zoneId: null,
          markerId: null,
        }),
      })
    )
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
