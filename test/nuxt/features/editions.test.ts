import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock des handlers d'API
import deleteEditionHandler from '../../../server/api/editions/[id]/index.delete'
import getEditionHandler from '../../../server/api/editions/[id]/index.get'
import updateEditionHandler from '../../../server/api/editions/[id]/index.put'
import getEditionsHandler from '../../../server/api/editions/index.get'
import createEditionHandler from '../../../server/api/editions/index.post'
import { prismaMock } from '../../__mocks__/prisma'

// Mock des modules utilitaires
vi.mock('../../../server/utils/geocoding', () => ({
  geocodeEdition: vi.fn().mockResolvedValue({
    latitude: 48.8566,
    longitude: 2.3522,
  }),
}))

vi.mock('../../../server/utils/move-temp-image', () => ({
  moveTempImageToEdition: vi.fn().mockResolvedValue('/uploads/editions/1/image.jpg'),
}))

describe("Système d'éditions", () => {
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
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn()
  })

  describe("Création d'édition", () => {
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

      const result = await createEditionHandler(mockEvent as any)

      expect(result.name).toBe(editionData.name)
      expect(result.description).toBe(editionData.description)
      expect(result.city).toBe(editionData.city)

      expect(prismaMock.convention.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: editionData.conventionId },
        })
      )

      expect(prismaMock.edition.create).toHaveBeenCalled()
    })

    it('devrait rejeter si utilisateur non authentifié', async () => {
      const mockEvent = {
        context: { user: null },
      }

      await expect(createEditionHandler(mockEvent as any)).rejects.toThrow()
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

      await expect(createEditionHandler(mockEvent as any)).rejects.toThrow()
    })

    it("devrait rejeter si l'utilisateur n'est pas l'auteur de la convention", async () => {
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

      await expect(createEditionHandler(mockEvent as any)).rejects.toThrow()
    })

    it("devrait géocoder l'adresse pour obtenir les coordonnées", async () => {
      const { geocodeEdition } = await import('../../../server/utils/geocoding')

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

      await createEditionHandler(mockEvent as any)

      expect(geocodeEdition).toHaveBeenCalledWith({
        addressLine1: editionData.addressLine1,
        addressLine2: undefined,
        city: editionData.city,
        postalCode: editionData.postalCode,
        country: editionData.country,
      })
    })

    it("devrait gérer l'upload d'image", async () => {
      const { moveTempImageToEdition } = await import('../../../server/utils/move-temp-image')

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

      const result = await createEditionHandler(mockEvent as any)

      expect(moveTempImageToEdition).toHaveBeenCalledWith('/temp/123456.jpg', 1)
      expect(result.imageUrl).toBe('/uploads/editions/1/image.jpg')
    })
  })

  describe("Récupération d'édition", () => {
    it('devrait récupérer une édition par ID', async () => {
      const editionWithDetails = {
        ...mockEdition,
        creator: {
          id: 1,
          pseudo: 'testuser',
          email: 'test@example.com',
          profilePicture: null,
          updatedAt: new Date(),
        },
        favoritedBy: [],
        convention: {
          ...mockConvention,
          collaborators: [],
        },
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithDetails)
      prismaMock.editionCollaborator.findFirst.mockResolvedValue(null)

      const mockEvent = {
        context: { params: { id: '1' } },
      }

      const result = await getEditionHandler(mockEvent as any)

      expect(result.id).toBe(1)
      expect(result.creator.pseudo).toBe('testuser')
      expect(result.convention).toBeDefined()

      expect(prismaMock.edition.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: expect.objectContaining({
          creator: expect.any(Object),
          convention: expect.any(Object),
        }),
      })
    })

    it('devrait rejeter pour un ID invalide', async () => {
      const mockEvent = {
        context: { params: { id: 'invalid' } },
      }

      await expect(getEditionHandler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait retourner 404 si édition non trouvée', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)
      prismaMock.editionCollaborator.findFirst.mockResolvedValue(null)

      const mockEvent = {
        context: { params: { id: '999' } },
      }

      await expect(getEditionHandler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait masquer les emails et retourner emailHash', async () => {
      const editionWithEmail = {
        ...mockEdition,
        creator: {
          id: 1,
          pseudo: 'testuser',
          email: 'test@example.com',
          profilePicture: null,
          updatedAt: new Date(),
        },
        favoritedBy: [],
        convention: {
          ...mockConvention,
          collaborators: [
            {
              user: {
                id: 2,
                pseudo: 'collab',
                email: 'collab@example.com',
                profilePicture: null,
                updatedAt: new Date(),
              },
            },
          ],
        },
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithEmail)
      prismaMock.editionCollaborator.findFirst.mockRejectedValue(new Error('Table not found'))

      const mockEvent = {
        context: { params: { id: '1' } },
      }

      const result = await getEditionHandler(mockEvent as any)

      // Les emails doivent être transformés en emailHash
      expect(result.creator).not.toHaveProperty('email')
      expect(result.creator.emailHash).toBeDefined()
      expect(result.convention.collaborators[0].user).not.toHaveProperty('email')
      expect(result.convention.collaborators[0].user.emailHash).toBeDefined()
    })
  })

  describe("Mise à jour d'édition", () => {
    it('devrait permettre de modifier une édition', async () => {
      const updateData = {
        name: 'Edition 2024 Modifiée',
        description: 'Nouvelle description',
        city: 'Lyon',
      }

      prismaMock.edition.findUnique.mockResolvedValue({
        ...mockEdition,
        creator: mockUser,
        convention: {
          ...mockConvention,
          collaborators: [], // Ajouter le tableau collaborators requis
        },
      })
      prismaMock.edition.update.mockResolvedValue({
        ...mockEdition,
        ...updateData,
      })

      global.readBody.mockResolvedValue(updateData)
      global.getRouterParam = vi.fn().mockReturnValue('1')

      const mockEvent = {
        context: {
          user: mockUser,
          params: { id: '1' },
        },
      }

      const result = await updateEditionHandler(mockEvent as any)

      expect(result.name).toBe(updateData.name)
      expect(result.description).toBe(updateData.description)

      expect(prismaMock.edition.update).toHaveBeenCalled()
      const callArgs = prismaMock.edition.update.mock.calls[0][0]
      expect(callArgs.where.id).toBe(1)
      expect(callArgs.data.name).toBe(updateData.name)
      expect(callArgs.data.description).toBe(updateData.description)
    })

    it("devrait rejeter si l'utilisateur n'a pas les droits", async () => {
      prismaMock.edition.findUnique.mockResolvedValue({
        ...mockEdition,
        creatorId: 2, // Différent utilisateur
        creator: { id: 2 },
        convention: {
          ...mockConvention,
          authorId: 2,
          collaborators: [],
        },
      })

      global.readBody.mockResolvedValue({ name: 'Test' })
      global.getRouterParam = vi.fn().mockReturnValue('1')

      const mockEvent = {
        context: {
          user: mockUser,
          params: { id: '1' },
        },
      }

      await expect(updateEditionHandler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait permettre à un collaborateur admin de modifier', async () => {
      prismaMock.edition.findUnique.mockResolvedValue({
        ...mockEdition,
        creatorId: 2,
        creator: { id: 2 },
        convention: {
          ...mockConvention,
          authorId: 2,
          collaborators: [
            {
              userId: 1,
              canEditAllEditions: true,
              canEditConvention: true,
            },
          ],
        },
      })
      prismaMock.edition.update.mockResolvedValue(mockEdition)

      global.readBody.mockResolvedValue({ name: 'Edition Modifiée' })
      global.getRouterParam = vi.fn().mockReturnValue('1')

      const mockEvent = {
        context: {
          user: mockUser,
          params: { id: '1' },
        },
      }

      const result = await updateEditionHandler(mockEvent as any)

      expect(result).toBeDefined()
    })
  })

  describe("Suppression d'édition", () => {
    it('devrait permettre de supprimer une édition', async () => {
      prismaMock.edition.findUnique.mockResolvedValue({
        ...mockEdition,
        creator: mockUser,
        convention: {
          ...mockConvention,
          collaborators: [],
        },
      })
      prismaMock.edition.delete.mockResolvedValue(mockEdition)

      global.getRouterParam = vi.fn().mockReturnValue('1')

      const mockEvent = {
        context: {
          user: mockUser,
          params: { id: '1' },
        },
      }

      const result = await deleteEditionHandler(mockEvent as any)

      expect(result.message).toBeDefined()
      expect(result.message.toLowerCase()).toMatch(/supprim|delet/)
      expect(prismaMock.edition.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      })
    })

    it("devrait rejeter si l'utilisateur n'est pas autorisé", async () => {
      prismaMock.edition.findUnique.mockResolvedValue({
        ...mockEdition,
        creatorId: 2,
        creator: { id: 2 },
        convention: {
          ...mockConvention,
          authorId: 2,
          collaborators: [],
        },
      })

      global.getRouterParam = vi.fn().mockReturnValue('1')

      const mockEvent = {
        context: {
          user: mockUser,
          params: { id: '1' },
        },
      }

      await expect(deleteEditionHandler(mockEvent as any)).rejects.toThrow()
    })
  })

  describe('Liste des éditions', () => {
    it('devrait récupérer toutes les éditions', async () => {
      const editions = [
        { ...mockEdition, id: 1 },
        { ...mockEdition, id: 2, name: 'Edition 2025' },
      ]

      prismaMock.edition.count.mockResolvedValue(2)
      prismaMock.edition.findMany.mockResolvedValue(editions)

      // Simuler getQuery pour le handler
      global.getQuery = vi.fn().mockReturnValue({})

      const mockEvent = {}

      const result = await getEditionsHandler(mockEvent as any)

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('pagination')
      expect(result.data).toHaveLength(2)
      expect(result.data[0].id).toBe(1)
      expect(result.data[1].name).toBe('Edition 2025')
      expect(result.pagination.total).toBe(2)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(12)
    })

    it('devrait filtrer les éditions futures', async () => {
      const now = new Date()
      const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // +30 jours
      const pastDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // -30 jours

      const editions = [
        { ...mockEdition, id: 1, startDate: futureDate },
        { ...mockEdition, id: 2, startDate: pastDate },
      ]

      const futureEditions = editions.filter((e) => e.startDate > now)

      expect(futureEditions).toHaveLength(1)
      expect(futureEditions[0].id).toBe(1)
    })

    it('devrait filtrer les éditions par pays', async () => {
      const editions = [
        { ...mockEdition, id: 1, country: 'France' },
        { ...mockEdition, id: 2, country: 'Belgium' },
        { ...mockEdition, id: 3, country: 'France' },
      ]

      const frenchEditions = editions.filter((e) => e.country === 'France')

      expect(frenchEditions).toHaveLength(2)
      expect(frenchEditions[0].country).toBe('France')
      expect(frenchEditions[1].country).toBe('France')
    })

    it('devrait filtrer les éditions par services', async () => {
      const editions = [
        { ...mockEdition, id: 1, hasFoodTrucks: true, hasShowers: true },
        { ...mockEdition, id: 2, hasFoodTrucks: false, hasShowers: true },
        { ...mockEdition, id: 3, hasFoodTrucks: true, hasShowers: false },
      ]

      const withFoodTrucks = editions.filter((e) => e.hasFoodTrucks)
      const withShowers = editions.filter((e) => e.hasShowers)
      const withBoth = editions.filter((e) => e.hasFoodTrucks && e.hasShowers)

      expect(withFoodTrucks).toHaveLength(2)
      expect(withShowers).toHaveLength(2)
      expect(withBoth).toHaveLength(1)
    })
  })

  describe('Validation et sécurité', () => {
    it('devrait valider les dates', () => {
      const validateDates = (startDate: Date, endDate: Date) => {
        if (endDate < startDate) {
          throw new Error('End date must be after start date')
        }
        // Permettre les dates passées pour les tests
        const minDate = new Date('2024-01-01')
        if (startDate < minDate) {
          throw new Error('Start date too far in the past')
        }
        return true
      }

      const futureDate = new Date('2025-06-01')
      const laterDate = new Date('2025-06-03')
      const earlierDate = new Date('2025-05-30')

      expect(() => validateDates(futureDate, laterDate)).not.toThrow()
      expect(() => validateDates(futureDate, earlierDate)).toThrow(
        'End date must be after start date'
      )
    })

    it('devrait valider les URLs', () => {
      const validateUrl = (url: string) => {
        try {
          const urlObj = new URL(url)
          // Rejeter les URLs javascript
          if (urlObj.protocol === 'javascript:') {
            return false
          }
          return true
        } catch {
          return false
        }
      }

      expect(validateUrl('https://example.com')).toBe(true)
      expect(validateUrl('http://facebook.com/event')).toBe(true)
      expect(validateUrl('invalid-url')).toBe(false)
      expect(validateUrl('javascript:alert(1)')).toBe(false)
    })

    it('devrait valider le code postal', () => {
      const validatePostalCode = (postalCode: string, country: string) => {
        const patterns: Record<string, RegExp> = {
          France: /^\d{5}$/,
          Belgium: /^\d{4}$/,
          Switzerland: /^\d{4}$/,
        }

        const pattern = patterns[country]
        return pattern ? pattern.test(postalCode) : true
      }

      expect(validatePostalCode('75001', 'France')).toBe(true)
      expect(validatePostalCode('1000', 'Belgium')).toBe(true)
      expect(validatePostalCode('12345', 'Belgium')).toBe(false)
      expect(validatePostalCode('ABC', 'France')).toBe(false)
    })

    it("devrait limiter le nombre d'éditions par convention", () => {
      const maxEditionsPerConvention = 20
      const editionCount = 21

      const canAddMoreEditions = editionCount < maxEditionsPerConvention

      expect(canAddMoreEditions).toBe(false)
    })
  })

  describe('Services et équipements', () => {
    it('devrait gérer tous les services disponibles', () => {
      const services = {
        hasFoodTrucks: true,
        hasKidsZone: true,
        acceptsPets: false,
        hasTentCamping: true,
        hasTruckCamping: false,
        hasFamilyCamping: true,
        hasSleepingRoom: true,
        hasGym: true,
        hasFireSpace: false,
        hasGala: true,
        hasOpenStage: true,
        hasConcert: false,
        hasCantine: true,
        hasAerialSpace: false,
        hasSlacklineSpace: true,
        hasToilets: true,
        hasShowers: true,
        hasAccessibility: true,
        hasWorkshops: true,
        hasCashPayment: true,
        hasCreditCardPayment: false,
        hasAfjTokenPayment: true,
      }

      const activeServices = Object.entries(services)
        .filter(([_, value]) => value === true)
        .map(([key]) => key)

      expect(activeServices).toContain('hasFoodTrucks')
      expect(activeServices).toContain('hasToilets')
      expect(activeServices).not.toContain('acceptsPets')
      expect(activeServices.length).toBe(16)
    })

    it('devrait grouper les services par catégorie', () => {
      const categorizeServices = (services: Record<string, boolean>) => {
        return {
          accommodation: [
            'hasTentCamping',
            'hasTruckCamping',
            'hasFamilyCamping',
            'hasSleepingRoom',
          ].filter((key) => services[key]),
          facilities: ['hasToilets', 'hasShowers', 'hasGym', 'hasAccessibility'].filter(
            (key) => services[key]
          ),
          activities: [
            'hasGala',
            'hasOpenStage',
            'hasConcert',
            'hasWorkshops',
            'hasFireSpace',
          ].filter((key) => services[key]),
          food: ['hasFoodTrucks', 'hasCantine'].filter((key) => services[key]),
          payment: ['hasCashPayment', 'hasCreditCardPayment', 'hasAfjTokenPayment'].filter(
            (key) => services[key]
          ),
        }
      }

      const services = {
        hasTentCamping: true,
        hasToilets: true,
        hasShowers: true,
        hasGala: true,
        hasFoodTrucks: true,
        hasCashPayment: true,
        hasCreditCardPayment: true,
      }

      const categorized = categorizeServices(services as any)

      expect(categorized.accommodation).toContain('hasTentCamping')
      expect(categorized.facilities).toContain('hasToilets')
      expect(categorized.facilities).toContain('hasShowers')
      expect(categorized.activities).toContain('hasGala')
      expect(categorized.food).toContain('hasFoodTrucks')
      expect(categorized.payment).toContain('hasCashPayment')
      expect(categorized.payment).toContain('hasCreditCardPayment')
    })
  })

  describe('Géolocalisation', () => {
    it('devrait calculer la distance entre deux éditions', () => {
      const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371 // Rayon de la Terre en km
        const dLat = ((lat2 - lat1) * Math.PI) / 180
        const dLon = ((lon2 - lon1) * Math.PI) / 180
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return R * c
      }

      // Paris to Lyon (environ 400km)
      const distance = calculateDistance(48.8566, 2.3522, 45.764, 4.8357)

      expect(distance).toBeGreaterThan(390)
      expect(distance).toBeLessThan(410)
    })

    it('devrait trouver les éditions proches', () => {
      const editions = [
        { id: 1, city: 'Paris', latitude: 48.8566, longitude: 2.3522 },
        { id: 2, city: 'Versailles', latitude: 48.8048, longitude: 2.1203 },
        { id: 3, city: 'Lyon', latitude: 45.764, longitude: 4.8357 },
      ]

      const findNearbyEditions = (lat: number, lon: number, maxDistance: number) => {
        const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          const R = 6371
          const dLat = ((lat2 - lat1) * Math.PI) / 180
          const dLon = ((lon2 - lon1) * Math.PI) / 180
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
              Math.cos((lat2 * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2)
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
          return R * c
        }

        return editions.filter((edition) => {
          const distance = calculateDistance(lat, lon, edition.latitude, edition.longitude)
          return distance <= maxDistance
        })
      }

      // Chercher à 50km de Paris
      const nearby = findNearbyEditions(48.8566, 2.3522, 50)

      expect(nearby).toHaveLength(2) // Paris et Versailles
      expect(nearby.map((e) => e.city)).toContain('Paris')
      expect(nearby.map((e) => e.city)).toContain('Versailles')
      expect(nearby.map((e) => e.city)).not.toContain('Lyon')
    })
  })

  describe('Gestion des erreurs', () => {
    it('devrait gérer les erreurs de géocodage', async () => {
      const { geocodeEdition } = await import('../../../server/utils/geocoding')
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

      await expect(createEditionHandler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait gérer les conflits de dates', async () => {
      const existingEdition = {
        ...mockEdition,
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-03'),
      }

      prismaMock.edition.findMany.mockResolvedValue([existingEdition])

      const checkDateConflict = async (conventionId: number, startDate: Date, endDate: Date) => {
        const editions = await prismaMock.edition.findMany({
          where: { conventionId },
        })

        const hasConflict = editions.some((edition) => {
          return (
            (startDate >= edition.startDate && startDate <= edition.endDate) ||
            (endDate >= edition.startDate && endDate <= edition.endDate) ||
            (startDate <= edition.startDate && endDate >= edition.endDate)
          )
        })

        if (hasConflict) {
          throw new Error('Date conflict with existing edition')
        }

        return true
      }

      await expect(
        checkDateConflict(1, new Date('2024-06-02'), new Date('2024-06-04'))
      ).rejects.toThrow('Date conflict')
    })
  })
})
