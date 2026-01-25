import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../server/api/editions/[id]/shows-call/[showCallId]/index.delete'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('/api/editions/[id]/shows-call/[showCallId] DELETE', () => {
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
    isOpen: true,
    mode: 'INTERNAL',
    externalUrl: null,
    description: "Description de l'appel",
    deadline: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: {
      applications: 5,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
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

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/droits/i)
    })
  })

  describe('Suppression réussie', () => {
    beforeEach(() => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
      prismaMock.editionShowCall.delete.mockResolvedValue(mockShowCall)
    })

    it("devrait supprimer l'appel à spectacles", async () => {
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(prismaMock.editionShowCall.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      })
    })

    it('devrait retourner le nombre de candidatures supprimées', async () => {
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.deletedApplicationsCount).toBe(5)
    })

    it('devrait supprimer un appel sans candidatures', async () => {
      const showCallWithoutApplications = {
        ...mockShowCall,
        _count: { applications: 0 },
      }
      prismaMock.editionShowCall.findFirst.mockResolvedValue(showCallWithoutApplications)

      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.deletedApplicationsCount).toBe(0)
    })

    it('devrait supprimer un appel avec beaucoup de candidatures', async () => {
      const showCallWithManyApplications = {
        ...mockShowCall,
        _count: { applications: 100 },
      }
      prismaMock.editionShowCall.findFirst.mockResolvedValue(showCallWithManyApplications)

      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.deletedApplicationsCount).toBe(100)
    })
  })

  describe('Gestion des erreurs', () => {
    it("devrait gérer l'édition inexistante", async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/non trouvée/i)
    })

    it("devrait gérer l'appel à spectacles inexistant", async () => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(null)

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/non trouvé/i)
    })

    it('devrait rejeter un ID de showCallId invalide', async () => {
      global.getRouterParam.mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showCallId') return 'invalid'
        return null
      })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/invalide/i)
    })

    it('devrait gérer les erreurs de base de données', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
      prismaMock.editionShowCall.delete.mockRejectedValue(new Error('Database error'))

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
      prismaMock.editionShowCall.delete.mockResolvedValue(mockShowCall)

      const mockEvent = { context: { user: adminUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
    })
  })
})
