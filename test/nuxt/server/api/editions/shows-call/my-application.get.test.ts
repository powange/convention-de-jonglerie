import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../server/api/editions/[id]/shows-call/[showCallId]/my-application.get'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('/api/editions/[id]/shows-call/[showCallId]/my-application GET', () => {
  const mockUser = {
    id: 1,
    email: 'artist@example.com',
    pseudo: 'testartist',
  }

  const mockShowCall = {
    id: 1,
    editionId: 1,
    name: 'Appel à spectacles principal',
    visibility: 'PUBLIC',
    mode: 'INTERNAL',
    externalUrl: null,
    description: "Description de l'appel",
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    askPortfolioUrl: true,
    askVideoUrl: true,
    askTechnicalNeeds: true,
    askAccommodation: true,
    askDepartureCity: false,
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
    accommodationNeeded: true,
    accommodationNotes: 'Notes hébergement',
    additionalPerformersCount: 0,
    additionalPerformers: null,
    departureCity: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
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

  describe('Récupération de la candidature', () => {
    beforeEach(() => {
      global.getRouterParam.mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showCallId') return '1'
        return null
      })
    })

    it("devrait retourner null si l'appel n'existe pas", async () => {
      prismaMock.editionShowCall.findFirst.mockResolvedValue(null)

      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.application).toBeNull()
      expect(result.showCall).toBeNull()
    })

    it("devrait retourner null si l'utilisateur n'a pas candidaté", async () => {
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
      prismaMock.showApplication.findUnique.mockResolvedValue(null)

      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.application).toBeNull()
      expect(result.showCall).toBeDefined()
      expect(result.showCall.id).toBe(mockShowCall.id)
    })

    it('devrait retourner la candidature existante avec les infos du showCall', async () => {
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
      prismaMock.showApplication.findUnique.mockResolvedValue(mockApplication)

      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.application).toBeDefined()
      expect(result.application.id).toBe(mockApplication.id)
      expect(result.application.artistName).toBe('Artiste Test')
      expect(result.application.showTitle).toBe('Mon Spectacle')
      expect(result.showCall).toBeDefined()
      expect(result.showCall.name).toBe('Appel à spectacles principal')
      expect(result.showCall.askDepartureCity).toBe(false)
    })

    it('devrait inclure les champs de configuration du showCall', async () => {
      const showCallWithAllOptions = {
        ...mockShowCall,
        askDepartureCity: true,
        askAccommodation: true,
      }
      prismaMock.editionShowCall.findFirst.mockResolvedValue(showCallWithAllOptions)
      prismaMock.showApplication.findUnique.mockResolvedValue(mockApplication)

      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.showCall.askPortfolioUrl).toBe(true)
      expect(result.showCall.askVideoUrl).toBe(true)
      expect(result.showCall.askTechnicalNeeds).toBe(true)
      expect(result.showCall.askAccommodation).toBe(true)
      expect(result.showCall.askDepartureCity).toBe(true)
    })
  })

  describe('Gestion des erreurs', () => {
    it('devrait rejeter un showCallId invalide', async () => {
      global.getRouterParam.mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showCallId') return 'invalid'
        return null
      })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/invalide/i)
    })
  })
})
