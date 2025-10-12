import { describe, it, expect, beforeEach } from 'vitest'

import { prismaMock } from '../../../../__mocks__/prisma'
import handler from '../../../../../server/api/editions/[id]/carpool-requests/index.post'

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

describe('/api/editions/[id]/carpool-requests POST', () => {
  beforeEach(() => {
    // Reset tous les mocks avant chaque test
    prismaMock.edition.findUnique.mockReset()
    prismaMock.carpoolRequest.create.mockReset()
    global.readBody = vi.fn()
  })

  it('devrait créer une demande de covoiturage avec succès', async () => {
    const requestBody = {
      tripDate: '2024-07-15T08:00:00.000Z',
      locationCity: 'Lyon',
      direction: 'TO_EVENT',
      seatsNeeded: 2,
      description: 'Cherche covoiturage sympa',
      phoneNumber: '0987654321',
    }

    const mockEdition = {
      id: 1,
      name: 'EJC 2024',
      startDate: new Date('2024-07-15'),
      endDate: new Date('2024-07-17'),
    }

    const mockCarpoolRequest = {
      id: 1,
      editionId: 1,
      userId: 1,
      tripDate: new Date(requestBody.tripDate),
      locationCity: requestBody.locationCity,
      direction: requestBody.direction,
      seatsNeeded: requestBody.seatsNeeded,
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
    prismaMock.carpoolRequest.create.mockResolvedValue(mockCarpoolRequest)

    const result = await handler(mockEvent as any)

    expect(result).toEqual(mockCarpoolRequest)
    expect(prismaMock.edition.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
    })
    expect(prismaMock.carpoolRequest.create).toHaveBeenCalledWith({
      data: {
        editionId: 1,
        userId: 1,
        tripDate: new Date(requestBody.tripDate),
        locationCity: requestBody.locationCity,
        direction: requestBody.direction,
        seatsNeeded: requestBody.seatsNeeded,
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

    await expect(handler(eventWithoutUser as any)).rejects.toThrow('Unauthorized')
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
      locationCity: 'Lyon',
      seatsNeeded: 2,
    }

    global.readBody.mockResolvedValue(incompleteBody)

    await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
  })

  it('devrait valider les données obligatoires - locationCity manquante', async () => {
    const incompleteBody = {
      tripDate: '2024-07-15T08:00:00.000Z',
      seatsNeeded: 2,
    }

    global.readBody.mockResolvedValue(incompleteBody)

    await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
  })

  it('devrait rejeter si édition non trouvée', async () => {
    const requestBody = {
      tripDate: '2024-07-15T08:00:00.000Z',
      locationCity: 'Lyon',
      direction: 'FROM_EVENT',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.edition.findUnique.mockResolvedValue(null)

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur')
  })

  it('devrait gérer les erreurs de base de données', async () => {
    const requestBody = {
      tripDate: '2024-07-15T08:00:00.000Z',
      locationCity: 'Lyon',
      direction: 'TO_EVENT',
    }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.edition.findUnique.mockRejectedValue(new Error('Database error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur')
  })

  it('devrait créer une demande avec seatsNeeded par défaut à 1', async () => {
    const requestBodyMinimal = {
      tripDate: '2024-07-15T08:00:00.000Z',
      locationCity: 'Lyon',
      direction: 'TO_EVENT',
      // seatsNeeded omis
    }

    const mockEdition = { id: 1, name: 'EJC 2024' }
    const mockCarpoolRequest = {
      id: 1,
      editionId: 1,
      userId: 1,
      tripDate: new Date(requestBodyMinimal.tripDate),
      locationCity: requestBodyMinimal.locationCity,
      seatsNeeded: 1, // Valeur par défaut
      user: { id: 1, pseudo: 'testuser', prenom: 'Test', nom: 'User' },
    }

    global.readBody.mockResolvedValue(requestBodyMinimal)
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.carpoolRequest.create.mockResolvedValue(mockCarpoolRequest)

    const result = await handler(mockEvent as any)

    expect(result).toEqual(mockCarpoolRequest)
    expect(prismaMock.carpoolRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          seatsNeeded: 1, // Valeur par défaut appliquée
        }),
      })
    )
  })

  it('devrait créer une demande avec données optionnelles null', async () => {
    const requestBodyMinimal = {
      tripDate: '2024-07-15T08:00:00.000Z',
      locationCity: 'Lyon',
      direction: 'FROM_EVENT',
      // description et phoneNumber omis
    }

    const mockEdition = { id: 1, name: 'EJC 2024' }
    const mockCarpoolRequest = {
      id: 1,
      editionId: 1,
      userId: 1,
      ...requestBodyMinimal,
      tripDate: new Date(requestBodyMinimal.tripDate),
      seatsNeeded: 1,
      description: undefined,
      phoneNumber: undefined,
      user: { id: 1, pseudo: 'testuser', prenom: 'Test', nom: 'User' },
    }

    global.readBody.mockResolvedValue(requestBodyMinimal)
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.carpoolRequest.create.mockResolvedValue(mockCarpoolRequest)

    const result = await handler(mockEvent as any)

    expect(result).toEqual(mockCarpoolRequest)
    expect(prismaMock.carpoolRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: undefined,
          phoneNumber: undefined,
        }),
      })
    )
  })

  it('devrait accepter seatsNeeded personnalisé', async () => {
    const requestBody = {
      tripDate: '2024-07-15T08:00:00.000Z',
      locationCity: 'Lyon',
      direction: 'FROM_EVENT',
      seatsNeeded: 3, // Valeur personnalisée
    }

    const mockEdition = { id: 1, name: 'EJC 2024' }
    const mockCarpoolRequest = { id: 1, seatsNeeded: 3 }

    global.readBody.mockResolvedValue(requestBody)
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.carpoolRequest.create.mockResolvedValue(mockCarpoolRequest)

    await handler(mockEvent as any)

    expect(prismaMock.carpoolRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          seatsNeeded: 3, // Valeur personnalisée utilisée
        }),
      })
    )
  })
})
