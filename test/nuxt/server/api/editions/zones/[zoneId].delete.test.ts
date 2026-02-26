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

import zonesDeleteHandler from '../../../../../../server/api/editions/[id]/zones/[zoneId].delete'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('API Zones - Suppression (DELETE)', () => {
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
    // Par défaut, autoriser l'accès
    mockCanAccessEditionData.mockResolvedValue(true)
  })

  it('devrait supprimer une zone avec succès', async () => {
    prismaMock.editionZone.findFirst.mockResolvedValue(mockZone)
    prismaMock.editionZone.delete.mockResolvedValue(mockZone)

    const result = await zonesDeleteHandler(mockEvent as any)

    expect(result).toEqual({
      success: true,
      data: null,
      message: 'Zone supprimée avec succès',
    })

    expect(prismaMock.editionZone.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    })
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const unauthEvent = {
      context: {
        params: { id: '1', zoneId: '1' },
        user: null,
      },
    }

    await expect(zonesDeleteHandler(unauthEvent as any)).rejects.toThrow()
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

    await expect(zonesDeleteHandler(otherUserEvent as any)).rejects.toThrow('Droits insuffisants')
  })

  it("devrait retourner 404 si la zone n'existe pas", async () => {
    prismaMock.editionZone.findFirst.mockResolvedValue(null)

    await expect(zonesDeleteHandler(mockEvent as any)).rejects.toThrow('Zone introuvable')
  })

  it("devrait rejeter si la zone n'appartient pas à l'édition", async () => {
    // findFirst avec where { id, editionId } ne trouve rien car zone appartient à une autre édition
    prismaMock.editionZone.findFirst.mockResolvedValue(null)

    await expect(zonesDeleteHandler(mockEvent as any)).rejects.toThrow('Zone introuvable')
  })

  it("devrait retourner 400 si l'ID d'édition est invalide", async () => {
    const invalidEditionEvent = {
      context: {
        params: { id: 'invalid', zoneId: '1' },
        user: mockUser,
      },
    }

    await expect(zonesDeleteHandler(invalidEditionEvent as any)).rejects.toThrow()
  })

  it("devrait retourner 400 si l'ID de zone est invalide", async () => {
    const invalidZoneIdEvent = {
      context: {
        params: { id: '1', zoneId: 'invalid' },
        user: mockUser,
      },
    }

    await expect(zonesDeleteHandler(invalidZoneIdEvent as any)).rejects.toThrow()
  })
})
