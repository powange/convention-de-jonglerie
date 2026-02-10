import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../server/api/editions/[id]/shows/[showId].delete'

const mockDeleteOldFile = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/file-helpers', () => ({
  deleteOldFile: mockDeleteOldFile,
}))

const prismaMock = (globalThis as any).prisma

describe('/api/editions/[id]/shows/[showId] DELETE', () => {
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
    organizerPermissions: [
      {
        userId: 1,
        organizer: { userId: 1 },
        canManageArtists: true,
      },
    ],
  }

  const mockShowWithImage = {
    id: 1,
    editionId: 1,
    title: 'Spectacle avec image',
    imageUrl: 'show_image.jpg',
    zoneId: null,
    markerId: null,
  }

  const mockShowWithoutImage = {
    id: 2,
    editionId: 1,
    title: 'Spectacle sans image',
    imageUrl: null,
    zoneId: null,
    markerId: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn().mockImplementation((event: any, param: string) => {
      if (param === 'id') return '1'
      if (param === 'showId') return '1'
      return null
    })
    mockDeleteOldFile.mockResolvedValue(undefined)
  })

  describe('Permissions', () => {
    it('devrait rejeter les utilisateurs non connectés', async () => {
      const mockEvent = { context: { user: null } }

      await expect(handler(mockEvent as any)).rejects.toThrow('Unauthorized')
    })

    it('devrait rejeter les utilisateurs sans droits', async () => {
      const editionWithoutPermission = {
        ...mockEdition,
        creatorId: 999,
        convention: { authorId: 999, organizers: [] },
        organizerPermissions: [
          {
            userId: 1,
            organizer: { userId: 1 },
            canManageArtists: false,
          },
        ],
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithoutPermission)

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/autorisé/i)
    })
  })

  describe('Suppression réussie', () => {
    beforeEach(() => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.show.delete.mockResolvedValue(mockShowWithImage)
    })

    it('devrait supprimer le spectacle avec succès', async () => {
      prismaMock.show.findFirst.mockResolvedValue(mockShowWithImage)

      const mockEvent = { context: { user: mockUser } }
      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.message).toMatch(/supprimé/i)
      expect(prismaMock.show.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      })
    })

    it("devrait supprimer l'image associée via deleteOldFile", async () => {
      prismaMock.show.findFirst.mockResolvedValue(mockShowWithImage)

      const mockEvent = { context: { user: mockUser } }
      await handler(mockEvent as any)

      expect(mockDeleteOldFile).toHaveBeenCalledWith('show_image.jpg', 1, 'shows')
    })

    it("ne devrait pas appeler deleteOldFile s'il n'y a pas d'image", async () => {
      prismaMock.show.findFirst.mockResolvedValue(mockShowWithoutImage)
      global.getRouterParam = vi.fn().mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showId') return '2'
        return null
      })

      const mockEvent = { context: { user: mockUser } }
      await handler(mockEvent as any)

      expect(mockDeleteOldFile).not.toHaveBeenCalled()
    })
  })

  describe('Gestion des erreurs', () => {
    it("devrait gérer l'édition inexistante", async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/non trouvée/i)
    })

    it('devrait gérer le spectacle inexistant', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.show.findFirst.mockResolvedValue(null)

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/non trouvé/i)
    })

    it('devrait rejeter un showId invalide', async () => {
      global.getRouterParam = vi.fn().mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showId') return 'invalid'
        return null
      })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/invalide/i)
    })
  })

  describe("Cas avec l'admin global", () => {
    it("devrait autoriser l'admin global même sans droits spécifiques", async () => {
      const adminUser = { ...mockUser, isGlobalAdmin: true }
      const editionWithoutPermission = {
        ...mockEdition,
        creatorId: 999,
        convention: { authorId: 999, organizers: [] },
        organizerPermissions: [],
      }

      prismaMock.edition.findUnique.mockResolvedValue(editionWithoutPermission)
      prismaMock.show.findFirst.mockResolvedValue(mockShowWithoutImage)
      prismaMock.show.delete.mockResolvedValue(mockShowWithoutImage)

      const mockEvent = { context: { user: adminUser } }
      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
    })
  })
})
