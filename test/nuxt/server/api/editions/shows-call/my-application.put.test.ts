import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../server/api/editions/[id]/shows-call/[showCallId]/my-application.put'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('/api/editions/[id]/shows-call/[showCallId]/my-application PUT', () => {
  const mockUser = {
    id: 1,
    email: 'artist@example.com',
    pseudo: 'testartist',
    nom: 'Test',
    prenom: 'Artist',
    isArtist: true,
  }

  const mockShowCall = {
    id: 1,
    editionId: 1,
    name: 'Appel à spectacles principal',
    isOpen: true,
    mode: 'INTERNAL',
    externalUrl: null,
    description: "Description de l'appel",
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Dans 7 jours
    askPortfolioUrl: true,
    askVideoUrl: true,
    askTechnicalNeeds: true,
    askAccommodation: true,
    askDepartureCity: false,
  }

  const mockExistingApplication = {
    id: 1,
    showCallId: 1,
    userId: 1,
    status: 'PENDING',
    artistName: 'Artiste Test',
    artistBio: "Bio de l'artiste",
    portfolioUrl: 'https://example.com/portfolio',
    videoUrl: 'https://youtube.com/watch?v=123',
    showTitle: 'Mon Spectacle',
    showDescription: 'Description du spectacle',
    showDuration: 30,
    showCategory: 'Jonglage',
    technicalNeeds: 'Besoins techniques',
    accommodationNeeded: true,
    accommodationNotes: 'Notes hébergement',
    additionalPerformersCount: 0,
    additionalPerformers: null,
    departureCity: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const validUpdateData = {
    lastName: 'Nom',
    firstName: 'Prénom',
    phone: '+33123456789',
    artistName: 'Artiste Modifié',
    artistBio: 'Nouvelle bio',
    portfolioUrl: 'https://example.com/new-portfolio',
    videoUrl: 'https://youtube.com/watch?v=456',
    showTitle: 'Mon Nouveau Spectacle',
    showDescription: 'Nouvelle description du spectacle',
    showDuration: 45,
    showCategory: 'Magie',
    technicalNeeds: 'Nouveaux besoins',
    accommodationNeeded: false,
    accommodationNotes: null,
    departureCity: 'Paris',
    additionalPerformersCount: 0,
    additionalPerformers: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn()
    global.getRouterParam = vi.fn()
  })

  describe('Validation des permissions', () => {
    it('devrait rejeter les utilisateurs non connectés', async () => {
      global.getRouterParam.mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showCallId') return '1'
        return null
      })

      const mockEvent = { context: { user: null } }

      await expect(handler(mockEvent as any)).rejects.toThrow('Unauthorized')
    })
  })

  describe('Modification de candidature', () => {
    beforeEach(() => {
      global.getRouterParam.mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showCallId') return '1'
        return null
      })

      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
      prismaMock.showApplication.findUnique.mockResolvedValue(mockExistingApplication)
    })

    it('devrait modifier une candidature avec succès', async () => {
      const updatedApplication = {
        ...mockExistingApplication,
        ...validUpdateData,
        user: {
          id: 1,
          pseudo: 'testartist',
          emailHash: 'hash123',
          profilePicture: null,
        },
      }

      prismaMock.user.update.mockResolvedValue(mockUser)
      prismaMock.showApplication.update.mockResolvedValue(updatedApplication)

      global.readBody.mockResolvedValue(validUpdateData)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.application).toBeDefined()
      expect(result.application.artistName).toBe('Artiste Modifié')
      expect(result.application.showTitle).toBe('Mon Nouveau Spectacle')
      expect(result.application.showDuration).toBe(45)

      // Vérifier que le profil utilisateur a été mis à jour
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          nom: 'Nom',
          prenom: 'Prénom',
          phone: '+33123456789',
        },
      })
    })

    it('devrait modifier une candidature avec des personnes supplémentaires', async () => {
      const updateDataWithPerformers = {
        ...validUpdateData,
        additionalPerformersCount: 2,
        additionalPerformers: [
          {
            lastName: 'Dupont',
            firstName: 'Jean',
            email: 'jean@example.com',
            phone: '+33111111111',
          },
          {
            lastName: 'Martin',
            firstName: 'Marie',
            email: 'marie@example.com',
            phone: '+33222222222',
          },
        ],
      }

      const updatedApplication = {
        ...mockExistingApplication,
        ...updateDataWithPerformers,
        user: {
          id: 1,
          pseudo: 'testartist',
          emailHash: 'hash123',
          profilePicture: null,
        },
      }

      prismaMock.user.update.mockResolvedValue(mockUser)
      prismaMock.showApplication.update.mockResolvedValue(updatedApplication)

      global.readBody.mockResolvedValue(updateDataWithPerformers)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.application.additionalPerformersCount).toBe(2)
      expect(result.application.additionalPerformers).toHaveLength(2)
    })
  })

  describe('Validation des conditions de modification', () => {
    beforeEach(() => {
      global.getRouterParam.mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showCallId') return '1'
        return null
      })

      global.readBody.mockResolvedValue(validUpdateData)
    })

    it("devrait rejeter si l'appel n'existe pas", async () => {
      prismaMock.editionShowCall.findFirst.mockResolvedValue(null)

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/non trouvé/i)
    })

    it("devrait rejeter si la candidature n'existe pas", async () => {
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
      prismaMock.showApplication.findUnique.mockResolvedValue(null)

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/non trouvée/i)
    })

    it("devrait rejeter si la candidature n'est pas en attente", async () => {
      const acceptedApplication = { ...mockExistingApplication, status: 'ACCEPTED' }
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
      prismaMock.showApplication.findUnique.mockResolvedValue(acceptedApplication)

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/en attente/i)
    })

    it('devrait rejeter si la candidature a été rejetée', async () => {
      const rejectedApplication = { ...mockExistingApplication, status: 'REJECTED' }
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
      prismaMock.showApplication.findUnique.mockResolvedValue(rejectedApplication)

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/en attente/i)
    })

    it("devrait rejeter si l'appel est fermé", async () => {
      const closedShowCall = { ...mockShowCall, isOpen: false }
      prismaMock.editionShowCall.findFirst.mockResolvedValue(closedShowCall)
      prismaMock.showApplication.findUnique.mockResolvedValue(mockExistingApplication)

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/n'est plus ouvert/i)
    })

    it('devrait rejeter si la date limite est dépassée', async () => {
      const expiredShowCall = {
        ...mockShowCall,
        deadline: new Date(Date.now() - 24 * 60 * 60 * 1000), // Hier
      }
      prismaMock.editionShowCall.findFirst.mockResolvedValue(expiredShowCall)
      prismaMock.showApplication.findUnique.mockResolvedValue(mockExistingApplication)

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/date limite.*dépassée/i)
    })

    it('devrait accepter une modification si pas de date limite', async () => {
      const showCallNoDeadline = { ...mockShowCall, deadline: null }
      prismaMock.editionShowCall.findFirst.mockResolvedValue(showCallNoDeadline)
      prismaMock.showApplication.findUnique.mockResolvedValue(mockExistingApplication)
      prismaMock.user.update.mockResolvedValue(mockUser)
      prismaMock.showApplication.update.mockResolvedValue({
        ...mockExistingApplication,
        ...validUpdateData,
        user: { id: 1, pseudo: 'testartist', emailHash: 'hash', profilePicture: null },
      })

      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
    })
  })

  describe('Validation des données', () => {
    beforeEach(() => {
      global.getRouterParam.mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showCallId') return '1'
        return null
      })

      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
      prismaMock.showApplication.findUnique.mockResolvedValue(mockExistingApplication)
    })

    it("devrait rejeter si le nom de l'artiste est manquant", async () => {
      const invalidData = { ...validUpdateData, artistName: '' }
      global.readBody.mockResolvedValue(invalidData)

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait rejeter si le titre du spectacle est trop court', async () => {
      const invalidData = { ...validUpdateData, showTitle: 'AB' }
      global.readBody.mockResolvedValue(invalidData)

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait rejeter si la durée est invalide', async () => {
      const invalidData = { ...validUpdateData, showDuration: -5 }
      global.readBody.mockResolvedValue(invalidData)

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait rejeter si la durée dépasse 180 minutes', async () => {
      const invalidData = { ...validUpdateData, showDuration: 200 }
      global.readBody.mockResolvedValue(invalidData)

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait rejeter si le nombre de personnes supplémentaires ne correspond pas', async () => {
      const invalidData = {
        ...validUpdateData,
        additionalPerformersCount: 2,
        additionalPerformers: [
          {
            lastName: 'Dupont',
            firstName: 'Jean',
            email: 'jean@example.com',
            phone: '+33111111111',
          },
          // Manque une personne
        ],
      }
      global.readBody.mockResolvedValue(invalidData)

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })
  })

  describe('Gestion des erreurs', () => {
    it('devrait rejeter un showCallId invalide', async () => {
      global.getRouterParam.mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showCallId') return 'invalid'
        return null
      })

      global.readBody.mockResolvedValue(validUpdateData)
      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/invalide/i)
    })

    it('devrait gérer les erreurs de base de données', async () => {
      global.getRouterParam.mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showCallId') return '1'
        return null
      })

      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
      prismaMock.showApplication.findUnique.mockResolvedValue(mockExistingApplication)
      prismaMock.user.update.mockResolvedValue(mockUser)
      prismaMock.showApplication.update.mockRejectedValue(new Error('Database error'))

      global.readBody.mockResolvedValue(validUpdateData)
      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })
  })
})
