import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../server/api/carpool-requests/[id]/index.delete'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const mockEvent = {
  context: {
    params: { id: '1' },
    user: { id: 1, email: 'test@example.com', pseudo: 'testuser', isGlobalAdmin: false },
  },
}

const mockEventWithoutUser = {
  context: {
    params: { id: '1' },
  },
}

const mockCarpoolRequest = {
  id: 1,
  editionId: 1,
  userId: 1,
  tripDate: new Date('2024-07-15'),
  locationCity: 'Paris',
  seatsNeeded: 2,
  description: 'Recherche covoiturage',
  createdAt: new Date(),
}

describe('/api/carpool-requests/[id] DELETE', () => {
  beforeEach(() => {
    prismaMock.carpoolRequest.findUnique.mockReset()
    prismaMock.carpoolRequest.delete.mockReset()
    global.getRouterParam = vi.fn().mockReturnValue('1')
  })

  it("devrait supprimer une demande avec succès quand l'utilisateur est le créateur", async () => {
    prismaMock.carpoolRequest.findUnique.mockResolvedValue(mockCarpoolRequest)
    prismaMock.carpoolRequest.delete.mockResolvedValue(mockCarpoolRequest)

    const result = await handler(mockEvent as any)

    expect(result.message).toBe('Demande de covoiturage supprimée avec succès')
    expect(prismaMock.carpoolRequest.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    })
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    await expect(handler(mockEventWithoutUser as any)).rejects.toThrow('Unauthorized')
  })

  it('devrait rejeter un ID de demande invalide', async () => {
    global.getRouterParam = vi.fn().mockReturnValue('invalid')

    await expect(handler(mockEvent as any)).rejects.toThrow('ID de demande invalide')
  })

  it('devrait rejeter un ID de demande égal à 0', async () => {
    global.getRouterParam = vi.fn().mockReturnValue('0')

    await expect(handler(mockEvent as any)).rejects.toThrow('ID de demande invalide')
  })

  it('devrait rejeter si demande non trouvée', async () => {
    prismaMock.carpoolRequest.findUnique.mockResolvedValue(null)

    await expect(handler(mockEvent as any)).rejects.toThrow('Demande de covoiturage introuvable')
  })

  it("devrait rejeter si l'utilisateur n'est pas le créateur", async () => {
    const requestByOtherUser = { ...mockCarpoolRequest, userId: 999 }
    prismaMock.carpoolRequest.findUnique.mockResolvedValue(requestByOtherUser)

    await expect(handler(mockEvent as any)).rejects.toThrow(
      "Vous n'avez pas les droits pour supprimer cette demande"
    )
  })

  it('devrait gérer les erreurs de base de données lors de la recherche', async () => {
    prismaMock.carpoolRequest.findUnique.mockRejectedValue(new Error('DB Error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
  })

  it('devrait gérer les erreurs de base de données lors de la suppression', async () => {
    prismaMock.carpoolRequest.findUnique.mockResolvedValue(mockCarpoolRequest)
    prismaMock.carpoolRequest.delete.mockRejectedValue(new Error('Delete Error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
  })

  it('devrait relancer les erreurs HTTP', async () => {
    const httpError = {
      statusCode: 403,
      statusMessage: 'Access denied',
    }

    prismaMock.carpoolRequest.findUnique.mockRejectedValue(httpError)

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError)
  })

  it('devrait appeler findUnique avec les bons paramètres', async () => {
    global.getRouterParam = vi.fn().mockReturnValue('42')
    prismaMock.carpoolRequest.findUnique.mockResolvedValue(null)

    try {
      await handler(mockEvent as any)
    } catch {
      // Ignorer l'erreur
    }

    expect(prismaMock.carpoolRequest.findUnique).toHaveBeenCalledWith({
      where: { id: 42 },
    })
  })
})
