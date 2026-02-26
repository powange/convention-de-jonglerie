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

import zonesPostHandler from '../../../../../../server/api/editions/[id]/zones/index.post'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('API Zones - Création (POST)', () => {
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
      params: { id: '1' },
      user: mockUser,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn()
    // Par défaut, autoriser l'accès
    mockCanAccessEditionData.mockResolvedValue(true)
  })

  it('devrait créer une zone avec succès', async () => {
    const zoneData = {
      name: 'Zone Camping',
      description: 'Zone de camping principale',
      color: '#22c55e',
      coordinates: [
        [48.8566, 2.3522],
        [48.8576, 2.3532],
        [48.8586, 2.3512],
      ],
      zoneTypes: ['CAMPING'],
    }

    prismaMock.editionZone.count.mockResolvedValue(0)
    prismaMock.editionZone.aggregate.mockResolvedValue({ _max: { order: null } })
    prismaMock.editionZone.create.mockResolvedValue(mockZone)
    global.readBody.mockResolvedValue(zoneData)

    const result = await zonesPostHandler(mockEvent as any)

    expect(result).toEqual({
      success: true,
      data: {
        zone: mockZone,
      },
    })

    expect(prismaMock.editionZone.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        editionId: 1,
        name: zoneData.name,
        description: zoneData.description,
        color: zoneData.color,
        coordinates: zoneData.coordinates,
        zoneTypes: zoneData.zoneTypes,
        order: 0,
      }),
      select: expect.any(Object),
    })
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const unauthEvent = {
      context: {
        params: { id: '1' },
        user: null,
      },
    }

    await expect(zonesPostHandler(unauthEvent as any)).rejects.toThrow()
  })

  it("devrait rejeter si l'utilisateur n'a pas les droits sur l'édition", async () => {
    const otherUserEvent = {
      context: {
        params: { id: '1' },
        user: { id: 2, email: 'other@example.com' },
      },
    }

    // Refuser l'accès pour cet utilisateur
    mockCanAccessEditionData.mockResolvedValue(false)

    global.readBody.mockResolvedValue({
      name: 'Zone Test',
      color: '#ff0000',
      coordinates: [
        [48.8566, 2.3522],
        [48.8576, 2.3532],
        [48.8586, 2.3512],
      ],
    })

    await expect(zonesPostHandler(otherUserEvent as any)).rejects.toThrow('Droits insuffisants')
  })

  it('devrait rejeter si la limite de zones est atteinte', async () => {
    prismaMock.editionZone.count.mockResolvedValue(50) // MAX_ZONES_PER_EDITION = 50

    global.readBody.mockResolvedValue({
      name: 'Zone Test',
      color: '#ff0000',
      coordinates: [
        [48.8566, 2.3522],
        [48.8576, 2.3532],
        [48.8586, 2.3512],
      ],
    })

    await expect(zonesPostHandler(mockEvent as any)).rejects.toThrow('Limite de 50 zones atteinte')
  })

  it('devrait valider le format de la couleur', async () => {
    prismaMock.editionZone.count.mockResolvedValue(0)

    global.readBody.mockResolvedValue({
      name: 'Zone Test',
      color: 'invalid-color', // Format invalide
      coordinates: [
        [48.8566, 2.3522],
        [48.8576, 2.3532],
        [48.8586, 2.3512],
      ],
    })

    await expect(zonesPostHandler(mockEvent as any)).rejects.toThrow()
  })

  it('devrait valider le nombre minimum de points du polygone', async () => {
    prismaMock.editionZone.count.mockResolvedValue(0)

    global.readBody.mockResolvedValue({
      name: 'Zone Test',
      color: '#ff0000',
      coordinates: [
        [48.8566, 2.3522],
        [48.8576, 2.3532],
      ], // Seulement 2 points, minimum requis = 3
    })

    await expect(zonesPostHandler(mockEvent as any)).rejects.toThrow()
  })

  it("devrait incrémenter l'ordre automatiquement", async () => {
    prismaMock.editionZone.count.mockResolvedValue(2)
    prismaMock.editionZone.aggregate.mockResolvedValue({ _max: { order: 1 } })
    prismaMock.editionZone.create.mockResolvedValue({ ...mockZone, order: 2 })

    global.readBody.mockResolvedValue({
      name: 'Zone Test',
      color: '#ff0000',
      coordinates: [
        [48.8566, 2.3522],
        [48.8576, 2.3532],
        [48.8586, 2.3512],
      ],
    })

    await zonesPostHandler(mockEvent as any)

    expect(prismaMock.editionZone.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        order: 2, // maxOrder (1) + 1
      }),
      select: expect.any(Object),
    })
  })

  it('devrait utiliser le type OTHER par défaut', async () => {
    prismaMock.editionZone.count.mockResolvedValue(0)
    prismaMock.editionZone.aggregate.mockResolvedValue({ _max: { order: null } })
    prismaMock.editionZone.create.mockResolvedValue({ ...mockZone, zoneTypes: ['OTHER'] })

    global.readBody.mockResolvedValue({
      name: 'Zone Test',
      color: '#ff0000',
      coordinates: [
        [48.8566, 2.3522],
        [48.8576, 2.3532],
        [48.8586, 2.3512],
      ],
      // Pas de zoneTypes spécifié
    })

    await zonesPostHandler(mockEvent as any)

    expect(prismaMock.editionZone.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        zoneTypes: ['OTHER'],
      }),
      select: expect.any(Object),
    })
  })

  it('devrait accepter plusieurs types de zone', async () => {
    prismaMock.editionZone.count.mockResolvedValue(0)
    prismaMock.editionZone.aggregate.mockResolvedValue({ _max: { order: null } })
    prismaMock.editionZone.create.mockResolvedValue({
      ...mockZone,
      zoneTypes: ['CAMPING', 'FOOD', 'TOILETS'],
    })

    global.readBody.mockResolvedValue({
      name: 'Zone Multi-Services',
      color: '#ff0000',
      coordinates: [
        [48.8566, 2.3522],
        [48.8576, 2.3532],
        [48.8586, 2.3512],
      ],
      zoneTypes: ['CAMPING', 'FOOD', 'TOILETS'],
    })

    await zonesPostHandler(mockEvent as any)

    expect(prismaMock.editionZone.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        zoneTypes: ['CAMPING', 'FOOD', 'TOILETS'],
      }),
      select: expect.any(Object),
    })
  })

  it('devrait rejeter un type de zone invalide', async () => {
    prismaMock.editionZone.count.mockResolvedValue(0)

    global.readBody.mockResolvedValue({
      name: 'Zone Test',
      color: '#ff0000',
      coordinates: [
        [48.8566, 2.3522],
        [48.8576, 2.3532],
        [48.8586, 2.3512],
      ],
      zoneTypes: ['INVALID_TYPE'],
    })

    await expect(zonesPostHandler(mockEvent as any)).rejects.toThrow()
  })

  it('devrait rejeter un tableau de types vide', async () => {
    prismaMock.editionZone.count.mockResolvedValue(0)

    global.readBody.mockResolvedValue({
      name: 'Zone Test',
      color: '#ff0000',
      coordinates: [
        [48.8566, 2.3522],
        [48.8576, 2.3532],
        [48.8586, 2.3512],
      ],
      zoneTypes: [],
    })

    await expect(zonesPostHandler(mockEvent as any)).rejects.toThrow()
  })

  it("devrait retourner 400 si l'ID est invalide", async () => {
    const invalidEvent = {
      context: {
        params: { id: 'invalid' },
        user: mockUser,
      },
    }

    await expect(zonesPostHandler(invalidEvent as any)).rejects.toThrow()
  })
})
