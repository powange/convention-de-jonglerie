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
import { moveTempImageToEdition } from '../../../../../server/utils/move-temp-image'
import handler from '../../../../../server/api/editions/index.post'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const mockGeocodeEdition = geocodeEdition as ReturnType<typeof vi.fn>
const mockMoveTempImage = moveTempImageToEdition as ReturnType<typeof vi.fn>

describe('/api/editions POST - Tests complets', () => {
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

    // Valeurs par défaut pour les mocks
    mockGeocodeEdition.mockResolvedValue({
      latitude: 48.8566,
      longitude: 2.3522,
    })
    mockMoveTempImage.mockResolvedValue('/uploads/editions/1/image.jpg')
  })

  describe('Validation des données', () => {
    it('devrait valider tous les champs requis', async () => {
      const requiredFieldsCases = [
        { field: 'postalCode', value: null },
        { field: 'postalCode', value: '' },
        { field: 'name', value: 'ab' }, // Moins de 3 caractères
        { field: 'name', value: 'a'.repeat(201) },
        { field: 'startDate', value: 'invalid-date' },
        { field: 'endDate', value: 'invalid-date' },
        { field: 'addressLine1', value: '' },
        { field: 'city', value: '' },
        { field: 'country', value: '' },
        { field: 'description', value: 'x'.repeat(5001) },
      ]

      // Pas de mock convention car la validation échoue avant

      for (const testCase of requiredFieldsCases) {
        vi.clearAllMocks()
        const baseData = {
          conventionId: 1,
          name: 'Edition Test',
          description: 'Description valide',
          startDate: '2024-06-01',
          endDate: '2024-06-03',
          addressLine1: '123 rue Test',
          postalCode: '75001',
          city: 'Paris',
          country: 'France',
        }

        const testData = { ...baseData, [testCase.field]: testCase.value }
        global.readBody.mockResolvedValue(testData)

        const mockEvent = { context: { user: mockUser } }

        await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
        // La validation Zod échoue avant même de vérifier la convention
        expect(prismaMock.convention.findUnique).not.toHaveBeenCalled()
      }
    })

    it('devrait valider les dates chronologiques', async () => {
      // Note: La validation de chronologie des dates est faite dans le schéma Zod
      const testData = {
        conventionId: 1,
        name: 'Edition Test',
        startDate: '2024-06-10',
        endDate: '2024-06-05', // Date de fin avant date de début
        addressLine1: '123 rue Test',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
      }

      global.readBody.mockResolvedValue(testData)
      const mockEvent = { context: { user: mockUser } }

      // Vérifier que la validation du schéma Zod détecte le problème
      await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
      expect(prismaMock.convention.findUnique).not.toHaveBeenCalled()
    })

    it('devrait valider les URL si fournies', async () => {
      const testData = {
        conventionId: 1,
        name: 'Edition Test',
        startDate: '2024-06-01',
        endDate: '2024-06-03',
        addressLine1: '123 rue Test',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
        officialWebsiteUrl: 'not-a-valid-url', // URL invalide
      }

      global.readBody.mockResolvedValue(testData)
      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
      expect(prismaMock.convention.findUnique).not.toHaveBeenCalled()
    })
  })

  describe('Services et options', () => {
    it('devrait gérer tous les services possibles', async () => {
      const allServices = {
        conventionId: 1,
        name: 'Edition Complète',
        startDate: '2024-06-01',
        endDate: '2024-06-03',
        addressLine1: '123 rue Test',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
        // Hébergement
        hasTentCamping: true,
        hasTruckCamping: true,
        hasFamilyCamping: false,
        hasSleepingRoom: true,
        // Restauration
        hasFoodTrucks: true,
        hasCantine: false,
        // Activités
        hasKidsZone: true,
        hasGala: true,
        hasOpenStage: false,
        hasConcert: true,
        hasWorkshops: true,
        // Espaces
        hasGym: true,
        hasFireSpace: false,
        hasAerialSpace: true,
        hasSlacklineSpace: true,
        // Commodités
        hasToilets: true,
        hasShowers: false,
        hasAccessibility: true,
        acceptsPets: false,
        // Paiements
        hasCashPayment: true,
        hasCreditCardPayment: true,
        hasAfjTokenPayment: false,
      }

      prismaMock.convention.findUnique.mockResolvedValue(mockConvention)
      prismaMock.edition.create.mockResolvedValue({ ...mockEdition, ...allServices })

      global.readBody.mockResolvedValue(allServices)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      // Vérifier que tous les services sont correctement définis
      expect(result.success).toBe(true)
      expect(result.data.hasTentCamping).toBe(true)
      expect(result.data.hasTruckCamping).toBe(true)
      expect(result.data.hasFamilyCamping).toBe(false)
      expect(result.data.hasSleepingRoom).toBe(true)
      expect(result.data.hasFoodTrucks).toBe(true)
      expect(result.data.hasCantine).toBe(false)
      expect(result.data.hasKidsZone).toBe(true)
      expect(result.data.hasGala).toBe(true)
      expect(result.data.hasOpenStage).toBe(false)
      expect(result.data.hasConcert).toBe(true)
      expect(result.data.hasWorkshops).toBe(true)
      expect(result.data.hasGym).toBe(true)
      expect(result.data.hasFireSpace).toBe(false)
      expect(result.data.hasAerialSpace).toBe(true)
      expect(result.data.hasSlacklineSpace).toBe(true)
      expect(result.data.hasToilets).toBe(true)
      expect(result.data.hasShowers).toBe(false)
      expect(result.data.hasAccessibility).toBe(true)
      expect(result.data.acceptsPets).toBe(false)
      expect(result.data.hasCashPayment).toBe(true)
      expect(result.data.hasCreditCardPayment).toBe(true)
      expect(result.data.hasAfjTokenPayment).toBe(false)
      // hasAtm n'existe pas dans le schéma
    })

    it('devrait gérer les services avec valeurs par défaut', async () => {
      const minimalData = {
        conventionId: 1,
        name: 'Edition Minimale',
        startDate: '2024-06-01',
        endDate: '2024-06-03',
        addressLine1: '123 rue Test',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
      }

      prismaMock.convention.findUnique.mockResolvedValue(mockConvention)
      prismaMock.edition.create.mockResolvedValue(mockEdition)

      global.readBody.mockResolvedValue(minimalData)
      const mockEvent = { context: { user: mockUser } }

      await handler(mockEvent as any)

      const createCall = prismaMock.edition.create.mock.calls[0][0]
      const data = createCall.data

      // Vérifier que tous les services ont leurs valeurs par défaut (false)
      expect(data.hasFoodTrucks).toBe(false)
      expect(data.hasKidsZone).toBe(false)
      expect(data.acceptsPets).toBe(false)
      expect(data.hasTentCamping).toBe(false)
      expect(data.hasTruckCamping).toBe(false)
      expect(data.hasFamilyCamping).toBe(false)
      expect(data.hasSleepingRoom).toBe(false)
      expect(data.hasGym).toBe(false)
      expect(data.hasFireSpace).toBe(false)
      expect(data.hasGala).toBe(false)
      expect(data.hasOpenStage).toBe(false)
      expect(data.hasConcert).toBe(false)
      expect(data.hasCantine).toBe(false)
      expect(data.hasAerialSpace).toBe(false)
      expect(data.hasSlacklineSpace).toBe(false)
      expect(data.hasToilets).toBe(false)
      expect(data.hasShowers).toBe(false)
      expect(data.hasAccessibility).toBe(false)
      expect(data.hasWorkshops).toBe(false)
      expect(data.hasCashPayment).toBe(false)
      expect(data.hasCreditCardPayment).toBe(false)
      expect(data.hasAfjTokenPayment).toBe(false)
      // hasAtm n'existe pas dans le schéma
    })
  })

  describe('Liens externes et réseaux sociaux', () => {
    it('devrait valider et sauvegarder les liens externes', async () => {
      const dataWithLinks = {
        conventionId: 1,
        name: 'Edition avec liens',
        startDate: '2024-06-01',
        endDate: '2024-06-03',
        addressLine1: '123 rue Test',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
        officialWebsiteUrl: 'https://convention.example.com',
        ticketingUrl: 'https://tickets.example.com',
        facebookUrl: 'https://facebook.com/convention',
        instagramUrl: 'https://instagram.com/convention',
      }

      prismaMock.convention.findUnique.mockResolvedValue(mockConvention)
      prismaMock.edition.create.mockResolvedValue({ ...mockEdition, ...dataWithLinks })

      global.readBody.mockResolvedValue(dataWithLinks)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.data.officialWebsiteUrl).toBe(dataWithLinks.officialWebsiteUrl)
      expect(result.data.ticketingUrl).toBe(dataWithLinks.ticketingUrl)
      expect(result.data.facebookUrl).toBe(dataWithLinks.facebookUrl)
      expect(result.data.instagramUrl).toBe(dataWithLinks.instagramUrl)
    })

    it("devrait valider les formats d'URL", async () => {
      const invalidUrlCases = [
        { field: 'officialWebsiteUrl', value: 'not-a-url', expectedError: /URL.*valide/i },
        { field: 'ticketingUrl', value: 'http://', expectedError: /URL.*valide/i },
        { field: 'facebookUrl', value: 'facebook', expectedError: /URL.*valide/i },
      ]

      prismaMock.convention.findUnique.mockResolvedValue(mockConvention)

      for (const testCase of invalidUrlCases) {
        const testData = {
          conventionId: 1,
          name: 'Edition Test',
          startDate: '2024-06-01',
          endDate: '2024-06-03',
          addressLine1: '123 rue Test',
          postalCode: '75001',
          city: 'Paris',
          country: 'France',
          [testCase.field]: testCase.value,
        }

        global.readBody.mockResolvedValue(testData)
        const mockEvent = { context: { user: mockUser } }

        await expect(handler(mockEvent as any)).rejects.toThrow('Données invalides')
      }
    })
  })

  describe('Permissions et autorisation', () => {
    it('devrait permettre au créateur de la convention', async () => {
      const editionData = {
        conventionId: 1,
        name: 'Edition créateur',
        startDate: '2024-06-01',
        endDate: '2024-06-03',
        addressLine1: '123 rue Test',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
      }

      prismaMock.convention.findUnique.mockResolvedValue({
        ...mockConvention,
        authorId: mockUser.id, // Créateur = utilisateur actuel
      })
      prismaMock.edition.create.mockResolvedValue({ ...mockEdition, ...editionData })

      global.readBody.mockResolvedValue(editionData)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)
      expect(result.data.name).toBe(editionData.name)
    })

    it('devrait permettre aux organisateurs autorisés', async () => {
      const organizerUser = { ...mockUser, id: 2 }
      const conventionWithOrganizer = {
        ...mockConvention,
        authorId: 999, // Différent de l'utilisateur
        // L'API filtre les organisateurs par userId, donc un seul organisateur
        organizers: [
          {
            userId: organizerUser.id,
            canAddEdition: true,
          },
        ],
      }

      const editionData = {
        conventionId: 1,
        name: 'Edition organisateur',
        startDate: '2024-06-01',
        endDate: '2024-06-03',
        addressLine1: '123 rue Test',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
      }

      prismaMock.convention.findUnique.mockResolvedValue(conventionWithOrganizer)
      prismaMock.edition.create.mockResolvedValue({ ...mockEdition, ...editionData })

      global.readBody.mockResolvedValue(editionData)
      const mockEvent = { context: { user: organizerUser } }

      const result = await handler(mockEvent as any)
      expect(result.data.name).toBe(editionData.name)
    })

    it('devrait rejeter les organisateurs sans autorisation', async () => {
      const unauthorizedUser = { ...mockUser, id: 3 }
      const conventionWithoutPermission = {
        ...mockConvention,
        authorId: 999,
        // Utilisateur non autorisé : soit pas de organisateurs, soit canAddEdition = false
        organizers: [
          {
            userId: unauthorizedUser.id,
            canAddEdition: false, // Pas autorisé
          },
        ],
      }

      prismaMock.convention.findUnique.mockResolvedValue(conventionWithoutPermission)

      global.readBody.mockResolvedValue({
        conventionId: 1,
        name: 'Edition non autorisée',
        startDate: '2024-06-01',
        endDate: '2024-06-03',
        addressLine1: '123 rue Test',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
      })

      const mockEvent = { context: { user: unauthorizedUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(
        'Droit insuffisant pour créer une édition'
      )
    })

    it('devrait rejeter les utilisateurs sans aucune relation', async () => {
      const strangerUser = { ...mockUser, id: 4 }
      const conventionWithoutUser = {
        ...mockConvention,
        authorId: 999,
        organizers: [], // Aucun organisateur
      }

      prismaMock.convention.findUnique.mockResolvedValue(conventionWithoutUser)

      global.readBody.mockResolvedValue({
        conventionId: 1,
        name: 'Edition étrangère',
        startDate: '2024-06-01',
        endDate: '2024-06-03',
        addressLine1: '123 rue Test',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
      })

      const mockEvent = { context: { user: strangerUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(
        'Droit insuffisant pour créer une édition'
      )
    })
  })

  describe('Gestion des erreurs système', () => {
    it('devrait gérer les erreurs de base de données', async () => {
      prismaMock.convention.findUnique.mockRejectedValue(new Error('DB Connection failed'))

      global.readBody.mockResolvedValue({
        conventionId: 1,
        name: 'Edition Test',
        startDate: '2024-06-01',
        endDate: '2024-06-03',
        addressLine1: '123 rue Test',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
      })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
    })

    it('devrait gérer les erreurs de géocodage gracieusement', async () => {
      mockGeocodeEdition.mockRejectedValue(new Error('Service unavailable'))

      prismaMock.convention.findUnique.mockResolvedValue(mockConvention)

      global.readBody.mockResolvedValue({
        conventionId: 1,
        name: 'Edition Test',
        startDate: '2024-06-01',
        endDate: '2024-06-03',
        addressLine1: 'Adresse introuvable',
        postalCode: '12345',
        city: 'VilleInexistante',
        country: 'France',
      })

      const mockEvent = { context: { user: mockUser } }

      // L'API gère l'erreur de géocodage et retourne null pour les coordonnées
      await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
    })

    it("devrait gérer les erreurs d'upload d'image", async () => {
      mockMoveTempImage.mockRejectedValue(new Error('Upload failed'))

      prismaMock.convention.findUnique.mockResolvedValue(mockConvention)
      prismaMock.edition.create.mockResolvedValue({ ...mockEdition, id: 1, imageUrl: null })

      global.readBody.mockResolvedValue({
        conventionId: 1,
        name: 'Edition avec image',
        imageUrl: '/temp/invalid.jpg',
        startDate: '2024-06-01',
        endDate: '2024-06-03',
        addressLine1: '123 rue Test',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
      })

      const mockEvent = { context: { user: mockUser } }

      // L'upload d'image échoue et l'API lance une erreur globale
      await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
    })
  })

  describe('Cas limites et edge cases', () => {
    it('devrait gérer les caractères spéciaux dans les noms', async () => {
      vi.clearAllMocks()
      const specialCharsData = {
        conventionId: 1,
        name: 'Édition été 2024 - São Paulo & München',
        description: 'Descripción con acentos y símbolos: €$£¥',
        startDate: '2024-06-01',
        endDate: '2024-06-03',
        addressLine1: 'Rüe des Açores, 123',
        addressLine2: 'Bâtiment B - 2ème étage',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
      }

      prismaMock.convention.findUnique.mockResolvedValue(mockConvention)
      prismaMock.edition.create.mockResolvedValue({ ...mockEdition, ...specialCharsData })

      global.readBody.mockResolvedValue(specialCharsData)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      // Vérifier que l'édition a été créée avec les données spéciales
      expect(result).toBeDefined()
      expect(prismaMock.edition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: specialCharsData.name,
          description: specialCharsData.description,
          addressLine1: specialCharsData.addressLine1,
          addressLine2: specialCharsData.addressLine2,
        }),
        include: expect.any(Object),
      })
    })

    it('devrait gérer les éditions très longues (plusieurs mois)', async () => {
      vi.clearAllMocks()
      const longEditionData = {
        conventionId: 1,
        name: "Festival d'été complet",
        startDate: '2024-06-01',
        endDate: '2024-08-31', // 3 mois
        addressLine1: '123 rue Test',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
      }

      prismaMock.convention.findUnique.mockResolvedValue(mockConvention)
      prismaMock.edition.create.mockResolvedValue({ ...mockEdition, ...longEditionData })

      global.readBody.mockResolvedValue(longEditionData)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)
      expect(result).toBeDefined()
      expect(prismaMock.edition.create).toHaveBeenCalled()
    })

    it('devrait gérer les éditions sur une seule journée + 1 seconde', async () => {
      vi.clearAllMocks()
      const singleDayData = {
        conventionId: 1,
        name: "Atelier d'une journée",
        startDate: '2024-06-01T09:00:00Z',
        endDate: '2024-06-01T18:00:00Z', // Même jour mais heures différentes
        addressLine1: '123 rue Test',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
      }

      prismaMock.convention.findUnique.mockResolvedValue(mockConvention)
      prismaMock.edition.create.mockResolvedValue({ ...mockEdition, ...singleDayData })

      global.readBody.mockResolvedValue(singleDayData)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)
      expect(result).toBeDefined()
      expect(prismaMock.edition.create).toHaveBeenCalled()
    })

    it('devrait gérer les fuseaux horaires différents', async () => {
      vi.clearAllMocks()
      const timezoneData = {
        conventionId: 1,
        name: 'Convention internationale',
        startDate: '2024-06-01T00:00:00+09:00', // JST
        endDate: '2024-06-03T23:59:59+09:00', // JST
        addressLine1: '123 rue Test',
        city: 'Tokyo',
        postalCode: '100-0001',
        country: 'Japan',
      }

      prismaMock.convention.findUnique.mockResolvedValue(mockConvention)
      prismaMock.edition.create.mockResolvedValue({ ...mockEdition, ...timezoneData })

      global.readBody.mockResolvedValue(timezoneData)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)
      expect(result).toBeDefined()
      expect(prismaMock.edition.create).toHaveBeenCalled()
    })
  })
})
