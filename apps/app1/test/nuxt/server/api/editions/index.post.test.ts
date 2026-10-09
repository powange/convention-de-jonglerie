import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock des utilitaires - DOIT être avant les imports
vi.mock('../../../../../server/utils/geocoding', () => ({
  geocodeEdition: vi.fn(),
}))
vi.mock('../../../../../server/utils/move-temp-image', () => ({
  moveTempImageToEdition: vi.fn(),
  moveTempImageFromPlaceholder: vi.fn(),
}))

import { geocodeEdition } from '../../../../../server/utils/geocoding'
import {
  moveTempImageToEdition,
  moveTempImageFromPlaceholder,
} from '../../../../../server/utils/move-temp-image'
import handler from '../../../../../server/api/editions/index.post'
import { global } from '../../../globales-nitro'
import { CLES_SERVICES_EDITION } from '../../../../../shared/utils/services-d-edition'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const mockGeocodeEdition = geocodeEdition as ReturnType<typeof vi.fn>
const mockMoveTempImage = moveTempImageToEdition as ReturnType<typeof vi.fn>
const mockMoveTempImageFromPlaceholder = moveTempImageFromPlaceholder as ReturnType<typeof vi.fn>

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

    // Ancre Event créée avant chaque édition (invariant Edition.id == eventId)
    prismaMock.event.create.mockResolvedValue({ id: 1 })

    // La création passe par `$transaction(async (tx) => ...)` : on exécute le callback
    // avec le mock global comme tx pour réutiliser les mêmes mocks de modèle.
    prismaMock.$transaction.mockImplementation(async (arg: any) =>
      typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg)
    )

    // Valeurs par défaut pour les mocks
    mockGeocodeEdition.mockResolvedValue({
      latitude: 48.8566,
      longitude: 2.3522,
    })
    mockMoveTempImage.mockResolvedValue('/uploads/editions/1/image.jpg')
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

    expect(result.success).toBe(true)
    expect(result.data.name).toBe(editionData.name)
    expect(result.data.description).toBe(editionData.description)
    expect(result.data.city).toBe(editionData.city)
    expect(result.data.hasFoodTrucks).toBe(true)
    expect(result.data.hasToilets).toBe(true)
    expect(result.data.hasShowers).toBe(false)

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

    expect(mockGeocodeEdition).toHaveBeenCalledWith({
      addressLine1: editionData.addressLine1,
      addressLine2: undefined,
      city: editionData.city,
      postalCode: editionData.postalCode,
      country: editionData.country,
    })
  })

  it("devrait gérer l'upload d'image", async () => {
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

    expect(mockMoveTempImage).toHaveBeenCalledWith('/temp/123456.jpg', 1)
    expect(result.data.imageUrl).toBe('/uploads/editions/1/image.jpg')
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

    /*
     * ⚠️ CE TEST ÉNUMÉRAIT LES SERVICES À LA MAIN — les 23 mêmes que le handler, et donc PAS
     * `hasUnicycleSpace`, `hasLongShow` ni `hasATM`. Il avait été écrit en recopiant la liste du
     * code qu'il devait éprouver : il ne pouvait structurellement pas attraper l'oubli, et il
     * était vert pendant toute la durée du défaut.
     *
     * Il boucle désormais sur la source unique. Un service ajouté au schéma Prisma et à
     * `CLES_SERVICES_EDITION` est couvert ici sans qu'on y pense.
     */
    for (const cle of CLES_SERVICES_EDITION) {
      expect(createCall.data[cle], `${cle} devrait partir à false`).toBe(false)
    }
    expect(Object.keys(createCall.data)).toEqual(expect.arrayContaining([...CLES_SERVICES_EDITION]))
  })

  it('écrit les trois services que la destructuration perdait', async () => {
    /*
     * Le cœur du correctif. `hasUnicycleSpace`, `hasLongShow` et `hasATM` étaient acceptés par
     * `editionSchema`, donc présents dans les données validées — et perdus parce que le handler
     * ne les destructurait pas. Envoyés à `true`, ils doivent arriver à `true` dans le `create`.
     */
    prismaMock.convention.findUnique.mockResolvedValue(mockConvention)
    prismaMock.edition.create.mockResolvedValue(mockEdition)
    global.readBody.mockResolvedValue({
      conventionId: 1,
      name: 'Edition 2024',
      startDate: '2024-06-01',
      endDate: '2024-06-03',
      addressLine1: '123 rue Test',
      postalCode: '75001',
      city: 'Paris',
      country: 'France',
      hasUnicycleSpace: true,
      hasLongShow: true,
      hasATM: true,
    })

    await handler({ context: { user: mockUser } } as any)

    const { data } = prismaMock.edition.create.mock.calls[0][0]
    expect(data.hasUnicycleSpace).toBe(true)
    expect(data.hasLongShow).toBe(true)
    expect(data.hasATM).toBe(true)
  })

  it('écrit jugglingEdgeUrl et currency, que la destructuration perdait aussi', async () => {
    prismaMock.convention.findUnique.mockResolvedValue(mockConvention)
    prismaMock.edition.create.mockResolvedValue(mockEdition)
    global.readBody.mockResolvedValue({
      conventionId: 1,
      name: 'Edition 2024',
      startDate: '2024-06-01',
      endDate: '2024-06-03',
      addressLine1: '123 rue Test',
      postalCode: '75001',
      city: 'Paris',
      country: 'France',
      jugglingEdgeUrl: 'https://www.jugglingedge.com/festival.php?FestID=1',
      currency: 'CHF',
    })

    await handler({ context: { user: mockUser } } as any)

    const { data } = prismaMock.edition.create.mock.calls[0][0]
    expect(data.jugglingEdgeUrl).toBe('https://www.jugglingedge.com/festival.php?FestID=1')
    expect(data.currency).toBe('CHF')
  })

  it('laisse la devise au défaut de la base quand elle n’est pas fournie', async () => {
    // `currency` porte `@default("EUR")` : écrire `undefined` dessus n'aurait pas d'effet
    // aujourd'hui, mais cesserait d'être anodin au premier défaut non nul.
    prismaMock.convention.findUnique.mockResolvedValue(mockConvention)
    prismaMock.edition.create.mockResolvedValue(mockEdition)
    global.readBody.mockResolvedValue({
      conventionId: 1,
      name: 'Edition 2024',
      startDate: '2024-06-01',
      endDate: '2024-06-03',
      addressLine1: '123 rue Test',
      postalCode: '75001',
      city: 'Paris',
      country: 'France',
    })

    await handler({ context: { user: mockUser } } as any)

    expect(prismaMock.edition.create.mock.calls[0][0].data).not.toHaveProperty('currency')
  })

  it('devrait gérer les erreurs de géocodage', async () => {
    mockGeocodeEdition.mockReset()
    mockGeocodeEdition.mockRejectedValue(new Error('Geocoding failed'))

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
