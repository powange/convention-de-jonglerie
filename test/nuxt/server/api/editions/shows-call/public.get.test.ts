import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../server/api/editions/[id]/shows-call/[showCallId]/public.get'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('/api/editions/[id]/shows-call/[showCallId]/public GET', () => {
  const mockEdition = {
    id: 1,
    name: 'Convention Test 2024',
    status: 'PUBLISHED',
    startDate: new Date('2024-07-01'),
    endDate: new Date('2024-07-05'),
  }

  const mockShowCall = {
    id: 1,
    editionId: 1,
    name: 'Appel à spectacles principal',
    visibility: 'PUBLIC',
    mode: 'INTERNAL',
    externalUrl: null,
    description: "Description de l'appel à spectacles",
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Dans 7 jours
    askPortfolioUrl: true,
    askVideoUrl: true,
    askTechnicalNeeds: true,
    askAccommodation: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn().mockImplementation((event: any, param: string) => {
      if (param === 'id') return '1'
      if (param === 'showCallId') return '1'
      return null
    })
  })

  describe('Accès public', () => {
    it('devrait retourner les informations publiques sans authentification', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)

      const mockEvent = { context: { user: null } }

      const result = await handler(mockEvent as any)

      expect(result).toMatchObject({
        id: mockShowCall.id,
        name: mockShowCall.name,
        visibility: mockShowCall.visibility,
        mode: mockShowCall.mode,
        externalUrl: mockShowCall.externalUrl,
        description: mockShowCall.description,
        deadline: mockShowCall.deadline,
        askPortfolioUrl: mockShowCall.askPortfolioUrl,
        askVideoUrl: mockShowCall.askVideoUrl,
        askTechnicalNeeds: mockShowCall.askTechnicalNeeds,
        askAccommodation: mockShowCall.askAccommodation,
      })
    })

    it('devrait retourner les informations pour un utilisateur connecté', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)

      const mockEvent = { context: { user: { id: 1 } } }

      const result = await handler(mockEvent as any)

      expect(result.name).toBe(mockShowCall.name)
    })
  })

  describe('Appel à spectacles avec mode EXTERNAL', () => {
    it("devrait retourner l'URL externe", async () => {
      const externalShowCall = {
        ...mockShowCall,
        mode: 'EXTERNAL',
        externalUrl: 'https://external-form.com',
      }
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(externalShowCall)

      const mockEvent = { context: { user: null } }

      const result = await handler(mockEvent as any)

      expect(result.mode).toBe('EXTERNAL')
      expect(result.externalUrl).toBe('https://external-form.com')
    })
  })

  describe('Appel fermé', () => {
    it("devrait retourner les infos même si l'appel est fermé", async () => {
      const closedShowCall = { ...mockShowCall, visibility: 'CLOSED' }
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(closedShowCall)

      const mockEvent = { context: { user: null } }

      const result = await handler(mockEvent as any)

      expect(result.visibility).toBe('CLOSED')
    })
  })

  describe('Champs optionnels du formulaire', () => {
    it('devrait retourner tous les champs du formulaire désactivés', async () => {
      const showCallWithNoFields = {
        ...mockShowCall,
        askPortfolioUrl: false,
        askVideoUrl: false,
        askTechnicalNeeds: false,
        askAccommodation: false,
      }
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(showCallWithNoFields)

      const mockEvent = { context: { user: null } }

      const result = await handler(mockEvent as any)

      expect(result.askPortfolioUrl).toBe(false)
      expect(result.askVideoUrl).toBe(false)
      expect(result.askTechnicalNeeds).toBe(false)
      expect(result.askAccommodation).toBe(false)
    })

    it('devrait retourner tous les champs du formulaire activés', async () => {
      const showCallWithAllFields = {
        ...mockShowCall,
        askPortfolioUrl: true,
        askVideoUrl: true,
        askTechnicalNeeds: true,
        askAccommodation: true,
      }
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(showCallWithAllFields)

      const mockEvent = { context: { user: null } }

      const result = await handler(mockEvent as any)

      expect(result.askPortfolioUrl).toBe(true)
      expect(result.askVideoUrl).toBe(true)
      expect(result.askTechnicalNeeds).toBe(true)
      expect(result.askAccommodation).toBe(true)
    })
  })

  describe('Date limite', () => {
    it('devrait retourner la date limite si définie', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)

      const mockEvent = { context: { user: null } }

      const result = await handler(mockEvent as any)

      expect(result.deadline).toBeDefined()
    })

    it('devrait retourner null si pas de date limite', async () => {
      const showCallWithoutDeadline = { ...mockShowCall, deadline: null }
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(showCallWithoutDeadline)

      const mockEvent = { context: { user: null } }

      const result = await handler(mockEvent as any)

      expect(result.deadline).toBeNull()
    })
  })

  describe("Statut de l'édition", () => {
    it("devrait rejeter si l'édition est OFFLINE", async () => {
      const offlineEdition = { ...mockEdition, status: 'OFFLINE' }
      prismaMock.edition.findUnique.mockResolvedValue(offlineEdition)

      const mockEvent = { context: { user: null } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/non disponible/i)
    })

    it("devrait accepter si l'édition est PUBLISHED", async () => {
      const publishedEdition = { ...mockEdition, status: 'PUBLISHED' }
      prismaMock.edition.findUnique.mockResolvedValue(publishedEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)

      const mockEvent = { context: { user: null } }

      const result = await handler(mockEvent as any)

      expect(result.name).toBe(mockShowCall.name)
    })

    it("devrait accepter si l'édition est DRAFT", async () => {
      const draftEdition = { ...mockEdition, status: 'DRAFT' }
      prismaMock.edition.findUnique.mockResolvedValue(draftEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)

      const mockEvent = { context: { user: null } }

      const result = await handler(mockEvent as any)

      expect(result.name).toBe(mockShowCall.name)
    })

    it("devrait accepter si l'édition est ARCHIVED", async () => {
      const archivedEdition = { ...mockEdition, status: 'ARCHIVED' }
      prismaMock.edition.findUnique.mockResolvedValue(archivedEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)

      const mockEvent = { context: { user: null } }

      const result = await handler(mockEvent as any)

      expect(result.name).toBe(mockShowCall.name)
    })
  })

  describe('Gestion des erreurs', () => {
    it("devrait gérer l'édition inexistante", async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)

      const mockEvent = { context: { user: null } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/non trouvée/i)
    })

    it("devrait gérer l'appel à spectacles inexistant", async () => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(null)

      const mockEvent = { context: { user: null } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/non trouvé/i)
    })

    it('devrait rejeter un ID de showCallId invalide', async () => {
      global.getRouterParam.mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showCallId') return 'invalid'
        return null
      })

      const mockEvent = { context: { user: null } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/invalide/i)
    })

    it('devrait gérer les erreurs de base de données', async () => {
      prismaMock.edition.findUnique.mockRejectedValue(new Error('Database error'))

      const mockEvent = { context: { user: null } }

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })
  })

  describe('Ne pas exposer les données sensibles', () => {
    it('ne devrait pas retourner les timestamps de création/modification', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)

      const mockEvent = { context: { user: null } }

      const result = await handler(mockEvent as any)

      expect(result).not.toHaveProperty('createdAt')
      expect(result).not.toHaveProperty('updatedAt')
    })

    it("ne devrait pas retourner l'editionId", async () => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)

      const mockEvent = { context: { user: null } }

      const result = await handler(mockEvent as any)

      expect(result).not.toHaveProperty('editionId')
    })
  })
})
