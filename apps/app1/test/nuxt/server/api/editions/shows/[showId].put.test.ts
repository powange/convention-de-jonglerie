import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../server/api/editions/[id]/shows/[showId].put'
import { global } from '../../../../globales-nitro'

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

    /*
     * ⚠️ LA COMPOSITION VÉRIFIE DÉSORMAIS L'APPARTENANCE À L'ÉDITION avant d'écrire : elle remonte
     * à l'édition du spectacle, puis demande les artistes, la zone et le repère qui s'y rattachent.
     *
     * Ces mocks sont le DÉFAUT PERMISSIF — tout appartient à l'édition —, pour que les tests qui
     * ne parlent pas d'appartenance ne dépendent pas d'une garde qui n'est pas leur sujet. Les
     * tests de refus les resserrent eux-mêmes.
     */
    prismaMock.show.findUnique.mockResolvedValue({ editionId: 1 })
    prismaMock.editionArtist.findMany.mockImplementation(({ where }: any) =>
      Promise.resolve((where?.id?.in ?? []).map((id: number) => ({ id })))
    )
    prismaMock.editionZone.findFirst.mockResolvedValue({ id: 1 })
    prismaMock.editionMarker.findFirst.mockResolvedValue({ id: 1 })
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

  describe('Appartenance \u00e0 l\u2019\u00e9dition', () => {
    /**
     * ⚠️ CE QUI MANQUAIT, et pourquoi c'\u00e9tait exploitable. La composition \u00e9crivait les `artistIds`
     * re\u00e7us sans v\u00e9rifier leur \u00e9dition. Un identifiant d'`EditionArtist` appartenant \u00e0 une AUTRE
     * convention \u00e9tait donc li\u00e9 au spectacle — et cet artiste apparaissait ensuite dans la
     * billetterie de cette \u00e9dition, dans son espace artiste, dans ses feuilles de repas.
     *
     * L'\u00e9criture est autoris\u00e9e par le DROIT SUR L'\u00c9DITION, pas par l'appartenance des donn\u00e9es :
     * quelqu'un qui g\u00e8re l\u00e9gitimement l'\u00e9dition 1 pouvait y rattacher les artistes de l'\u00e9dition 17,
     * sans aucun droit sur celle-ci. C'est le contr\u00f4le d'acc\u00e8s qui donnait le change.
     */
    beforeEach(() => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.show.findFirst.mockResolvedValue(mockExistingShow)
      prismaMock.show.findUniqueOrThrow.mockResolvedValue(mockUpdatedShow)
    })

    it('REFUSE un artiste qui n\u2019est pas de cette \u00e9dition', async () => {
      // La requ\u00eate born\u00e9e \u00e0 l'\u00e9dition ne le retrouve pas.
      prismaMock.editionArtist.findMany.mockResolvedValue([])
      global.readBody.mockResolvedValue({ title: 'Test', artistIds: [99] })

      await expect(handler({ context: { user: mockUser } } as any)).rejects.toThrow(
        /Artiste inconnu dans cette \u00e9dition/
      )
    })

    it('n\u2019\u00e9crit RIEN quand l\u2019artiste est refus\u00e9', async () => {
      /*
       * La v\u00e9rification passe AVANT le `deleteMany` des liens : lever apr\u00e8s les avoir supprim\u00e9s
       * les perdrait pour rien. Ce test mesure l'absence d'\u00e9criture, pas seulement le refus.
       */
      prismaMock.editionArtist.findMany.mockResolvedValue([])
      global.readBody.mockResolvedValue({ title: 'Test', artistIds: [99] })

      await expect(handler({ context: { user: mockUser } } as any)).rejects.toThrow()

      expect(prismaMock.showArtist.deleteMany).not.toHaveBeenCalled()
      expect(prismaMock.showArtist.createMany).not.toHaveBeenCalled()
    })

    it('REFUSE une zone qui n\u2019est pas de cette \u00e9dition', async () => {
      /*
       * Une repr\u00e9sentation de cette \u00e9dition pouvait pointer la zone d'une AUTRE : le public voyait
       * sur son plan un lieu qui n'existe pas chez lui, ou le nom d'un lieu d'une autre convention.
       */
      prismaMock.editionZone.findFirst.mockResolvedValue(null)
      global.readBody.mockResolvedValue({
        title: 'Test',
        performances: [{ startDateTime: '2026-07-15T20:00:00Z', zoneId: 99 }],
      })

      await expect(handler({ context: { user: mockUser } } as any)).rejects.toThrow(
        /Zone inconnue dans cette \u00e9dition/
      )
    })

    it('REFUSE un rep\u00e8re qui n\u2019est pas de cette \u00e9dition', async () => {
      prismaMock.editionMarker.findFirst.mockResolvedValue(null)
      global.readBody.mockResolvedValue({
        title: 'Test',
        performances: [{ startDateTime: '2026-07-15T20:00:00Z', markerId: 99 }],
      })

      await expect(handler({ context: { user: mockUser } } as any)).rejects.toThrow(
        /Rep\u00e8re inconnu dans cette \u00e9dition/
      )
    })

    it('borne les requ\u00eates \u00e0 L\u2019\u00c9DITION du spectacle', async () => {
      /*
       * ⚠️ LE TEST QUI TIENT LA GARDE. Le mock de Prisma IGNORE le `where` : les refus ci-dessus
       * reposent sur un `findMany`/`findFirst` rendu vide, et resteraient VERTS si le crit\u00e8re
       * `editionId` disparaissait de la requ\u00eate. Seule une assertion sur sa forme le voit.
       */
      global.readBody.mockResolvedValue({
        title: 'Test',
        artistIds: [5],
        performances: [{ startDateTime: '2026-07-15T20:00:00Z', zoneId: 3, markerId: 4 }],
      })

      await handler({ context: { user: mockUser } } as any)

      expect(prismaMock.editionArtist.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ editionId: 1 }) })
      )
      expect(prismaMock.editionZone.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ editionId: 1 }) })
      )
      expect(prismaMock.editionMarker.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ editionId: 1 }) })
      )
    })

    it('ACCEPTE des donn\u00e9es de la bonne \u00e9dition', async () => {
      // La non-r\u00e9gression : le cas normal doit continuer de passer.
      global.readBody.mockResolvedValue({
        title: 'Test',
        artistIds: [5],
        performances: [{ startDateTime: '2026-07-15T20:00:00Z', zoneId: 3 }],
      })

      await expect(handler({ context: { user: mockUser } } as any)).resolves.toBeTruthy()
    })
  })
})
