import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../server/api/carpool-offers/[id]/index.delete'

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

const mockCarpoolOffer = {
  id: 1,
  editionId: 1,
  userId: 1,
  tripDate: new Date('2024-07-15'),
  locationCity: 'Paris',
  locationAddress: '10 rue de Paris',
  availableSeats: 3,
  description: 'Covoiturage sympa',
  createdAt: new Date(),
}

describe('/api/carpool-offers/[id] DELETE', () => {
  beforeEach(() => {
    prismaMock.carpoolOffer.findUnique.mockReset()
    prismaMock.carpoolOffer.delete.mockReset()
    global.getRouterParam = vi.fn().mockReturnValue('1')
  })

  it("devrait supprimer une offre avec succès quand l'utilisateur est le créateur", async () => {
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
    prismaMock.carpoolOffer.delete.mockResolvedValue(mockCarpoolOffer)

    const result = await handler(mockEvent as any)

    expect(result.message).toBe('Offre de covoiturage supprimée avec succès')
    expect(prismaMock.carpoolOffer.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    })
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    await expect(handler(mockEventWithoutUser as any)).rejects.toThrow('Unauthorized')
  })

  it("devrait rejeter un ID d'offre invalide", async () => {
    global.getRouterParam = vi.fn().mockReturnValue('invalid')

    await expect(handler(mockEvent as any)).rejects.toThrow("ID d'offre invalide")
  })

  it("devrait rejeter un ID d'offre égal à 0", async () => {
    global.getRouterParam = vi.fn().mockReturnValue('0')

    await expect(handler(mockEvent as any)).rejects.toThrow("ID d'offre invalide")
  })

  it('devrait rejeter si offre non trouvée', async () => {
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(null)

    await expect(handler(mockEvent as any)).rejects.toThrow('Offre de covoiturage introuvable')
  })

  it("devrait rejeter si l'utilisateur n'est pas le créateur", async () => {
    const offerByOtherUser = { ...mockCarpoolOffer, userId: 999 }
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(offerByOtherUser)

    await expect(handler(mockEvent as any)).rejects.toThrow(
      "Vous n'avez pas les droits pour supprimer cette offre"
    )
  })

  it('devrait gérer les erreurs de base de données lors de la recherche', async () => {
    prismaMock.carpoolOffer.findUnique.mockRejectedValue(new Error('DB Error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
  })

  it('devrait gérer les erreurs de base de données lors de la suppression', async () => {
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(mockCarpoolOffer)
    prismaMock.carpoolOffer.delete.mockRejectedValue(new Error('Delete Error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
  })

  it('devrait relancer les erreurs HTTP', async () => {
    const httpError = {
      statusCode: 403,
      statusMessage: 'Access denied',
    }

    prismaMock.carpoolOffer.findUnique.mockRejectedValue(httpError)

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError)
  })

  it('devrait appeler findUnique avec les bons paramètres', async () => {
    global.getRouterParam = vi.fn().mockReturnValue('42')
    prismaMock.carpoolOffer.findUnique.mockResolvedValue(null)

    try {
      await handler(mockEvent as any)
    } catch {
      // Ignorer l'erreur
    }

    expect(prismaMock.carpoolOffer.findUnique).toHaveBeenCalledWith({
      where: { id: 42 },
    })
  })
})
