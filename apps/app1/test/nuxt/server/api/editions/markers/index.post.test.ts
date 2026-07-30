import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock de canEditEditionById pour autoriser l'accès par défaut
// vi.hoisted() permet de hisser la variable avec vi.mock()
const mockCanEditEditionById = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canEditEditionById: mockCanEditEditionById,
}))

// Mock de requireAuth pour simuler un utilisateur authentifié
vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import markersPostHandler from '../../../../../../server/api/editions/[id]/markers/index.post'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('API Markers - Création (POST)', () => {
  const mockUser = {
    id: 1,
    email: 'user@example.com',
    pseudo: 'testuser',
  }

  const mockMarker = {
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
    mockCanEditEditionById.mockResolvedValue(true)
  })

  it('devrait créer un marker avec succès', async () => {
    const markerData = {
      name: 'Entrée principale',
      description: 'Entrée du site',
      latitude: 48.8566,
      longitude: 2.3522,
      markerTypes: ['ENTRANCE'],
    }

    prismaMock.editionMarker.count.mockResolvedValue(0)
    prismaMock.editionMarker.aggregate.mockResolvedValue({ _max: { order: null } })
    prismaMock.editionMarker.create.mockResolvedValue(mockMarker)
    global.readBody.mockResolvedValue(markerData)

    const result = await markersPostHandler(mockEvent as any)

    expect(result).toEqual({
      success: true,
      data: {
        marker: mockMarker,
      },
    })

    expect(prismaMock.editionMarker.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        editionId: 1,
        name: markerData.name,
        description: markerData.description,
        latitude: markerData.latitude,
        longitude: markerData.longitude,
        markerTypes: markerData.markerTypes,
        order: 0,
      }),
      select: expect.any(Object),
    })
  })

  it('devrait rattacher le marqueur à une zone de la même édition', async () => {
    prismaMock.editionMarker.count.mockResolvedValue(0)
    prismaMock.editionMarker.aggregate.mockResolvedValue({ _max: { order: null } })
    prismaMock.editionMarker.create.mockResolvedValue({ ...mockMarker, zoneId: 7 })
    prismaMock.editionZone.findFirst.mockResolvedValue({ id: 7 })
    global.readBody.mockResolvedValue({
      name: 'Entrée principale',
      latitude: 48.8566,
      longitude: 2.3522,
      zoneId: 7,
    })

    await markersPostHandler(mockEvent as any)

    // La zone est cherchée dans l'édition de la requête, pas globalement.
    expect(prismaMock.editionZone.findFirst).toHaveBeenCalledWith({
      where: { id: 7, editionId: 1 },
      select: { id: true },
    })
    expect(prismaMock.editionMarker.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ zoneId: 7 }),
      select: expect.any(Object),
    })
  })

  // Sans ce contrôle, un identifiant venu du corps de la requête suffirait à rattacher une
  // entrée à la zone d'une autre édition : la clé étrangère l'accepterait sans broncher, et le
  // rattachement serait invisible depuis les deux cartes.
  it("devrait refuser une zone qui n'appartient pas à l'édition", async () => {
    prismaMock.editionMarker.count.mockResolvedValue(0)
    prismaMock.editionMarker.aggregate.mockResolvedValue({ _max: { order: null } })
    prismaMock.editionZone.findFirst.mockResolvedValue(null)
    global.readBody.mockResolvedValue({
      name: 'Entrée principale',
      latitude: 48.8566,
      longitude: 2.3522,
      zoneId: 999,
    })

    await expect(markersPostHandler(mockEvent as any)).rejects.toThrow()
    expect(prismaMock.editionMarker.create).not.toHaveBeenCalled()
  })

  it('devrait créer un marqueur autonome quand aucune zone n’est fournie', async () => {
    prismaMock.editionMarker.count.mockResolvedValue(0)
    prismaMock.editionMarker.aggregate.mockResolvedValue({ _max: { order: null } })
    prismaMock.editionMarker.create.mockResolvedValue(mockMarker)
    global.readBody.mockResolvedValue({
      name: 'Point isolé',
      latitude: 48.8566,
      longitude: 2.3522,
    })

    await markersPostHandler(mockEvent as any)

    expect(prismaMock.editionZone.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.editionMarker.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ zoneId: null }),
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

    await expect(markersPostHandler(unauthEvent as any)).rejects.toThrow()
  })

  it("devrait rejeter si l'utilisateur n'a pas les droits sur l'édition", async () => {
    const otherUserEvent = {
      context: {
        params: { id: '1' },
        user: { id: 2, email: 'other@example.com' },
      },
    }

    // Refuser l'accès pour cet utilisateur
    mockCanEditEditionById.mockResolvedValue(false)

    global.readBody.mockResolvedValue({
      name: 'Marker Test',
      latitude: 48.8566,
      longitude: 2.3522,
    })

    await expect(markersPostHandler(otherUserEvent as any)).rejects.toThrow('Droits insuffisants')
  })

  it('devrait rejeter si la limite de markers est atteinte', async () => {
    prismaMock.editionMarker.count.mockResolvedValue(100) // MAX_MARKERS_PER_EDITION = 100

    global.readBody.mockResolvedValue({
      name: 'Marker Test',
      latitude: 48.8566,
      longitude: 2.3522,
    })

    await expect(markersPostHandler(mockEvent as any)).rejects.toThrow(
      'Limite de 100 points de repère atteinte'
    )
  })

  it('devrait valider les coordonnées de latitude', async () => {
    prismaMock.editionMarker.count.mockResolvedValue(0)

    global.readBody.mockResolvedValue({
      name: 'Marker Test',
      latitude: 91, // Hors limites (-90 à 90)
      longitude: 2.3522,
    })

    await expect(markersPostHandler(mockEvent as any)).rejects.toThrow()
  })

  it('devrait valider les coordonnées de longitude', async () => {
    prismaMock.editionMarker.count.mockResolvedValue(0)

    global.readBody.mockResolvedValue({
      name: 'Marker Test',
      latitude: 48.8566,
      longitude: 181, // Hors limites (-180 à 180)
    })

    await expect(markersPostHandler(mockEvent as any)).rejects.toThrow()
  })

  it("devrait incrémenter l'ordre automatiquement", async () => {
    prismaMock.editionMarker.count.mockResolvedValue(2)
    prismaMock.editionMarker.aggregate.mockResolvedValue({ _max: { order: 1 } })
    prismaMock.editionMarker.create.mockResolvedValue({ ...mockMarker, order: 2 })

    global.readBody.mockResolvedValue({
      name: 'Marker Test',
      latitude: 48.8566,
      longitude: 2.3522,
    })

    await markersPostHandler(mockEvent as any)

    expect(prismaMock.editionMarker.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        order: 2, // maxOrder (1) + 1
      }),
      select: expect.any(Object),
    })
  })

  it('devrait utiliser le type OTHER par défaut', async () => {
    prismaMock.editionMarker.count.mockResolvedValue(0)
    prismaMock.editionMarker.aggregate.mockResolvedValue({ _max: { order: null } })
    prismaMock.editionMarker.create.mockResolvedValue({ ...mockMarker, markerTypes: ['OTHER'] })

    global.readBody.mockResolvedValue({
      name: 'Marker Test',
      latitude: 48.8566,
      longitude: 2.3522,
      // Pas de markerTypes spécifié
    })

    await markersPostHandler(mockEvent as any)

    expect(prismaMock.editionMarker.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        markerTypes: ['OTHER'],
      }),
      select: expect.any(Object),
    })
  })

  it("devrait retourner 400 si l'ID est invalide", async () => {
    const invalidEvent = {
      context: {
        params: { id: 'invalid' },
        user: mockUser,
      },
    }

    await expect(markersPostHandler(invalidEvent as any)).rejects.toThrow()
  })

  it('devrait valider le nom (non vide)', async () => {
    prismaMock.editionMarker.count.mockResolvedValue(0)

    global.readBody.mockResolvedValue({
      name: '', // Nom vide
      latitude: 48.8566,
      longitude: 2.3522,
    })

    await expect(markersPostHandler(mockEvent as any)).rejects.toThrow()
  })

  it('devrait accepter plusieurs types de marqueur', async () => {
    prismaMock.editionMarker.count.mockResolvedValue(0)
    prismaMock.editionMarker.aggregate.mockResolvedValue({ _max: { order: null } })
    prismaMock.editionMarker.create.mockResolvedValue({
      ...mockMarker,
      markerTypes: ['ENTRANCE', 'INFO', 'PARKING'],
    })

    global.readBody.mockResolvedValue({
      name: 'Point Multi-Services',
      latitude: 48.8566,
      longitude: 2.3522,
      markerTypes: ['ENTRANCE', 'INFO', 'PARKING'],
    })

    await markersPostHandler(mockEvent as any)

    expect(prismaMock.editionMarker.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        markerTypes: ['ENTRANCE', 'INFO', 'PARKING'],
      }),
      select: expect.any(Object),
    })
  })

  it('devrait rejeter un type de marqueur invalide', async () => {
    prismaMock.editionMarker.count.mockResolvedValue(0)

    global.readBody.mockResolvedValue({
      name: 'Marker Test',
      latitude: 48.8566,
      longitude: 2.3522,
      markerTypes: ['INVALID_TYPE'],
    })

    await expect(markersPostHandler(mockEvent as any)).rejects.toThrow()
  })

  it('devrait rejeter un tableau de types vide', async () => {
    prismaMock.editionMarker.count.mockResolvedValue(0)

    global.readBody.mockResolvedValue({
      name: 'Marker Test',
      latitude: 48.8566,
      longitude: 2.3522,
      markerTypes: [],
    })

    await expect(markersPostHandler(mockEvent as any)).rejects.toThrow()
  })
})
