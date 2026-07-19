import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../server/api/editions/[id]/shows/index.post'

const mockHandleFileUpload = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/file-helpers', () => ({
  handleFileUpload: mockHandleFileUpload,
}))

const prismaMock = (globalThis as any).prisma

describe('/api/editions/[id]/shows POST', () => {
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

  const mockCreatedShow = {
    id: 10,
    editionId: 1,
    title: 'Nouveau Spectacle',
    description: 'Description test',
    startDateTime: new Date('2024-06-15T14:30:00Z'),
    duration: 45,
    location: 'Scène B',
    imageUrl: null,
    zoneId: null,
    markerId: null,
  }

  const mockUpdatedShow = {
    ...mockCreatedShow,
    artists: [],
    handoutItems: [],
    zone: null,
    marker: null,
  }

  const validBody = {
    title: 'Nouveau Spectacle',
    description: 'Description test',
    startDateTime: '2024-06-15T14:30:00Z',
    duration: 45,
    location: 'Scène B',
    artistIds: [],
    handoutItemIds: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn()
    global.getRouterParam = vi.fn().mockImplementation((event: any, param: string) => {
      if (param === 'id') return '1'
      return null
    })
    mockHandleFileUpload.mockResolvedValue(null)
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
      global.readBody.mockResolvedValue(validBody)

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/autorisé/i)
    })
  })

  describe('Création réussie', () => {
    beforeEach(() => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.show.create.mockResolvedValue(mockCreatedShow)
      prismaMock.show.update.mockResolvedValue(mockUpdatedShow)
    })

    it('devrait créer un spectacle basique', async () => {
      global.readBody.mockResolvedValue(validBody)
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.data.show).toBeDefined()
      expect(prismaMock.show.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            editionId: 1,
            title: 'Nouveau Spectacle',
          }),
        })
      )
    })

    it('devrait créer un spectacle avec zoneId', async () => {
      const bodyWithZone = { ...validBody, zoneId: 5 }
      global.readBody.mockResolvedValue(bodyWithZone)
      const mockEvent = { context: { user: mockUser } }

      await handler(mockEvent as any)

      expect(prismaMock.show.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            zoneId: 5,
            markerId: null,
          }),
        })
      )
    })

    it('devrait créer un spectacle avec markerId', async () => {
      const bodyWithMarker = { ...validBody, markerId: 3 }
      global.readBody.mockResolvedValue(bodyWithMarker)
      const mockEvent = { context: { user: mockUser } }

      await handler(mockEvent as any)

      expect(prismaMock.show.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            zoneId: null,
            markerId: 3,
          }),
        })
      )
    })

    it("devrait gérer l'upload d'image via handleFileUpload", async () => {
      const bodyWithImage = { ...validBody, imageUrl: '/uploads/temp/shows/1/image.jpg' }
      mockHandleFileUpload.mockResolvedValue('final_image.jpg')
      prismaMock.show.update.mockResolvedValue({ ...mockUpdatedShow, imageUrl: 'final_image.jpg' })

      global.readBody.mockResolvedValue(bodyWithImage)
      const mockEvent = { context: { user: mockUser } }

      await handler(mockEvent as any)

      expect(mockHandleFileUpload).toHaveBeenCalledWith('/uploads/temp/shows/1/image.jpg', null, {
        resourceId: 10,
        resourceType: 'shows',
      })
      expect(prismaMock.show.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ imageUrl: 'final_image.jpg' }),
        })
      )
    })

    it('devrait créer les associations artistes et articles', async () => {
      const bodyWithAssociations = {
        ...validBody,
        artistIds: [1, 2],
        handoutItemIds: [3, 4],
      }
      global.readBody.mockResolvedValue(bodyWithAssociations)
      const mockEvent = { context: { user: mockUser } }

      await handler(mockEvent as any)

      // Les articles restent créés avec le spectacle ; les artistes passent par une seconde
      // étape, les numéros d'un cabaret ayant besoin de l'id du spectacle
      expect(prismaMock.show.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'STANDARD',
            handoutItems: {
              create: [{ handoutItemId: 3 }, { handoutItemId: 4 }],
            },
          }),
        })
      )
      expect(prismaMock.showArtist.createMany).toHaveBeenCalledWith({
        data: [
          { showId: 10, artistId: 1 },
          { showId: 10, artistId: 2 },
        ],
      })
    })

    it('devrait créer les numéros et leurs artistes pour un cabaret', async () => {
      global.readBody.mockResolvedValue({
        ...validBody,
        type: 'CABARET',
        acts: [
          { title: 'Diabolo', duration: 6, artistIds: [1, 2] },
          { title: 'Massues', artistIds: [2] },
        ],
      })
      prismaMock.showAct.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: data.position === 0 ? 100 : 101, ...data })
      )

      await handler({ context: { user: mockUser } } as any)

      // La position vient de l'ordre du tableau
      expect(prismaMock.showAct.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ showId: 10, title: 'Diabolo', position: 0, duration: 6 }),
        })
      )
      expect(prismaMock.showAct.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'Massues', position: 1, duration: null }),
        })
      )
      // showId est renseigné en plus de actId, pour que l'artiste reste rattaché au spectacle
      expect(prismaMock.showArtist.createMany).toHaveBeenCalledWith({
        data: [
          { showId: 10, actId: 100, artistId: 1 },
          { showId: 10, actId: 100, artistId: 2 },
        ],
      })
      expect(prismaMock.showArtist.createMany).toHaveBeenCalledWith({
        data: [{ showId: 10, actId: 101, artistId: 2 }],
      })
    })
  })

  describe('Validation des données', () => {
    beforeEach(() => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    })

    it('devrait rejeter un titre manquant', async () => {
      global.readBody.mockResolvedValue({ ...validBody, title: '' })
      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })

    it('devrait rejeter un startDateTime invalide', async () => {
      global.readBody.mockResolvedValue({ ...validBody, startDateTime: 'not-a-date' })
      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })
  })

  describe('Gestion des erreurs', () => {
    it("devrait gérer l'édition inexistante", async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)
      global.readBody.mockResolvedValue(validBody)

      const mockEvent = { context: { user: mockUser } }

      await expect(handler(mockEvent as any)).rejects.toThrow(/non trouvée/i)
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
      prismaMock.show.create.mockResolvedValue(mockCreatedShow)
      prismaMock.show.update.mockResolvedValue(mockUpdatedShow)

      global.readBody.mockResolvedValue(validBody)
      const mockEvent = { context: { user: adminUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
    })
  })
})
