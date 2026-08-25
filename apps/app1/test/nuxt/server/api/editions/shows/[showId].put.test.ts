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

    duration: 30,
    location: 'Scène A',
    imageUrl: 'old_image.jpg',
  }

  const mockUpdatedShow = {
    ...mockExistingShow,
    title: 'Nouveau Titre',
    artists: [],
    handoutItems: [],
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
      // La réponse est relue en fin de transaction, une fois la composition réécrite
      prismaMock.show.findUniqueOrThrow.mockImplementation(() =>
        Promise.resolve(prismaMock.show.update.mock.results.at(-1)?.value ?? mockUpdatedShow)
      )
    })

    it('devrait mettre à jour le titre', async () => {
      prismaMock.show.update.mockResolvedValue({ ...mockUpdatedShow, title: 'Nouveau Titre' })

      global.readBody.mockResolvedValue({ title: 'Nouveau Titre' })
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.data.show.title).toBe('Nouveau Titre')
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

    it('devrait remplacer les représentations quand elles sont fournies', async () => {
      global.readBody.mockResolvedValue({
        performances: [
          { startDateTime: '2024-06-15T14:30:00Z', zoneId: 5 },
          { startDateTime: '2024-06-16T14:30:00Z', location: 'Scène B' },
        ],
      })
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      // Remplacement intégral : les anciennes disparaissent avant que les nouvelles arrivent
      expect(prismaMock.showPerformance.deleteMany).toHaveBeenCalledWith({ where: { showId: 1 } })
      expect(prismaMock.showPerformance.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ showId: 1, zoneId: 5 }),
          expect.objectContaining({ showId: 1, location: 'Scène B' }),
        ],
      })
    })

    it('laisse les représentations intactes quand elles ne sont pas fournies', async () => {
      // Le formulaire du lieu n'envoie que ce qu'il édite : ne rien dire ne doit rien effacer
      global.readBody.mockResolvedValue({ title: 'Nouveau titre' })
      const mockEvent = { context: { user: mockUser } }

      await handler(mockEvent as any)

      expect(prismaMock.showPerformance.deleteMany).not.toHaveBeenCalled()
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

      // La composition est réécrite hors du show.update : les numéros d'un cabaret
      // se créent en plusieurs étapes
      expect(prismaMock.showAct.deleteMany).toHaveBeenCalledWith({ where: { showId: 1 } })
      expect(prismaMock.showArtist.deleteMany).toHaveBeenCalledWith({
        where: { showId: 1 },
      })
      expect(prismaMock.showArtist.createMany).toHaveBeenCalledWith({
        data: [
          { showId: 1, artistId: 2 },
          { showId: 1, artistId: 3 },
        ],
      })
    })

    it('devrait refuser artistIds seul sur un cabaret', async () => {
      // Sans acts, la recomposition effacerait tout le déroulé sans que l'appelant s'en doute
      prismaMock.show.findFirst.mockResolvedValue({ id: 1, editionId: 1, type: 'CABARET' })
      global.readBody.mockResolvedValue({ artistIds: [2] })

      await expect(handler({ context: { user: mockUser } } as any)).rejects.toThrow(/numéros/i)
      expect(prismaMock.showAct.deleteMany).not.toHaveBeenCalled()
    })

    it('devrait effacer les numéros quand un cabaret repasse en spectacle standard', async () => {
      prismaMock.show.update.mockResolvedValue(mockUpdatedShow)
      // Le spectacle existant est un cabaret
      prismaMock.show.findFirst.mockResolvedValue({ id: 1, editionId: 1, type: 'CABARET' })

      global.readBody.mockResolvedValue({ type: 'STANDARD' })

      await handler({ context: { user: mockUser } } as any)

      expect(prismaMock.showAct.deleteMany).toHaveBeenCalledWith({ where: { showId: 1 } })
      expect(prismaMock.show.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'STANDARD' }),
        })
      )
    })

    it('devrait mettre à jour la compagnie', async () => {
      prismaMock.show.update.mockResolvedValue({ ...mockUpdatedShow, companyName: 'Cie Test' })

      global.readBody.mockResolvedValue({ companyName: 'Cie Test' })

      await handler({ context: { user: mockUser } } as any)

      expect(prismaMock.show.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyName: 'Cie Test' }),
        })
      )
    })

    it('devrait effacer la compagnie quand le spectacle passe en cabaret', async () => {
      // Un cabaret n'a pas de compagnie unique : la garder la ferait réapparaître plus tard
      prismaMock.show.update.mockResolvedValue(mockUpdatedShow)
      prismaMock.show.findFirst.mockResolvedValue({
        id: 1,
        editionId: 1,
        type: 'STANDARD',
        companyName: 'Cie Test',
      })

      global.readBody.mockResolvedValue({ type: 'CABARET', acts: [] })

      await handler({ context: { user: mockUser } } as any)

      expect(prismaMock.show.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'CABARET', companyName: null }),
        })
      )
    })

    // Forme historique : des identifiants nus, sans quantité (un exemplaire chacun).
    it('devrait mettre à jour les associations articles à remettre', async () => {
      prismaMock.showHandoutItem.deleteMany.mockResolvedValue({ count: 1 })
      prismaMock.show.update.mockResolvedValue(mockUpdatedShow)

      global.readBody.mockResolvedValue({ handoutItemIds: [4, 5] })
      const mockEvent = { context: { user: mockUser } }

      await handler(mockEvent as any)

      expect(prismaMock.showHandoutItem.deleteMany).toHaveBeenCalledWith({
        where: { showId: 1 },
      })
      expect(prismaMock.showHandoutItem.createMany).toHaveBeenCalledWith({
        data: [
          { showId: 1, handoutItemId: 4, quantity: 1 },
          { showId: 1, handoutItemId: 5, quantity: 1 },
        ],
      })
    })

    it('devrait enregistrer la quantité définie sur chaque association', async () => {
      prismaMock.showHandoutItem.deleteMany.mockResolvedValue({ count: 1 })
      prismaMock.show.update.mockResolvedValue(mockUpdatedShow)

      global.readBody.mockResolvedValue({
        handoutItemIds: [{ handoutItemId: 4, quantity: 3 }, { handoutItemId: 5 }],
      })
      const mockEvent = { context: { user: mockUser } }

      await handler(mockEvent as any)

      expect(prismaMock.showHandoutItem.createMany).toHaveBeenCalledWith({
        data: [
          { showId: 1, handoutItemId: 4, quantity: 3 },
          // Quantité absente : un exemplaire par défaut
          { showId: 1, handoutItemId: 5, quantity: 1 },
        ],
      })
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
