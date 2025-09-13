import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../server/api/editions/index.post'
import { prismaMock } from '../../../../__mocks__/prisma'

// Mock des utilitaires
vi.mock('../../../../../server/utils/geocoding', () => ({
  geocodeEdition: vi.fn().mockResolvedValue({
    latitude: 48.8566,
    longitude: 2.3522,
  }),
}))

vi.mock('../../../../../server/utils/move-temp-image', () => ({
  moveTempImageToEdition: vi.fn().mockResolvedValue('/uploads/editions/1/image.jpg'),
}))

describe('/api/editions POST', () => {
  const mockUser = {
    id: 1,
    email: 'user@example.com',
    pseudo: 'testuser',
    nom: 'Test',
    prenom: 'User',
  }

  const mockConvention = {
    id: 1,
    name: 'Convention Test',
    authorId: 1,
    author: mockUser,
  }

  const mockEdition = {
    id: 1,
    conventionId: 1,
    name: 'Edition 2024',
    description: 'Description test',
    startDate: new Date('2024-06-01'),
    endDate: new Date('2024-06-03'),
    addressLine1: '123 rue Test',
    addressLine2: null,
    postalCode: '75001',
    city: 'Paris',
    region: 'Île-de-France',
    country: 'France',
    latitude: 48.8566,
    longitude: 2.3522,
    imageUrl: null,
    creatorId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    creator: { id: 1, pseudo: 'testuser' },
    favoritedBy: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn()
  })

  it('devrait créer une édition avec succès', async () => {
    const editionData = {
      conventionId: 1,
      name: 'Edition 2024',
      description: 'Super édition',
      startDate: '2024-06-01',
      endDate: '2024-06-03',
      addressLine1: '123 rue Test',
      postalCode: '75001',
      city: 'Paris',
      country: 'France',
      hasFoodTrucks: true,
      hasToilets: true,
      hasShowers: false,
    }

    prismaMock.convention.findUnique.mockResolvedValue(mockConvention)
    prismaMock.edition.create.mockResolvedValue({
      ...mockEdition,
      ...editionData,
      creator: { id: 1, pseudo: 'testuser' },
      favoritedBy: [],
    })

    global.readBody.mockResolvedValue(editionData)

    const mockEvent = {
      context: { user: mockUser },
    }

    const result = await handler(mockEvent as any)

    expect(result.name).toBe(editionData.name)
    expect(result.description).toBe(editionData.description)
    expect(result.city).toBe(editionData.city)
    expect(result.hasFoodTrucks).toBe(true)
    expect(result.hasToilets).toBe(true)
    expect(result.hasShowers).toBe(false)

    expect(prismaMock.convention.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: editionData.conventionId } })
    )

    expect(prismaMock.edition.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conventionId: editionData.conventionId,
        name: editionData.name,
        description: editionData.description,
        creatorId: mockUser.id,
        latitude: 48.8566,
        longitude: 2.3522,
        hasFoodTrucks: true,
        hasToilets: true,
        hasShowers: false,
      }),
      include: expect.any(Object),
    })
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const mockEvent = {
      context: { user: null },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow('Unauthorized')
  })

  it("devrait rejeter si la convention n'existe pas", async () => {
    prismaMock.convention.findUnique.mockResolvedValue(null)

    global.readBody.mockResolvedValue({
      conventionId: 999,
      name: 'Edition Test',
    })

    const mockEvent = {
      context: { user: mockUser },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
  })

  it("devrait rejeter si l'utilisateur n'est pas autorisé à créer des éditions pour cette convention", async () => {
    const otherConvention = {
      ...mockConvention,
      authorId: 2, // Différent utilisateur
    }

    prismaMock.convention.findUnique.mockResolvedValue(otherConvention)

    global.readBody.mockResolvedValue({
      conventionId: 1,
      name: 'Edition Test',
    })

    const mockEvent = {
      context: { user: mockUser },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
  })

  it("devrait géocoder l'adresse pour obtenir les coordonnées", async () => {
    const { geocodeEdition } = await import('../../../../../server/utils/geocoding')

    const editionData = {
      conventionId: 1,
      name: 'Edition 2024',
      startDate: '2024-06-01',
      endDate: '2024-06-03',
      addressLine1: '123 rue Test',
      postalCode: '75001',
      city: 'Paris',
      country: 'France',
    }

    prismaMock.convention.findUnique.mockResolvedValue(mockConvention)
    prismaMock.edition.create.mockResolvedValue({
      ...mockEdition,
      creator: { id: 1, pseudo: 'testuser' },
      favoritedBy: [],
    })

    global.readBody.mockResolvedValue(editionData)

    const mockEvent = {
      context: { user: mockUser },
    }

    await handler(mockEvent as any)

    expect(geocodeEdition).toHaveBeenCalledWith({
      addressLine1: editionData.addressLine1,
      addressLine2: undefined,
      city: editionData.city,
      postalCode: editionData.postalCode,
      country: editionData.country,
    })
  })

  it("devrait gérer l'upload d'image", async () => {
    const { moveTempImageToEdition } = await import('../../../../../server/utils/move-temp-image')

    const editionData = {
      conventionId: 1,
      name: 'Edition 2024',
      imageUrl: '/temp/123456.jpg',
      startDate: '2024-06-01',
      endDate: '2024-06-03',
      addressLine1: '123 rue Test',
      postalCode: '75001',
      city: 'Paris',
      country: 'France',
    }

    prismaMock.convention.findUnique.mockResolvedValue(mockConvention)
    prismaMock.edition.create.mockResolvedValue({
      ...mockEdition,
      id: 1,
      creator: { id: 1, pseudo: 'testuser' },
      favoritedBy: [],
    })
    prismaMock.edition.update.mockResolvedValue({
      ...mockEdition,
      imageUrl: '/uploads/editions/1/image.jpg',
      creator: { id: 1, pseudo: 'testuser' },
      favoritedBy: [],
    })

    global.readBody.mockResolvedValue(editionData)

    const mockEvent = {
      context: { user: mockUser },
    }

    const result = await handler(mockEvent as any)

    expect(moveTempImageToEdition).toHaveBeenCalledWith('/temp/123456.jpg', 1)
    expect(result.imageUrl).toBe('/uploads/editions/1/image.jpg')
  })

  it('devrait valider les champs requis', async () => {
    const incompleteData = {
      conventionId: 1,
      // manque name, dates, adresse
    }

    global.readBody.mockResolvedValue(incompleteData)

    const mockEvent = {
      context: { user: mockUser },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow()
  })

  it('devrait valider que la date de fin est après la date de début', async () => {
    const invalidData = {
      conventionId: 1,
      name: 'Edition Test',
      startDate: '2024-06-10',
      endDate: '2024-06-05', // Date de fin avant date de début
      addressLine1: '123 rue Test',
      city: 'Paris',
      country: 'France',
    }

    prismaMock.convention.findUnique.mockResolvedValue(mockConvention)
    global.readBody.mockResolvedValue(invalidData)

    const mockEvent = {
      context: { user: mockUser },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
  })

  it('devrait définir des valeurs par défaut pour les services', async () => {
    const editionData = {
      conventionId: 1,
      name: 'Edition 2024',
      startDate: '2024-06-01',
      endDate: '2024-06-03',
      addressLine1: '123 rue Test',
      postalCode: '75001',
      city: 'Paris',
      country: 'France',
      // Aucun service spécifié
    }

    prismaMock.convention.findUnique.mockResolvedValue(mockConvention)
    prismaMock.edition.create.mockResolvedValue(mockEdition)

    global.readBody.mockResolvedValue(editionData)

    const mockEvent = {
      context: { user: mockUser },
    }

    await handler(mockEvent as any)

    const createCall = prismaMock.edition.create.mock.calls[0][0]

    // Vérifier que tous les services ont des valeurs par défaut à false
    expect(createCall.data.hasFoodTrucks).toBe(false)
    expect(createCall.data.hasKidsZone).toBe(false)
    expect(createCall.data.acceptsPets).toBe(false)
    expect(createCall.data.hasTentCamping).toBe(false)
    expect(createCall.data.hasTruckCamping).toBe(false)
    expect(createCall.data.hasFamilyCamping).toBe(false)
    expect(createCall.data.hasGym).toBe(false)
    expect(createCall.data.hasFireSpace).toBe(false)
    expect(createCall.data.hasGala).toBe(false)
    expect(createCall.data.hasOpenStage).toBe(false)
    expect(createCall.data.hasConcert).toBe(false)
    expect(createCall.data.hasCantine).toBe(false)
    expect(createCall.data.hasAerialSpace).toBe(false)
    expect(createCall.data.hasSlacklineSpace).toBe(false)
    expect(createCall.data.hasToilets).toBe(false)
    expect(createCall.data.hasShowers).toBe(false)
    expect(createCall.data.hasAccessibility).toBe(false)
    expect(createCall.data.hasWorkshops).toBe(false)
    expect(createCall.data.hasCreditCardPayment).toBe(false)
    expect(createCall.data.hasAfjTokenPayment).toBe(false)
  })

  it('devrait gérer les erreurs de géocodage', async () => {
    const { geocodeEdition } = await import('../../../../../server/utils/geocoding')
    vi.mocked(geocodeEdition).mockRejectedValue(new Error('Geocoding failed'))

    prismaMock.convention.findUnique.mockResolvedValue(mockConvention)

    global.readBody.mockResolvedValue({
      conventionId: 1,
      name: 'Edition 2024',
      startDate: '2024-06-01',
      endDate: '2024-06-03',
      addressLine1: 'Invalid Address',
      city: 'Unknown City',
      postalCode: '00000',
      country: 'Unknown',
    })

    const mockEvent = {
      context: { user: mockUser },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow()
  })
})
