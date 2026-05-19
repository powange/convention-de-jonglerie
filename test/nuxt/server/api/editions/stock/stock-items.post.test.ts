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
  quantity: 5,
  locations: [{ location: 'Tente B', quantity: 5 }],
}

const baseEvent = { context: { params: { id: '1', groupId: '5' }, user: mockUser } }

describe('POST /api/editions/[id]/stock-groups/[groupId]/items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageStock.mockReturnValue(true)
    prismaMock.stockGroup.findFirst.mockReset()
    prismaMock.editionZone.findMany.mockReset()
    prismaMock.editionMarker.findMany.mockReset()
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

  it('crée un item avec sous-emplacement(s)', async () => {
    const result = await handler(baseEvent as any)
    expect(result.success).toBe(true)
    expect(prismaMock.stockItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stockGroupId: 5,
          name: 'Rallonge 10m',
          quantity: 5,
          displayOrder: 0,
          locations: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({ location: 'Tente B', quantity: 5 }),
            ]),
          }),
        }),
      })
    )
  })

  it("rejette si une zone d'un emplacement n'appartient pas à l'édition", async () => {
    global.readBody = vi.fn().mockResolvedValue({
      ...validBody,
      locations: [{ zoneId: 99, quantity: 5 }],
    })
    prismaMock.editionZone.findMany.mockResolvedValue([])
    await expect(handler(baseEvent as any)).rejects.toThrow(/zone/)
  })

  it("rejette si un marker d'un emplacement n'appartient pas à l'édition", async () => {
    global.readBody = vi.fn().mockResolvedValue({
      ...validBody,
      locations: [{ markerId: 99, quantity: 5 }],
    })
    prismaMock.editionMarker.findMany.mockResolvedValue([])
    await expect(handler(baseEvent as any)).rejects.toThrow(/marqueur/)
  })

  it('accepte zone et marker valides sur plusieurs emplacements', async () => {
    global.readBody = vi.fn().mockResolvedValue({
      ...validBody,
      quantity: 6,
      locations: [
        { zoneId: 10, quantity: 4 },
        { markerId: 20, quantity: 2 },
      ],
    })
    prismaMock.editionZone.findMany.mockResolvedValue([{ id: 10 }])
    prismaMock.editionMarker.findMany.mockResolvedValue([{ id: 20 }])
    await handler(baseEvent as any)
    expect(prismaMock.stockItem.create).toHaveBeenCalled()
  })

  it('rejette si somme des quantités dépasse la quantité totale', async () => {
    global.readBody = vi.fn().mockResolvedValue({
      name: 'X',
      quantity: 5,
      locations: [{ location: 'A', quantity: 6 }],
    })
    await expect(handler(baseEvent as any)).rejects.toThrow(/d.passe/)
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

  it('rejette un sous-emplacement avec zoneId et markerId simultanés', async () => {
    global.readBody = vi.fn().mockResolvedValue({
      ...validBody,
      locations: [{ zoneId: 10, markerId: 20, quantity: 5 }],
    })
    await expect(handler(baseEvent as any)).rejects.toThrow()
    expect(prismaMock.stockItem.create).not.toHaveBeenCalled()
  })

  it("rejette si un sous-emplacement n'a ni location ni zoneId ni markerId", async () => {
    global.readBody = vi.fn().mockResolvedValue({
      ...validBody,
      locations: [{ location: '', zoneId: null, markerId: null, quantity: 5 }],
    })
    await expect(handler(baseEvent as any)).rejects.toThrow()
    expect(prismaMock.stockItem.create).not.toHaveBeenCalled()
  })

  it('accepte un item sans aucun sous-emplacement (tout non localisé)', async () => {
    global.readBody = vi.fn().mockResolvedValue({ name: 'X', quantity: 3 })
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
