import { describe, it, expect, vi, beforeEach } from 'vitest'

import zonesGetHandler from '../../../../../../server/api/editions/[id]/zones/index.get'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('API Zones - Liste (GET)', () => {
  const mockEdition = {
    id: 1,
  }

  const mockZones = [
    {
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
    },
    {
      id: 2,
      editionId: 1,
      name: 'Zone Spectacles',
      description: 'Scène principale',
      color: '#8b5cf6',
      coordinates: [
        [48.8596, 2.3542],
        [48.8606, 2.3552],
        [48.8616, 2.3522],
      ],
      zoneTypes: ['SHOWS'],
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  const mockEvent = {
    context: {
      params: { id: '1' },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devrait retourner la liste des zones pour une édition existante', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.editionZone.findMany.mockResolvedValue(mockZones)

    const result = await zonesGetHandler(mockEvent as any)

    expect(result).toEqual({
      success: true,
      data: {
        zones: mockZones,
      },
    })

    expect(prismaMock.edition.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true },
    })

    expect(prismaMock.editionZone.findMany).toHaveBeenCalledWith({
      where: { editionId: 1 },
      select: expect.any(Object),
      orderBy: { order: 'asc' },
    })
  })

  it('devrait retourner une liste vide si aucune zone', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.editionZone.findMany.mockResolvedValue([])

    const result = await zonesGetHandler(mockEvent as any)

    expect(result).toEqual({
      success: true,
      data: {
        zones: [],
      },
    })
  })

  it("devrait retourner 404 si l'édition n'existe pas", async () => {
    prismaMock.edition.findUnique.mockResolvedValue(null)

    await expect(zonesGetHandler(mockEvent as any)).rejects.toThrow()
  })

  it("devrait retourner 400 si l'ID est invalide", async () => {
    const invalidEvent = {
      context: {
        params: { id: 'invalid' },
      },
    }

    await expect(zonesGetHandler(invalidEvent as any)).rejects.toThrow()
  })
})
