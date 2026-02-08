import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../server/api/editions/[id]/shows-call/[showCallId]/index.put'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('/api/editions/[id]/shows-call/[showCallId] PUT', () => {
  const mockUser = {
    id: 1,
    email: 'organizer@example.com',
    pseudo: 'organizer',
    isGlobalAdmin: false,
  }

  const mockEdition = {
    id: 1,
    name: 'Convention Test 2024',
    status: 'PUBLISHED',
    creatorId: 1,
    convention: {
      authorId: 1,
      organizers: [],
    },
    organizers: [
      {
        userId: 1,
        canManageArtists: true,
      },
    ],
  }

  const mockShowCall = {
    id: 1,
    editionId: 1,
    name: 'Appel principal',
    isOpen: false,
    mode: 'INTERNAL',
    externalUrl: null,
    description: "Description de l'appel",
    deadline: null,
    askPortfolioUrl: true,
    askVideoUrl: true,
    askTechnicalNeeds: true,
    askAccommodation: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn()
    global.getRouterParam = vi.fn().mockImplementation((event: any, param: string) => {
      if (param === 'id') return '1'
      if (param === 'showCallId') return '1'
      return null
    })
  })

  describe('Permissions', () => {
    it('devrait rejeter les utilisateurs non connectés', async () => {
      const mockEvent = { context: { user: null } }

      await expect(handler(mockEvent as any)).rejects.toThrow('Unauthorized')
    })

    it('devrait rejeter les utilisateurs sans droits de gestion des artistes', async () => {
      const editionWithoutPermission = {
        ...mockEdition,
        creatorId: 999,
        convention: {
          authorId: 999,
          organizers: [],
        },
        organizers: [
          {
            userId: 1,
            canManageArtists: false,
          },
        ],
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithoutPermission)
      global.readBody.mockResolvedValue({ name: 'Nouveau nom' })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/droits/i)
    })
  })

  describe('Mise à jour réussie', () => {
    beforeEach(() => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
      prismaMock.editionShowCall.findUnique.mockResolvedValue(null) // Pas de doublon
      prismaMock.user.findMany.mockResolvedValue([]) // Artistes pour notification
    })

    it("devrait mettre à jour le nom de l'appel", async () => {
      const updatedShowCall = { ...mockShowCall, name: 'Nouveau nom' }
      prismaMock.editionShowCall.update.mockResolvedValue(updatedShowCall)

      global.readBody.mockResolvedValue({ name: 'Nouveau nom' })
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.showCall.name).toBe('Nouveau nom')
      expect(prismaMock.editionShowCall.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({ name: 'Nouveau nom' }),
      })
    })

    it("devrait mettre à jour l'état d'ouverture", async () => {
      const updatedShowCall = { ...mockShowCall, isOpen: true }
      prismaMock.editionShowCall.update.mockResolvedValue(updatedShowCall)

      global.readBody.mockResolvedValue({ isOpen: true })
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.showCall.isOpen).toBe(true)
    })

    it('devrait mettre à jour la description', async () => {
      const updatedShowCall = { ...mockShowCall, description: 'Nouvelle description' }
      prismaMock.editionShowCall.update.mockResolvedValue(updatedShowCall)

      global.readBody.mockResolvedValue({ description: 'Nouvelle description' })
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.showCall.description).toBe('Nouvelle description')
    })

    it("devrait mettre à jour le mode et l'URL externe", async () => {
      const updatedShowCall = {
        ...mockShowCall,
        mode: 'EXTERNAL',
        externalUrl: 'https://external-form.com',
        isOpen: true,
      }
      prismaMock.editionShowCall.update.mockResolvedValue(updatedShowCall)

      global.readBody.mockResolvedValue({
        mode: 'EXTERNAL',
        externalUrl: 'https://external-form.com',
        isOpen: true,
      })
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.showCall.mode).toBe('EXTERNAL')
      expect(result.showCall.externalUrl).toBe('https://external-form.com')
    })

    it('devrait mettre à jour les champs du formulaire', async () => {
      const updatedShowCall = {
        ...mockShowCall,
        askPortfolioUrl: false,
        askVideoUrl: false,
        askTechnicalNeeds: false,
        askAccommodation: true,
      }
      prismaMock.editionShowCall.update.mockResolvedValue(updatedShowCall)

      global.readBody.mockResolvedValue({
        askPortfolioUrl: false,
        askVideoUrl: false,
        askTechnicalNeeds: false,
        askAccommodation: true,
      })
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.showCall.askAccommodation).toBe(true)
    })

    it('devrait mettre à jour la date limite', async () => {
      const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const updatedShowCall = { ...mockShowCall, deadline: new Date(deadline) }
      prismaMock.editionShowCall.update.mockResolvedValue(updatedShowCall)

      global.readBody.mockResolvedValue({ deadline })
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(prismaMock.editionShowCall.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({ deadline: expect.any(Date) }),
      })
    })
  })

  describe('Validation des données', () => {
    beforeEach(() => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
    })

    it('devrait rejeter si mode EXTERNAL est ouvert sans URL externe', async () => {
      global.readBody.mockResolvedValue({
        mode: 'EXTERNAL',
        isOpen: true,
        externalUrl: null,
      })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/URL externe.*requise/i)
    })

    it('devrait rejeter un nom trop long', async () => {
      global.readBody.mockResolvedValue({
        name: 'a'.repeat(101),
      })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait rejeter un nom en doublon', async () => {
      prismaMock.editionShowCall.findUnique.mockResolvedValue({ id: 2, name: 'Appel existant' })

      global.readBody.mockResolvedValue({
        name: 'Appel existant',
      })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/existe déjà/i)
    })

    it('devrait accepter une description vide', async () => {
      const updatedShowCall = { ...mockShowCall, description: null }
      prismaMock.editionShowCall.findUnique.mockResolvedValue(null)
      prismaMock.editionShowCall.update.mockResolvedValue(updatedShowCall)

      global.readBody.mockResolvedValue({ description: null })
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
    })
  })

  describe('Gestion des erreurs', () => {
    it("devrait gérer l'édition inexistante", async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)
      global.readBody.mockResolvedValue({ name: 'Test' })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/non trouvée/i)
    })

    it("devrait gérer l'appel à spectacles inexistant", async () => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(null)
      global.readBody.mockResolvedValue({ name: 'Test' })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/non trouvé/i)
    })

    it('devrait rejeter un ID de showCallId invalide', async () => {
      global.getRouterParam.mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showCallId') return 'invalid'
        return null
      })

      global.readBody.mockResolvedValue({ name: 'Test' })
      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/invalide/i)
    })

    it('devrait gérer les erreurs de base de données', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
      prismaMock.editionShowCall.findUnique.mockResolvedValue(null)
      prismaMock.editionShowCall.update.mockRejectedValue(new Error('Database error'))

      global.readBody.mockResolvedValue({ name: 'Test' })
      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })
  })

  describe("Cas avec l'admin global", () => {
    it("devrait autoriser l'admin global même sans droits spécifiques", async () => {
      const adminUser = { ...mockUser, isGlobalAdmin: true }
      const editionWithoutPermission = {
        ...mockEdition,
        creatorId: 999,
        convention: {
          authorId: 999,
          organizers: [],
        },
        organizers: [],
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithoutPermission)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
      prismaMock.editionShowCall.findUnique.mockResolvedValue(null)
      prismaMock.editionShowCall.update.mockResolvedValue({ ...mockShowCall, isOpen: true })
      prismaMock.user.findMany.mockResolvedValue([]) // Artistes pour notification

      global.readBody.mockResolvedValue({ isOpen: true })
      const mockEvent = { context: { user: adminUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
    })
  })
})
