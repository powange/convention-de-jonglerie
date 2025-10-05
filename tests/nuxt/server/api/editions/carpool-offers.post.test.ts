import { describe, it, expect, beforeEach } from 'vitest'

import { prismaMock } from '../../../../__mocks__/prisma'
import handler from '../../../../server/api/editions/[id]/carpool-offers/index.post'

// Mock des modules Nuxt
const mockEvent = {
  context: {
    params: { id: '1' },
    user: {
      id: 1,
      email: 'user@test.com',
      pseudo: 'testuser',
    },
  },
}

describe('/api/editions/[id]/carpool-offers POST', () => {
  beforeEach(() => {
    // Reset tous les mocks avant chaque test
    prismaMock.edition.findUnique.mockReset()
    prismaMock.carpoolOffer.create.mockReset()
    global.readBody = vi.fn()
  })

  it('devrait créer une offre de covoiturage avec succès', async () => {
    const requestBody = {
      tripDate: '2024-07-15T08:00:00.000Z',
      locationCity: 'Paris',
      locationAddress: '123 Rue de la Paix',
      availableSeats: 3,
      direction: 'TO_EVENT',
      description: 'Voyage sympa vers la convention',
      phoneNumber: '0123456789',
    }

    const mockEdition = {
      id: 1,
      name: 'EJC 2024',
      startDate: new Date('2024-07-15'),
      endDate: new Date('2024-07-17'),
    }

    const mockCarpoolOffer = {
      id: 1,
      editionId: 1,
      userId: 1,
      tripDate: new Date(requestBody.tripDate),
      locationCity: requestBody.locationCity,
      locationAddress: requestBody.locationAddress,
      availableSeats: requestBody.availableSeats,
      direction: requestBody.direction,
      description: requestBody.description,
      phoneNumber: requestBody.phoneNumber,
      createdAt: new Date(),
      user: {
        id: 1,
        pseudo: 'testuser',
        prenom: 'Test',
        nom: 'User',
      },
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.carpoolOffer.create.mockResolvedValue(mockCarpoolOffer)

    const result = await handler(mockEvent as any)

    expect(result).toEqual(mockCarpoolOffer)
    expect(prismaMock.edition.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
    })
    expect(prismaMock.carpoolOffer.create).toHaveBeenCalledWith({
      data: {
        editionId: 1,
        userId: 1,
        tripDate: new Date(requestBody.tripDate),
        locationCity: requestBody.locationCity,
        locationAddress: requestBody.locationAddress,
        availableSeats: requestBody.availableSeats,
        direction: requestBody.direction,
        description: requestBody.description,
        phoneNumber: requestBody.phoneNumber,
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            prenom: true,
            nom: true,
          },
        },
      },
    })
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const eventWithoutUser = {
      ...mockEvent,
      context: { ...mockEvent.context, user: null },
    }

    await expect(handler(eventWithoutUser as any)).rejects.toThrow('Non authentifié')
  })

  it("devrait rejeter un ID d'édition invalide", async () => {
    const eventWithBadId = {
      ...mockEvent,
      context: { ...mockEvent.context, params: { id: 'invalid' } },
    }

    global.readBody.mockResolvedValue({})

    await expect(handler(eventWithBadId as any)).rejects.toThrow('Edition ID invalide')
  })

  it('devrait valider les données obligatoires - tripDate manquante', async () => {
    const incompleteBody = {
      locationCity: 'Paris',
      locationAddress: '123 Rue de la Paix',
      availableSeats: 3,
    }

    global.readBody.mockResolvedValue(incompleteBody)

    await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
  })

  it('devrait valider les données obligatoires - locationCity manquante', async () => {
    const incompleteBody = {
      tripDate: '2024-07-15T08:00:00.000Z',
      locationAddress: '123 Rue de la Paix',
      availableSeats: 3,
    }

    global.readBody.mockResolvedValue(incompleteBody)

    await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
  })

  it('devrait valider les données obligatoires - locationAddress manquante', async () => {
    const incompleteBody = {
      tripDate: '2024-07-15T08:00:00.000Z',
      locationCity: 'Paris',
      availableSeats: 3,
    }

    global.readBody.mockResolvedValue(incompleteBody)

    await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
  })

  it('devrait valider les données obligatoires - availableSeats manquant', async () => {
    const incompleteBody = {
      tripDate: '2024-07-15T08:00:00.000Z',
      locationCity: 'Paris',
      locationAddress: '123 Rue de la Paix',
    }

    global.readBody.mockResolvedValue(incompleteBody)

    await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
  })

  it('devrait rejeter si édition non trouvée', async () => {
    const requestBody = {
      tripDate: '2024-07-15T08:00:00.000Z',
      locationCity: 'Paris',
      locationAddress: '123 Rue de la Paix',
      availableSeats: 3,
      direction: 'TO_EVENT',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.edition.findUnique.mockResolvedValue(null)

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur')
  })

  it('devrait gérer les erreurs de base de données', async () => {
    const requestBody = {
      tripDate: '2024-07-15T08:00:00.000Z',
      locationCity: 'Paris',
      locationAddress: '123 Rue de la Paix',
      availableSeats: 3,
      direction: 'FROM_EVENT',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.edition.findUnique.mockRejectedValue(new Error('Database error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur')
  })

  it('devrait créer une offre avec données optionnelles null', async () => {
    const requestBodyMinimal = {
      tripDate: '2024-07-15T08:00:00.000Z',
      locationCity: 'Paris',
      locationAddress: '123 Rue de la Paix',
      availableSeats: 2,
      direction: 'TO_EVENT',
      // description et phoneNumber omis
    }

    const mockEdition = { id: 1, name: 'EJC 2024' }
    const mockCarpoolOffer = {
      id: 1,
      editionId: 1,
      userId: 1,
      ...requestBodyMinimal,
      tripDate: new Date(requestBodyMinimal.tripDate),
      description: undefined,
      phoneNumber: undefined,
      user: { id: 1, pseudo: 'testuser', prenom: 'Test', nom: 'User' },
    }

    global.readBody.mockResolvedValue(requestBodyMinimal)
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.carpoolOffer.create.mockResolvedValue(mockCarpoolOffer)

    const result = await handler(mockEvent as any)

    expect(result).toEqual(mockCarpoolOffer)
    expect(prismaMock.carpoolOffer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: undefined,
          phoneNumber: undefined,
        }),
      })
    )
  })

  it('devrait convertir availableSeats en entier', async () => {
    const requestBody = {
      tripDate: '2024-07-15T08:00:00.000Z',
      locationCity: 'Paris',
      locationAddress: '123 Rue de la Paix',
      availableSeats: '4', // String au lieu d'entier
      direction: 'FROM_EVENT',
    }

    const mockEdition = { id: 1, name: 'EJC 2024' }
    const mockCarpoolOffer = { id: 1, availableSeats: 4 }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.carpoolOffer.create.mockResolvedValue(mockCarpoolOffer)

    await handler(mockEvent as any)

    expect(prismaMock.carpoolOffer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          availableSeats: 4, // Converti en entier
        }),
      })
    )
  })
})
