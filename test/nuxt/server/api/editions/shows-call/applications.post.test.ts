import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../server/api/editions/[id]/shows-call/[showCallId]/applications/index.post'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('/api/editions/[id]/shows-call/[showCallId]/applications POST', () => {
  const mockUser = {
    id: 1,
    email: 'artist@example.com',
    pseudo: 'testartist',
    nom: 'Test',
    prenom: 'Artist',
    isArtist: true,
  }

  const mockUserNotArtist = {
    id: 2,
    email: 'user@example.com',
    pseudo: 'testuser',
    nom: 'Test',
    prenom: 'User',
    isArtist: false,
  }

  const mockEdition = {
    id: 1,
    name: 'Convention Test 2024',
    status: 'PUBLISHED',
  }

  const mockShowCall = {
    id: 1,
    editionId: 1,
    name: 'Appel à spectacles principal',
    visibility: 'PUBLIC',
    mode: 'INTERNAL',
    externalUrl: null,
    description: "Description de l'appel",
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Dans 7 jours
    askPortfolioUrl: true,
    askVideoUrl: true,
    askTechnicalNeeds: true,
    askAccommodation: true,
  }

  const mockApplication = {
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
    additionalPerformersCount: 0,
    additionalPerformers: null,
    accommodationNeeded: true,
    accommodationNotes: 'Notes hébergement',
    departureCity: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: 1,
      pseudo: 'testartist',
      emailHash: 'hash123',
      profilePicture: null,
    },
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

    it('devrait rejeter les utilisateurs non artistes', async () => {
      global.getRouterParam.mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showCallId') return '1'
        return null
      })

      prismaMock.user.findUnique.mockResolvedValue(mockUserNotArtist)

      global.readBody.mockResolvedValue({
        artistName: 'Test',
        showTitle: 'Spectacle',
        showDescription: 'Description',
        showDuration: 30,
      })

      const mockEvent = { context: { user: mockUserNotArtist } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/catégorie.*Artiste/i)
    })
  })

  describe('Candidature valide', () => {
    beforeEach(() => {
      global.getRouterParam.mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showCallId') return '1'
        return null
      })

      prismaMock.user.findUnique.mockResolvedValue(mockUser)
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
      prismaMock.showApplication.findUnique.mockResolvedValue(null) // Pas de candidature existante
      prismaMock.convention.findFirst.mockResolvedValue(null)
      prismaMock.editionOrganizerPermission.findMany.mockResolvedValue([])
    })

    it('devrait créer une candidature avec succès', async () => {
      const applicationData = {
        lastName: 'Dupont',
        firstName: 'Jean',
        phone: '+33612345678',
        artistName: 'Artiste Test',
        artistBio: "Bio de l'artiste",
        portfolioUrl: 'https://example.com/portfolio',
        videoUrl: 'https://youtube.com/watch?v=123',
        showTitle: 'Mon Spectacle',
        showDescription: 'Description du spectacle avec suffisamment de caractères',
        showDuration: 30,
        showCategory: 'Jonglage',
        technicalNeeds: 'Besoins techniques',
        accommodationNeeded: true,
        accommodationNotes: 'Notes hébergement',
        contactPhone: '+33123456789',
        additionalPerformersCount: 0,
      }

      prismaMock.showApplication.create.mockResolvedValue(mockApplication)

      global.readBody.mockResolvedValue(applicationData)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.application).toBeDefined()
      expect(result.application.artistName).toBe('Artiste Test')
      expect(result.application.showTitle).toBe('Mon Spectacle')

      expect(prismaMock.showApplication.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          showCallId: 1,
          userId: mockUser.id,
          status: 'PENDING',
          artistName: 'Artiste Test',
          showTitle: 'Mon Spectacle',
          showDuration: 30,
        }),
        include: expect.objectContaining({
          user: expect.any(Object),
        }),
      })
    })

    it('devrait créer une candidature avec socialLinks', async () => {
      const applicationData = {
        lastName: 'Dupont',
        firstName: 'Jean',
        phone: '+33612345678',
        artistName: 'Artiste Social',
        showTitle: 'Spectacle Social',
        showDescription: 'Description du spectacle avec suffisamment de caractères',
        showDuration: 25,
        additionalPerformersCount: 0,
        socialLinks: 'https://instagram.com/artist\nhttps://youtube.com/@artist',
      }

      prismaMock.user.update.mockResolvedValue(mockUser)
      prismaMock.showApplication.create.mockResolvedValue({
        ...mockApplication,
        artistName: 'Artiste Social',
        showTitle: 'Spectacle Social',
        socialLinks: 'https://instagram.com/artist\nhttps://youtube.com/@artist',
      })

      global.readBody.mockResolvedValue(applicationData)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(prismaMock.showApplication.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          artistName: 'Artiste Social',
          showTitle: 'Spectacle Social',
          socialLinks: 'https://instagram.com/artist\nhttps://youtube.com/@artist',
        }),
        include: expect.any(Object),
      })
    })

    it('devrait créer une candidature minimale sans champs optionnels', async () => {
      const minimalData = {
        lastName: 'Simple',
        firstName: 'Artiste',
        phone: '+33612345678',
        artistName: 'Artiste Simple',
        showTitle: 'Spectacle Simple',
        showDescription: 'Description minimale du spectacle avec suffisamment de caractères',
        showDuration: 15,
        additionalPerformersCount: 0,
      }

      prismaMock.showApplication.create.mockResolvedValue({
        ...mockApplication,
        artistName: 'Artiste Simple',
        showTitle: 'Spectacle Simple',
        showDescription: 'Description minimale du spectacle avec suffisamment de caractères',
        showDuration: 15,
        artistBio: null,
        portfolioUrl: null,
        videoUrl: null,
        socialLinks: null,
        showCategory: null,
        technicalNeeds: null,
        accommodationNeeded: false,
        accommodationNotes: null,
        contactPhone: null,
      })

      global.readBody.mockResolvedValue(minimalData)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(prismaMock.showApplication.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          artistName: 'Artiste Simple',
          showTitle: 'Spectacle Simple',
          showDescription: 'Description minimale du spectacle avec suffisamment de caractères',
          showDuration: 15,
          artistBio: null,
          portfolioUrl: null,
          videoUrl: null,
        }),
        include: expect.any(Object),
      })
    })
  })

  describe("Validation de l'appel à spectacles", () => {
    beforeEach(() => {
      global.getRouterParam.mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showCallId') return '1'
        return null
      })

      prismaMock.user.findUnique.mockResolvedValue(mockUser)
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.convention.findFirst.mockResolvedValue(null)
      prismaMock.editionOrganizerPermission.findMany.mockResolvedValue([])
    })

    it("devrait rejeter si l'appel est fermé", async () => {
      const closedShowCall = { ...mockShowCall, visibility: 'CLOSED' }
      prismaMock.editionShowCall.findFirst.mockResolvedValue(closedShowCall)

      global.readBody.mockResolvedValue({
        artistName: 'Test',
        showTitle: 'Spectacle',
        showDescription: 'Description',
        showDuration: 30,
      })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/n'est pas ouvert/i)
    })

    it('devrait rejeter si le mode est externe', async () => {
      const externalShowCall = {
        ...mockShowCall,
        mode: 'EXTERNAL',
        externalUrl: 'https://external-form.com',
      }
      prismaMock.editionShowCall.findFirst.mockResolvedValue(externalShowCall)

      global.readBody.mockResolvedValue({
        artistName: 'Test',
        showTitle: 'Spectacle',
        showDescription: 'Description',
        showDuration: 30,
      })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/formulaire externe/i)
    })

    it('devrait rejeter si la date limite est dépassée', async () => {
      const expiredShowCall = {
        ...mockShowCall,
        deadline: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Hier
      }
      prismaMock.editionShowCall.findFirst.mockResolvedValue(expiredShowCall)

      global.readBody.mockResolvedValue({
        artistName: 'Test',
        showTitle: 'Spectacle',
        showDescription: 'Description',
        showDuration: 30,
      })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/date limite.*dépassée/i)
    })

    it('devrait accepter une candidature sans date limite', async () => {
      const showCallWithoutDeadline = { ...mockShowCall, deadline: null }
      prismaMock.editionShowCall.findFirst.mockResolvedValue(showCallWithoutDeadline)
      prismaMock.showApplication.findUnique.mockResolvedValue(null)
      prismaMock.showApplication.create.mockResolvedValue(mockApplication)

      global.readBody.mockResolvedValue({
        lastName: 'Dupont',
        firstName: 'Test',
        phone: '+33612345678',
        artistName: 'Test',
        showTitle: 'Spectacle',
        showDescription: 'Description du spectacle avec au moins 20 caractères',
        showDuration: 30,
        additionalPerformersCount: 0,
      })

      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)
      expect(result.success).toBe(true)
    })
  })

  describe('Gestion des candidatures existantes', () => {
    beforeEach(() => {
      global.getRouterParam.mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showCallId') return '1'
        return null
      })

      prismaMock.user.findUnique.mockResolvedValue(mockUser)
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
    })

    it("devrait rejeter si l'utilisateur a déjà candidaté", async () => {
      const existingApplication = { ...mockApplication, status: 'PENDING' }
      prismaMock.showApplication.findUnique.mockResolvedValue(existingApplication)

      global.readBody.mockResolvedValue({
        artistName: 'Test',
        showTitle: 'Spectacle',
        showDescription: 'Description',
        showDuration: 30,
      })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/déjà soumis/i)
    })

    it('devrait rejeter même si la candidature précédente était rejetée', async () => {
      const rejectedApplication = { ...mockApplication, status: 'REJECTED' }
      prismaMock.showApplication.findUnique.mockResolvedValue(rejectedApplication)

      global.readBody.mockResolvedValue({
        artistName: 'Test',
        showTitle: 'Spectacle',
        showDescription: 'Description',
        showDuration: 30,
      })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/déjà soumis/i)
    })
  })

  describe('Validation des données', () => {
    beforeEach(() => {
      global.getRouterParam.mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showCallId') return '1'
        return null
      })

      prismaMock.user.findUnique.mockResolvedValue(mockUser)
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
      prismaMock.showApplication.findUnique.mockResolvedValue(null)
    })

    it("devrait rejeter si le nom de l'artiste est manquant", async () => {
      global.readBody.mockResolvedValue({
        showTitle: 'Spectacle',
        showDescription: 'Description',
        showDuration: 30,
      })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait rejeter si le titre du spectacle est manquant', async () => {
      global.readBody.mockResolvedValue({
        artistName: 'Artiste',
        showDescription: 'Description',
        showDuration: 30,
      })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait rejeter si la durée est invalide', async () => {
      global.readBody.mockResolvedValue({
        artistName: 'Artiste',
        showTitle: 'Spectacle',
        showDescription: 'Description',
        showDuration: -5, // Durée négative
      })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait rejeter si la durée est trop longue', async () => {
      global.readBody.mockResolvedValue({
        artistName: 'Artiste',
        showTitle: 'Spectacle',
        showDescription: 'Description',
        showDuration: 200, // Plus de 180 minutes (3h max)
      })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })
  })

  describe('Gestion des erreurs', () => {
    beforeEach(() => {
      global.getRouterParam.mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showCallId') return '1'
        return null
      })
    })

    it("devrait gérer l'édition inexistante", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser)
      prismaMock.edition.findUnique.mockResolvedValue(null)

      global.readBody.mockResolvedValue({
        artistName: 'Test',
        showTitle: 'Spectacle',
        showDescription: 'Description',
        showDuration: 30,
      })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/non trouvée/i)
    })

    it("devrait gérer l'appel à spectacles inexistant", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser)
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(null)

      global.readBody.mockResolvedValue({
        artistName: 'Test',
        showTitle: 'Spectacle',
        showDescription: 'Description',
        showDuration: 30,
      })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/non trouvé/i)
    })

    it('devrait gérer les erreurs de base de données', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser)
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
      prismaMock.showApplication.findUnique.mockResolvedValue(null)
      prismaMock.showApplication.create.mockRejectedValue(new Error('Database error'))

      global.readBody.mockResolvedValue({
        artistName: 'Test',
        showTitle: 'Spectacle',
        showDescription: 'Description',
        showDuration: 30,
      })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait rejeter un ID de showCallId invalide', async () => {
      global.getRouterParam.mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showCallId') return 'invalid'
        return null
      })

      prismaMock.user.findUnique.mockResolvedValue(mockUser)

      global.readBody.mockResolvedValue({
        artistName: 'Test',
        showTitle: 'Spectacle',
        showDescription: 'Description',
        showDuration: 30,
      })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/invalide/i)
    })
  })

  describe('Validation des personnes supplémentaires', () => {
    beforeEach(() => {
      global.getRouterParam.mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showCallId') return '1'
        return null
      })

      prismaMock.user.findUnique.mockResolvedValue(mockUser)
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
      prismaMock.showApplication.findUnique.mockResolvedValue(null)
      prismaMock.convention.findFirst.mockResolvedValue(null)
      prismaMock.editionOrganizerPermission.findMany.mockResolvedValue([])
    })

    it('devrait accepter une candidature avec personnes supplémentaires valides', async () => {
      const applicationData = {
        lastName: 'Dupont',
        firstName: 'Jean',
        phone: '+33612345678',
        artistName: 'Artiste Test',
        showTitle: 'Mon Spectacle',
        showDescription: 'Description du spectacle avec 20 caractères minimum',
        showDuration: 30,
        additionalPerformersCount: 2,
        additionalPerformers: [
          {
            lastName: 'Martin',
            firstName: 'Pierre',
            email: 'pierre.martin@example.com',
            phone: '+33698765432',
          },
          {
            lastName: 'Bernard',
            firstName: 'Marie',
            email: 'marie.bernard@example.com',
            phone: '+33687654321',
          },
        ],
      }

      prismaMock.user.update.mockResolvedValue(mockUser)
      prismaMock.showApplication.create.mockResolvedValue({
        ...mockApplication,
        additionalPerformersCount: 2,
        additionalPerformers: applicationData.additionalPerformers,
      })

      global.readBody.mockResolvedValue(applicationData)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(prismaMock.showApplication.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          additionalPerformersCount: 2,
          additionalPerformers: applicationData.additionalPerformers,
        }),
        include: expect.any(Object),
      })
    })

    it('devrait rejeter si le count ne correspond pas au tableau', async () => {
      const applicationData = {
        lastName: 'Dupont',
        firstName: 'Jean',
        phone: '+33612345678',
        artistName: 'Artiste Test',
        showTitle: 'Mon Spectacle',
        showDescription: 'Description du spectacle avec 20 caractères minimum',
        showDuration: 30,
        additionalPerformersCount: 3, // Mismatch: dit 3 mais n'en fournit que 1
        additionalPerformers: [
          {
            lastName: 'Martin',
            firstName: 'Pierre',
            email: 'pierre.martin@example.com',
            phone: '+33698765432',
          },
        ],
      }

      global.readBody.mockResolvedValue(applicationData)
      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/Données invalides/i)
    })

    it('devrait rejeter si un performer a un email invalide', async () => {
      const applicationData = {
        lastName: 'Dupont',
        firstName: 'Jean',
        phone: '+33612345678',
        artistName: 'Artiste Test',
        showTitle: 'Mon Spectacle',
        showDescription: 'Description du spectacle avec 20 caractères minimum',
        showDuration: 30,
        additionalPerformersCount: 1,
        additionalPerformers: [
          {
            lastName: 'Martin',
            firstName: 'Pierre',
            email: 'email-invalide', // Email invalide
            phone: '+33698765432',
          },
        ],
      }

      global.readBody.mockResolvedValue(applicationData)
      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait rejeter si un performer a un nom trop court', async () => {
      const applicationData = {
        lastName: 'Dupont',
        firstName: 'Jean',
        phone: '+33612345678',
        artistName: 'Artiste Test',
        showTitle: 'Mon Spectacle',
        showDescription: 'Description du spectacle avec 20 caractères minimum',
        showDuration: 30,
        additionalPerformersCount: 1,
        additionalPerformers: [
          {
            lastName: 'M', // Trop court (min 2)
            firstName: 'Pierre',
            email: 'pierre@example.com',
            phone: '+33698765432',
          },
        ],
      }

      global.readBody.mockResolvedValue(applicationData)
      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait accepter 0 personnes supplémentaires avec tableau vide', async () => {
      const applicationData = {
        lastName: 'Dupont',
        firstName: 'Jean',
        phone: '+33612345678',
        artistName: 'Artiste Solo',
        showTitle: 'Spectacle Solo',
        showDescription: 'Description du spectacle solo avec 20 caractères',
        showDuration: 15,
        additionalPerformersCount: 0,
        additionalPerformers: [],
      }

      prismaMock.user.update.mockResolvedValue(mockUser)
      prismaMock.showApplication.create.mockResolvedValue({
        ...mockApplication,
        artistName: 'Artiste Solo',
        additionalPerformersCount: 0,
        additionalPerformers: [],
      })

      global.readBody.mockResolvedValue(applicationData)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(prismaMock.showApplication.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          additionalPerformersCount: 0,
          additionalPerformers: [],
        }),
        include: expect.any(Object),
      })
    })
  })
})
