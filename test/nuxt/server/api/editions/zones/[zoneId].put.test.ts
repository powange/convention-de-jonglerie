import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock de canAccessEditionData pour autoriser l'accès par défaut
// vi.hoisted() permet de hisser la variable avec vi.mock()
const mockCanAccessEditionData = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canAccessEditionData: mockCanAccessEditionData,
}))

// Mock de requireAuth pour simuler un utilisateur authentifié
vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import zonesPutHandler from '../../../../../../server/api/editions/[id]/zones/[zoneId].put'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('API Zones - Mise à jour (PUT)', () => {
  const mockUser = {
    id: 1,
    email: 'user@example.com',
    pseudo: 'testuser',
  }

  const mockZone = {
    id: 1,
    editionId: 1,
    name: 'Zone Camping',
    description: 'Zone de camping principale',
    color: '#22c55e',
    coordinates: [
      [48.8566, 2.3522],
      [48.8576, 2.3532],
      [48.8586, 2.3512],
    ],
    zoneTypes: ['CAMPING'],
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockEvent = {
    context: {
      params: { id: '1', zoneId: '1' },
      user: mockUser,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn()
    // Par défaut, autoriser l'accès
    mockCanAccessEditionData.mockResolvedValue(true)
  })

  it('devrait mettre à jour une zone avec succès', async () => {
    const updateData = {
      name: 'Zone Camping Mise à jour',
      description: 'Nouvelle description',
      color: '#ef4444',
    }

    prismaMock.editionZone.findFirst.mockResolvedValue(mockZone)
    prismaMock.editionZone.update.mockResolvedValue({
      ...mockZone,
      ...updateData,
    })
    global.readBody.mockResolvedValue(updateData)

    const result = await zonesPutHandler(mockEvent as any)

    expect(result).toEqual({
      success: true,
      zone: expect.objectContaining({
        name: updateData.name,
        description: updateData.description,
        color: updateData.color,
      }),
    })

    expect(prismaMock.editionZone.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        name: updateData.name,
        description: updateData.description,
        color: updateData.color,
      }),
      select: expect.any(Object),
    })
  })

  it('devrait permettre une mise à jour partielle', async () => {
    const updateData = {
      name: 'Nouveau nom uniquement',
    }

    prismaMock.editionZone.findFirst.mockResolvedValue(mockZone)
    prismaMock.editionZone.update.mockResolvedValue({
      ...mockZone,
      name: updateData.name,
    })
    global.readBody.mockResolvedValue(updateData)

    const result = await zonesPutHandler(mockEvent as any)

    expect(result.zone.name).toBe(updateData.name)
    expect(prismaMock.editionZone.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        name: updateData.name,
      }),
      select: expect.any(Object),
    })
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const unauthEvent = {
      context: {
        params: { id: '1', zoneId: '1' },
        user: null,
      },
    }

    await expect(zonesPutHandler(unauthEvent as any)).rejects.toThrow()
  })

  it("devrait rejeter si l'utilisateur n'a pas les droits", async () => {
    const otherUserEvent = {
      context: {
        params: { id: '1', zoneId: '1' },
        user: { id: 2, email: 'other@example.com' },
      },
    }

    // Refuser l'accès pour cet utilisateur
    mockCanAccessEditionData.mockResolvedValue(false)

    global.readBody.mockResolvedValue({ name: 'Test' })

    await expect(zonesPutHandler(otherUserEvent as any)).rejects.toThrow('Droits insuffisants')
  })

  it("devrait retourner 404 si la zone n'existe pas", async () => {
    prismaMock.editionZone.findFirst.mockResolvedValue(null)

    global.readBody.mockResolvedValue({ name: 'Test' })

    await expect(zonesPutHandler(mockEvent as any)).rejects.toThrow('Zone introuvable')
  })

  it("devrait rejeter si la zone n'appartient pas à l'édition", async () => {
    prismaMock.editionZone.findFirst.mockResolvedValue(null) // findFirst avec where editionId ne trouve rien

    global.readBody.mockResolvedValue({ name: 'Test' })

    await expect(zonesPutHandler(mockEvent as any)).rejects.toThrow('Zone introuvable')
  })

  it('devrait valider le format de la couleur si fourni', async () => {
    prismaMock.editionZone.findFirst.mockResolvedValue(mockZone)

    global.readBody.mockResolvedValue({
      color: 'not-a-valid-color',
    })

    await expect(zonesPutHandler(mockEvent as any)).rejects.toThrow()
  })

  it('devrait permettre la mise à jour des coordonnées', async () => {
    const newCoordinates = [
      [48.9, 2.4],
      [48.91, 2.41],
      [48.92, 2.39],
      [48.89, 2.38],
    ]

    prismaMock.editionZone.findFirst.mockResolvedValue(mockZone)
    prismaMock.editionZone.update.mockResolvedValue({
      ...mockZone,
      coordinates: newCoordinates,
    })
    global.readBody.mockResolvedValue({ coordinates: newCoordinates })

    const result = await zonesPutHandler(mockEvent as any)

    expect(result.zone.coordinates).toEqual(newCoordinates)
  })

  it('devrait permettre la mise à jour du type de zone', async () => {
    prismaMock.editionZone.findFirst.mockResolvedValue(mockZone)
    prismaMock.editionZone.update.mockResolvedValue({
      ...mockZone,
      zoneTypes: ['PARKING'],
    })
    global.readBody.mockResolvedValue({ zoneTypes: ['PARKING'] })

    const result = await zonesPutHandler(mockEvent as any)

    expect(result.zone.zoneTypes).toEqual(['PARKING'])
  })

  it("devrait retourner 400 si l'ID de zone est invalide", async () => {
    const invalidZoneIdEvent = {
      context: {
        params: { id: '1', zoneId: 'invalid' },
        user: mockUser,
      },
    }

    await expect(zonesPutHandler(invalidZoneIdEvent as any)).rejects.toThrow()
  })
})
