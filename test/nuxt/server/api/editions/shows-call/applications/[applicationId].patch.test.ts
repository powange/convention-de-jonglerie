import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../../server/api/editions/[id]/shows-call/[showCallId]/applications/[applicationId].patch'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('/api/editions/[id]/shows-call/[showCallId]/applications/[applicationId] PATCH', () => {
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

  const mockApplication = {
    id: 1,
    showCallId: 1,
    userId: 2,
    status: 'PENDING',
    artistName: 'Artiste Test',
    artistBio: "Bio de l'artiste",
    showTitle: 'Mon Spectacle',
    showDescription: 'Description du spectacle',
    showDuration: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
    decidedAt: null,
    decidedById: null,
    organizerNotes: null,
  }

  const mockUpdatedApplication = {
    ...mockApplication,
    status: 'ACCEPTED',
    decidedAt: new Date(),
    decidedById: 1,
    showCall: {
      id: 1,
      name: 'Appel principal',
    },
    user: {
      id: 2,
      pseudo: 'artist',
      prenom: 'John',
      nom: 'Doe',
      emailHash: 'hash123',
      profilePicture: null,
    },
    decidedBy: {
      id: 1,
      pseudo: 'organizer',
      emailHash: 'hash456',
      profilePicture: null,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn()
    global.getRouterParam = vi.fn().mockImplementation((event: any, param: string) => {
      if (param === 'id') return '1'
      if (param === 'showCallId') return '1'
      if (param === 'applicationId') return '1'
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
      global.readBody.mockResolvedValue({ status: 'ACCEPTED' })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/droits/i)
    })
  })

  describe('Changement de statut', () => {
    beforeEach(() => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.showApplication.findFirst.mockResolvedValue(mockApplication)
    })

    it('devrait accepter une candidature', async () => {
      prismaMock.showApplication.update.mockResolvedValue({
        ...mockUpdatedApplication,
        status: 'ACCEPTED',
      })

      global.readBody.mockResolvedValue({ status: 'ACCEPTED' })
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.data.application.status).toBe('ACCEPTED')
      expect(prismaMock.showApplication.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          status: 'ACCEPTED',
          decidedAt: expect.any(Date),
          decidedById: mockUser.id,
        }),
        include: expect.any(Object),
      })
    })

    it('devrait rejeter une candidature', async () => {
      prismaMock.showApplication.update.mockResolvedValue({
        ...mockUpdatedApplication,
        status: 'REJECTED',
      })

      global.readBody.mockResolvedValue({ status: 'REJECTED' })
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.data.application.status).toBe('REJECTED')
      expect(prismaMock.showApplication.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          status: 'REJECTED',
          decidedAt: expect.any(Date),
          decidedById: mockUser.id,
        }),
        include: expect.any(Object),
      })
    })

    it('devrait remettre une candidature en attente', async () => {
      const acceptedApplication = { ...mockApplication, status: 'ACCEPTED' }
      prismaMock.showApplication.findFirst.mockResolvedValue(acceptedApplication)
      prismaMock.showApplication.update.mockResolvedValue({
        ...mockUpdatedApplication,
        status: 'PENDING',
        decidedAt: null,
        decidedById: null,
        decidedBy: null,
      })

      global.readBody.mockResolvedValue({ status: 'PENDING' })
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(prismaMock.showApplication.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          status: 'PENDING',
          decidedAt: null,
          decidedById: null,
        }),
        include: expect.any(Object),
      })
    })

    it('ne devrait pas mettre à jour decidedAt si le statut reste le même', async () => {
      const pendingApplication = { ...mockApplication, status: 'PENDING' }
      prismaMock.showApplication.findFirst.mockResolvedValue(pendingApplication)
      prismaMock.showApplication.update.mockResolvedValue({
        ...mockUpdatedApplication,
        status: 'PENDING',
        decidedAt: null,
        decidedById: null,
      })

      global.readBody.mockResolvedValue({ status: 'PENDING' })
      const mockEvent = { context: { user: mockUser } }

      await handler(mockEvent as any)

      // Pas de decidedAt/decidedById car le statut ne change pas de manière significative
      expect(prismaMock.showApplication.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          status: 'PENDING',
          decidedAt: null,
          decidedById: null,
        }),
        include: expect.any(Object),
      })
    })
  })

  describe('Notes organisateur', () => {
    beforeEach(() => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.showApplication.findFirst.mockResolvedValue(mockApplication)
    })

    it('devrait mettre à jour les notes organisateur', async () => {
      prismaMock.showApplication.update.mockResolvedValue({
        ...mockUpdatedApplication,
        organizerNotes: 'Notes importantes',
      })

      global.readBody.mockResolvedValue({
        status: 'PENDING',
        organizerNotes: 'Notes importantes',
      })
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(prismaMock.showApplication.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          organizerNotes: 'Notes importantes',
        }),
        include: expect.any(Object),
      })
    })

    it('devrait effacer les notes organisateur si null', async () => {
      const applicationWithNotes = { ...mockApplication, organizerNotes: 'Notes existantes' }
      prismaMock.showApplication.findFirst.mockResolvedValue(applicationWithNotes)
      prismaMock.showApplication.update.mockResolvedValue({
        ...mockUpdatedApplication,
        organizerNotes: null,
      })

      global.readBody.mockResolvedValue({
        status: 'PENDING',
        organizerNotes: null,
      })
      const mockEvent = { context: { user: mockUser } }

      await handler(mockEvent as any)

      expect(prismaMock.showApplication.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          organizerNotes: null,
        }),
        include: expect.any(Object),
      })
    })
  })

  describe('Validation des données', () => {
    beforeEach(() => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.showApplication.findFirst.mockResolvedValue(mockApplication)
    })

    it('devrait rejeter un statut invalide', async () => {
      global.readBody.mockResolvedValue({ status: 'INVALID_STATUS' })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait rejeter des notes trop longues', async () => {
      global.readBody.mockResolvedValue({
        status: 'PENDING',
        organizerNotes: 'a'.repeat(3001),
      })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })
  })

  describe('Gestion des erreurs', () => {
    it("devrait gérer l'édition inexistante", async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)
      global.readBody.mockResolvedValue({ status: 'ACCEPTED' })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/non trouvée/i)
    })

    it('devrait gérer la candidature inexistante', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.showApplication.findFirst.mockResolvedValue(null)
      global.readBody.mockResolvedValue({ status: 'ACCEPTED' })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/non trouvée/i)
    })

    it('devrait rejeter un ID de showCallId invalide', async () => {
      global.getRouterParam.mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showCallId') return 'invalid'
        if (param === 'applicationId') return '1'
        return null
      })

      global.readBody.mockResolvedValue({ status: 'ACCEPTED' })
      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/invalide/i)
    })

    it('devrait rejeter un ID de applicationId invalide', async () => {
      global.getRouterParam.mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showCallId') return '1'
        if (param === 'applicationId') return 'invalid'
        return null
      })

      global.readBody.mockResolvedValue({ status: 'ACCEPTED' })
      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/invalide/i)
    })

    it('devrait gérer les erreurs de base de données', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.showApplication.findFirst.mockResolvedValue(mockApplication)
      prismaMock.showApplication.update.mockRejectedValue(new Error('Database error'))

      global.readBody.mockResolvedValue({ status: 'ACCEPTED' })
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
      prismaMock.showApplication.findFirst.mockResolvedValue(mockApplication)
      prismaMock.showApplication.update.mockResolvedValue({
        ...mockUpdatedApplication,
        status: 'ACCEPTED',
      })

      global.readBody.mockResolvedValue({ status: 'ACCEPTED' })
      const mockEvent = { context: { user: adminUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
    })
  })
})
