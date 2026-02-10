import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../server/api/editions/[id]/shows/[showId].put'

const mockHandleFileUpload = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/file-helpers', () => ({
  handleFileUpload: mockHandleFileUpload,
}))

const prismaMock = (globalThis as any).prisma

describe('/api/editions/[id]/shows/[showId] PUT', () => {
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

  const mockExistingShow = {
    id: 1,
    editionId: 1,
    title: 'Ancien Titre',
    description: 'Ancienne description',
    startDateTime: new Date('2024-06-15T14:30:00Z'),
    duration: 30,
    location: 'Scène A',
    imageUrl: 'old_image.jpg',
    zoneId: null,
    markerId: null,
  }

  const mockUpdatedShow = {
    ...mockExistingShow,
    title: 'Nouveau Titre',
    artists: [],
    returnableItems: [],
    zone: null,
    marker: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn()
    global.getRouterParam = vi.fn().mockImplementation((event: any, param: string) => {
      if (param === 'id') return '1'
      if (param === 'showId') return '1'
      return null
    })
    mockHandleFileUpload.mockResolvedValue(undefined)
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
      global.readBody.mockResolvedValue({ title: 'Test' })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/autorisé/i)
    })
  })

  describe('Mise à jour réussie', () => {
    beforeEach(() => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.show.findFirst.mockResolvedValue(mockExistingShow)
    })

    it('devrait mettre à jour le titre', async () => {
      prismaMock.show.update.mockResolvedValue({ ...mockUpdatedShow, title: 'Nouveau Titre' })

      global.readBody.mockResolvedValue({ title: 'Nouveau Titre' })
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.show.title).toBe('Nouveau Titre')
    })

    it('devrait mettre à jour partiellement (duration seulement)', async () => {
      prismaMock.show.update.mockResolvedValue({ ...mockUpdatedShow, duration: 60 })

      global.readBody.mockResolvedValue({ duration: 60 })
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(prismaMock.show.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ duration: 60 }),
        })
      )
    })

    it('devrait mettre à jour zoneId et markerId', async () => {
      prismaMock.show.update.mockResolvedValue({
        ...mockUpdatedShow,
        zoneId: 5,
        markerId: null,
        zone: { id: 5, name: 'Scène B', color: '#00ff00', zoneType: 'STAGE' },
      })

      global.readBody.mockResolvedValue({ zoneId: 5, markerId: null })
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(prismaMock.show.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ zoneId: 5, markerId: null }),
        })
      )
    })

    it("devrait gérer le remplacement d'image via handleFileUpload", async () => {
      mockHandleFileUpload.mockResolvedValue('new_image.jpg')
      prismaMock.show.update.mockResolvedValue({ ...mockUpdatedShow, imageUrl: 'new_image.jpg' })

      global.readBody.mockResolvedValue({ imageUrl: '/uploads/temp/shows/1/new.jpg' })
      const mockEvent = { context: { user: mockUser } }

      await handler(mockEvent as any)

      expect(mockHandleFileUpload).toHaveBeenCalledWith(
        '/uploads/temp/shows/1/new.jpg',
        'old_image.jpg',
        { resourceId: 1, resourceType: 'shows' }
      )
    })

    it('devrait mettre à jour les associations artistes', async () => {
      prismaMock.showArtist.deleteMany.mockResolvedValue({ count: 1 })
      prismaMock.show.update.mockResolvedValue(mockUpdatedShow)

      global.readBody.mockResolvedValue({ artistIds: [2, 3] })
      const mockEvent = { context: { user: mockUser } }

      await handler(mockEvent as any)

      expect(prismaMock.showArtist.deleteMany).toHaveBeenCalledWith({
        where: { showId: 1 },
      })
      expect(prismaMock.show.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            artists: {
              create: [{ artistId: 2 }, { artistId: 3 }],
            },
          }),
        })
      )
    })

    it('devrait mettre à jour les associations articles à restituer', async () => {
      prismaMock.showReturnableItem.deleteMany.mockResolvedValue({ count: 1 })
      prismaMock.show.update.mockResolvedValue(mockUpdatedShow)

      global.readBody.mockResolvedValue({ returnableItemIds: [4, 5] })
      const mockEvent = { context: { user: mockUser } }

      await handler(mockEvent as any)

      expect(prismaMock.showReturnableItem.deleteMany).toHaveBeenCalledWith({
        where: { showId: 1 },
      })
      expect(prismaMock.show.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            returnableItems: {
              create: [{ returnableItemId: 4 }, { returnableItemId: 5 }],
            },
          }),
        })
      )
    })
  })

  describe('Gestion des erreurs', () => {
    it("devrait gérer l'édition inexistante", async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)
      global.readBody.mockResolvedValue({ title: 'Test' })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/non trouvée/i)
    })

    it('devrait gérer le spectacle inexistant', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.show.findFirst.mockResolvedValue(null)
      global.readBody.mockResolvedValue({ title: 'Test' })

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/non trouvé/i)
    })

    it('devrait rejeter un showId invalide', async () => {
      global.getRouterParam = vi.fn().mockImplementation((event: any, param: string) => {
        if (param === 'id') return '1'
        if (param === 'showId') return 'invalid'
        return null
      })

      global.readBody.mockResolvedValue({ title: 'Test' })
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
      prismaMock.show.findFirst.mockResolvedValue(mockExistingShow)
      prismaMock.show.update.mockResolvedValue(mockUpdatedShow)

      global.readBody.mockResolvedValue({ title: 'Admin Update' })
      const mockEvent = { context: { user: adminUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
    })
  })
})
