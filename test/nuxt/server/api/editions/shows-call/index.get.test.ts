import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../server/api/editions/[id]/shows-call/index.get'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('/api/editions/[id]/shows-call GET', () => {
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

  const mockShowCalls = [
    {
      id: 1,
      editionId: 1,
      name: 'Appel principal',
      isOpen: true,
      mode: 'INTERNAL',
      externalUrl: null,
      description: 'Description 1',
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      editionId: 1,
      name: 'Appel secondaire',
      isOpen: false,
      mode: 'EXTERNAL',
      externalUrl: 'https://external.com',
      description: 'Description 2',
      deadline: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn().mockReturnValue('1')
  })

  describe('Permissions', () => {
    it('devrait rejeter les utilisateurs non connectés', async () => {
      const mockEvent = { context: { user: null } }

      await expect(handler(mockEvent as any)).rejects.toThrow('Unauthorized')
    })

    it('devrait rejeter les utilisateurs sans droits de gestion des artistes', async () => {
      const editionWithoutPermission = {
        ...mockEdition,
        creatorId: 999, // Pas le créateur
        convention: {
          authorId: 999, // Pas l'auteur
          organizers: [],
        },
        organizers: [
          {
            userId: 1,
            canManageArtists: false, // Pas de droits
          },
        ],
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithoutPermission)

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/droits/i)
    })
  })

  describe('Liste des appels à spectacles', () => {
    beforeEach(() => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    })

    it('devrait retourner une liste vide si aucun appel', async () => {
      prismaMock.editionShowCall.findMany.mockResolvedValue([])
      prismaMock.showApplication.groupBy.mockResolvedValue([])

      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.showCalls).toEqual([])
    })

    it('devrait retourner les appels avec leurs statistiques', async () => {
      prismaMock.editionShowCall.findMany.mockResolvedValue(mockShowCalls)
      prismaMock.showApplication.groupBy.mockResolvedValue([
        { showCallId: 1, status: 'PENDING', _count: 5 },
        { showCallId: 1, status: 'ACCEPTED', _count: 3 },
        { showCallId: 1, status: 'REJECTED', _count: 2 },
        { showCallId: 2, status: 'PENDING', _count: 1 },
      ])

      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.showCalls).toHaveLength(2)

      // Premier appel avec stats
      const firstCall = result.showCalls[0]
      expect(firstCall.name).toBe('Appel principal')
      expect(firstCall.stats.pending).toBe(5)
      expect(firstCall.stats.accepted).toBe(3)
      expect(firstCall.stats.rejected).toBe(2)
      expect(firstCall.stats.total).toBe(10)

      // Deuxième appel avec stats
      const secondCall = result.showCalls[1]
      expect(secondCall.name).toBe('Appel secondaire')
      expect(secondCall.stats.pending).toBe(1)
      expect(secondCall.stats.accepted).toBe(0)
      expect(secondCall.stats.rejected).toBe(0)
      expect(secondCall.stats.total).toBe(1)
    })

    it('devrait initialiser les stats à zéro si aucune candidature', async () => {
      prismaMock.editionShowCall.findMany.mockResolvedValue([mockShowCalls[0]])
      prismaMock.showApplication.groupBy.mockResolvedValue([])

      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.showCalls[0].stats).toEqual({
        pending: 0,
        accepted: 0,
        rejected: 0,
        total: 0,
      })
    })

    it('devrait trier les appels par date de création décroissante', async () => {
      const mockEvent = { context: { user: mockUser } }
      prismaMock.editionShowCall.findMany.mockResolvedValue(mockShowCalls)
      prismaMock.showApplication.groupBy.mockResolvedValue([])

      await handler(mockEvent as any)

      expect(prismaMock.editionShowCall.findMany).toHaveBeenCalledWith({
        where: { editionId: 1 },
        orderBy: { createdAt: 'desc' },
      })
    })
  })

  describe('Gestion des erreurs', () => {
    it("devrait gérer l'édition inexistante", async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/non trouvée/i)
    })

    it('devrait gérer les erreurs de base de données', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findMany.mockRejectedValue(new Error('Database error'))

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
      prismaMock.editionShowCall.findMany.mockResolvedValue(mockShowCalls)
      prismaMock.showApplication.groupBy.mockResolvedValue([])

      const mockEvent = { context: { user: adminUser } }

      const result = await handler(mockEvent as any)

      expect(result.showCalls).toHaveLength(2)
    })
  })
})
