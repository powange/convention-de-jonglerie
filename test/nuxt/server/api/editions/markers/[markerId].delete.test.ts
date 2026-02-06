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

import markersDeleteHandler from '../../../../../../server/api/editions/[id]/markers/[markerId].delete'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('API Markers - Suppression (DELETE)', () => {
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
    // Par défaut, autoriser l'accès
    mockCanAccessEditionData.mockResolvedValue(true)
  })

  it('devrait supprimer un marker avec succès', async () => {
    prismaMock.editionMarker.findFirst.mockResolvedValue(mockMarker)
    prismaMock.editionMarker.delete.mockResolvedValue(mockMarker)

    const result = await markersDeleteHandler(mockEvent as any)

    expect(result).toEqual({
      success: true,
      message: 'Point de repère supprimé avec succès',
    })

    expect(prismaMock.editionMarker.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    })
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const unauthEvent = {
      context: {
        params: { id: '1', markerId: '1' },
        user: null,
      },
    }

    await expect(markersDeleteHandler(unauthEvent as any)).rejects.toThrow()
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

    await expect(markersDeleteHandler(otherUserEvent as any)).rejects.toThrow('Droits insuffisants')
  })

  it("devrait retourner 404 si le marker n'existe pas", async () => {
    prismaMock.editionMarker.findFirst.mockResolvedValue(null)

    await expect(markersDeleteHandler(mockEvent as any)).rejects.toThrow(
      'Point de repère introuvable'
    )
  })

  it("devrait rejeter si le marker n'appartient pas à l'édition", async () => {
    prismaMock.editionMarker.findFirst.mockResolvedValue(null)

    await expect(markersDeleteHandler(mockEvent as any)).rejects.toThrow(
      'Point de repère introuvable'
    )
  })

  it("devrait retourner 400 si l'ID d'édition est invalide", async () => {
    const invalidEditionEvent = {
      context: {
        params: { id: 'invalid', markerId: '1' },
        user: mockUser,
      },
    }

    await expect(markersDeleteHandler(invalidEditionEvent as any)).rejects.toThrow()
  })

  it("devrait retourner 400 si l'ID de marker est invalide", async () => {
    const invalidMarkerIdEvent = {
      context: {
        params: { id: '1', markerId: 'invalid' },
        user: mockUser,
      },
    }

    await expect(markersDeleteHandler(invalidMarkerIdEvent as any)).rejects.toThrow()
  })
})
