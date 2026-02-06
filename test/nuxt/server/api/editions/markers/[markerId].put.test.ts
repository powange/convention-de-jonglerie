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

import markersPutHandler from '../../../../../../server/api/editions/[id]/markers/[markerId].put'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('API Markers - Mise à jour (PUT)', () => {
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
    markerType: 'ENTRANCE',
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockEvent = {
    context: {
      params: { id: '1', markerId: '1' },
      user: mockUser,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn()
    // Par défaut, autoriser l'accès
    mockCanAccessEditionData.mockResolvedValue(true)
  })

  it('devrait mettre à jour un marker avec succès', async () => {
    const updateData = {
      name: 'Entrée secondaire',
      description: 'Nouvelle description',
    }

    prismaMock.editionMarker.findFirst.mockResolvedValue(mockMarker)
    prismaMock.editionMarker.update.mockResolvedValue({
      ...mockMarker,
      ...updateData,
    })
    global.readBody.mockResolvedValue(updateData)

    const result = await markersPutHandler(mockEvent as any)

    expect(result).toEqual({
      success: true,
      marker: expect.objectContaining({
        name: updateData.name,
        description: updateData.description,
      }),
    })

    expect(prismaMock.editionMarker.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        name: updateData.name,
        description: updateData.description,
      }),
      select: expect.any(Object),
    })
  })

  it('devrait permettre une mise à jour partielle', async () => {
    const updateData = {
      name: 'Nouveau nom uniquement',
    }

    prismaMock.editionMarker.findFirst.mockResolvedValue(mockMarker)
    prismaMock.editionMarker.update.mockResolvedValue({
      ...mockMarker,
      name: updateData.name,
    })
    global.readBody.mockResolvedValue(updateData)

    const result = await markersPutHandler(mockEvent as any)

    expect(result.marker.name).toBe(updateData.name)
  })

  it('devrait permettre la mise à jour de la position', async () => {
    const updateData = {
      latitude: 48.9,
      longitude: 2.4,
    }

    prismaMock.editionMarker.findFirst.mockResolvedValue(mockMarker)
    prismaMock.editionMarker.update.mockResolvedValue({
      ...mockMarker,
      ...updateData,
    })
    global.readBody.mockResolvedValue(updateData)

    const result = await markersPutHandler(mockEvent as any)

    expect(result.marker.latitude).toBe(updateData.latitude)
    expect(result.marker.longitude).toBe(updateData.longitude)
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const unauthEvent = {
      context: {
        params: { id: '1', markerId: '1' },
        user: null,
      },
    }

    await expect(markersPutHandler(unauthEvent as any)).rejects.toThrow()
  })

  it("devrait rejeter si l'utilisateur n'a pas les droits", async () => {
    const otherUserEvent = {
      context: {
        params: { id: '1', markerId: '1' },
        user: { id: 2, email: 'other@example.com' },
      },
    }

    // Refuser l'accès pour cet utilisateur
    mockCanAccessEditionData.mockResolvedValue(false)

    global.readBody.mockResolvedValue({ name: 'Test' })

    await expect(markersPutHandler(otherUserEvent as any)).rejects.toThrow('Droits insuffisants')
  })

  it("devrait retourner 404 si le marker n'existe pas", async () => {
    prismaMock.editionMarker.findFirst.mockResolvedValue(null)

    global.readBody.mockResolvedValue({ name: 'Test' })

    await expect(markersPutHandler(mockEvent as any)).rejects.toThrow('Point de repère introuvable')
  })

  it("devrait rejeter si le marker n'appartient pas à l'édition", async () => {
    prismaMock.editionMarker.findFirst.mockResolvedValue(null)

    global.readBody.mockResolvedValue({ name: 'Test' })

    await expect(markersPutHandler(mockEvent as any)).rejects.toThrow('Point de repère introuvable')
  })

  it('devrait valider les coordonnées si fournies', async () => {
    prismaMock.editionMarker.findFirst.mockResolvedValue(mockMarker)

    global.readBody.mockResolvedValue({
      latitude: 91, // Hors limites
    })

    await expect(markersPutHandler(mockEvent as any)).rejects.toThrow()
  })

  it('devrait permettre la mise à jour du type de marker', async () => {
    prismaMock.editionMarker.findFirst.mockResolvedValue(mockMarker)
    prismaMock.editionMarker.update.mockResolvedValue({
      ...mockMarker,
      markerType: 'INFO',
    })
    global.readBody.mockResolvedValue({ markerType: 'INFO' })

    const result = await markersPutHandler(mockEvent as any)

    expect(result.marker.markerType).toBe('INFO')
  })

  it("devrait retourner 400 si l'ID de marker est invalide", async () => {
    const invalidMarkerIdEvent = {
      context: {
        params: { id: '1', markerId: 'invalid' },
        user: mockUser,
      },
    }

    await expect(markersPutHandler(invalidMarkerIdEvent as any)).rejects.toThrow()
  })
})
