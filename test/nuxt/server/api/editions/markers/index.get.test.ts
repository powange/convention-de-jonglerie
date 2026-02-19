import { describe, it, expect, vi, beforeEach } from 'vitest'

import markersGetHandler from '../../../../../../server/api/editions/[id]/markers/index.get'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('API Markers - Liste (GET)', () => {
  const mockEdition = {
    id: 1,
  }

  const mockMarkers = [
    {
      id: 1,
      editionId: 1,
      name: 'Entrée principale',
      description: 'Entrée du site',
      latitude: 48.8566,
      longitude: 2.3522,
      markerTypes: ['ENTRANCE'],
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      editionId: 1,
      name: 'Point Info',
      description: 'Accueil et informations',
      latitude: 48.8576,
      longitude: 2.3532,
      markerTypes: ['INFO'],
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

  it('devrait retourner la liste des markers pour une édition existante', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.editionMarker.findMany.mockResolvedValue(mockMarkers)

    const result = await markersGetHandler(mockEvent as any)

    expect(result).toEqual({
      success: true,
      markers: mockMarkers,
    })

    expect(prismaMock.edition.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true },
    })

    expect(prismaMock.editionMarker.findMany).toHaveBeenCalledWith({
      where: { editionId: 1 },
      select: expect.any(Object),
      orderBy: { order: 'asc' },
    })
  })

  it('devrait retourner une liste vide si aucun marker', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.editionMarker.findMany.mockResolvedValue([])

    const result = await markersGetHandler(mockEvent as any)

    expect(result).toEqual({
      success: true,
      markers: [],
    })
  })

  it("devrait retourner 404 si l'édition n'existe pas", async () => {
    prismaMock.edition.findUnique.mockResolvedValue(null)

    await expect(markersGetHandler(mockEvent as any)).rejects.toThrow()
  })

  it("devrait retourner 400 si l'ID est invalide", async () => {
    const invalidEvent = {
      context: {
        params: { id: 'invalid' },
      },
    }

    await expect(markersGetHandler(invalidEvent as any)).rejects.toThrow()
  })

  it('devrait trier les markers par ordre croissant', async () => {
    const unorderedMarkers = [
      { ...mockMarkers[1], order: 2 },
      { ...mockMarkers[0], order: 0 },
    ]

    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.editionMarker.findMany.mockResolvedValue(unorderedMarkers)

    await markersGetHandler(mockEvent as any)

    expect(prismaMock.editionMarker.findMany).toHaveBeenCalledWith({
      where: { editionId: 1 },
      select: expect.any(Object),
      orderBy: { order: 'asc' },
    })
  })
})
