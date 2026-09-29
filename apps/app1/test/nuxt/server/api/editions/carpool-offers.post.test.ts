import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../../../layers/carpool/server/api/editions/[id]/carpool-offers/index.post'
import { global } from '../../../globales-nitro'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

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
      phoneNumber: '+33123456789',
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

    expect(result).toEqual({ success: true, data: mockCarpoolOffer })
    // L'existence passe désormais par le port carpool (sélection minimale { id }).
    expect(prismaMock.edition.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true },
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
        // Absentes du corps : le schéma les pose à false, comme le défaut de la colonne. Elles
        // doivent apparaître ici, et non manquer — c'est leur absence qui était le défaut.
        smokingAllowed: false,
        petsAllowed: false,
        musicAllowed: false,
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            nom: true,
            prenom: true,
            pronouns: true,
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

    await expect(handler(eventWithBadId as any)).rejects.toThrow("ID d'édition invalide")
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

    await expect(handler(mockEvent as any)).rejects.toThrow('Edition non trouvée')
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

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
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

    expect(result).toEqual({ success: true, data: mockCarpoolOffer })
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

  /**
   * Les trois préférences du trajet, qui étaient perdues en silence.
   *
   * ⚠️ Pourquoi rien ne le signalait : le formulaire les envoyait bien, mais `carpoolOfferSchema`
   * ne les déclarait pas — et zod RETIRE les clés non déclarées au lieu de s'en plaindre. Le corps
   * validé n'en portait donc plus trace, aucune erreur n'était levée, et l'offre naissait
   * « non-fumeur, sans animaux, sans musique » quoi que la personne ait coché. Elle ne pouvait le
   * découvrir qu'en relisant sa propre annonce.
   *
   * Le test porte sur ce qui est transmis à `create`, et non sur la réponse : le mock de Prisma
   * rend ce qu'on lui a dit de rendre, une assertion sur le retour mesurerait le mock.
   */
  it('enregistre les trois préférences du trajet quand elles sont cochées', async () => {
    global.readBody.mockResolvedValue({
      tripDate: '2024-07-15T08:00:00.000Z',
      locationCity: 'Paris',
      locationAddress: '123 Rue de la Paix',
      availableSeats: 3,
      direction: 'TO_EVENT',
      smokingAllowed: true,
      petsAllowed: true,
      musicAllowed: true,
    })
    prismaMock.edition.findUnique.mockResolvedValue({ id: 1 })
    prismaMock.carpoolOffer.create.mockResolvedValue({ id: 1, user: {} })

    await handler(mockEvent as any)

    expect(prismaMock.carpoolOffer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          smokingAllowed: true,
          petsAllowed: true,
          musicAllowed: true,
        }),
      })
    )
  })

  it('distingue une préférence refusée d’une préférence non transmise', async () => {
    // `false` explicite et absence donnent le même résultat — c'est voulu, la colonne vaut false
    // par défaut — mais les deux doivent ARRIVER jusqu'à `create`, sans quoi on ne saurait pas
    // distinguer « le schéma les laisse passer » de « le schéma les efface toutes ».
    global.readBody.mockResolvedValue({
      tripDate: '2024-07-15T08:00:00.000Z',
      locationCity: 'Paris',
      locationAddress: '123 Rue de la Paix',
      availableSeats: 3,
      direction: 'TO_EVENT',
      smokingAllowed: false,
      petsAllowed: true,
      musicAllowed: false,
    })
    prismaMock.edition.findUnique.mockResolvedValue({ id: 1 })
    prismaMock.carpoolOffer.create.mockResolvedValue({ id: 1, user: {} })

    await handler(mockEvent as any)

    expect(prismaMock.carpoolOffer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          smokingAllowed: false,
          petsAllowed: true,
          musicAllowed: false,
        }),
      })
    )
  })
})
