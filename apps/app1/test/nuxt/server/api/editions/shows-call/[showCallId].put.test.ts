import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../server/api/editions/[id]/shows-call/[showCallId]/index.put'
import { global } from '../../../../globales-nitro'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

/**
 * Compte les annonces réellement émises, pour vérifier que le découpage en tranches n'en perd ni
 * n'en double aucune. `safeNotify` est réduit à un passe-plat : son rôle est d'avaler les erreurs,
 * pas de décider qui reçoit quoi.
 */
const annonceEmise = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/notification-service', () => ({
  safeNotify: (travail: () => unknown) => Promise.resolve(travail()),
  NotificationHelpers: {
    showCallOpened: (...args: unknown[]) => annonceEmise(...args),
  },
}))

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
    visibility: 'CLOSED',
    mode: 'INTERNAL',
    externalUrl: null,
    description: "Description de l'appel",
    deadline: null,
    askPortfolioUrl: true,
    askVideoUrl: true,
    askTechnicalNeeds: true,
    askAccommodation: false,
    // Jamais annoncé aux comptes artiste : c'est ce que la base rend pour un appel qui n'a pas
    // encore été ouvert au public.
    openedNotifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  /** Laisse tourner ce qui a été renvoyé à après la réponse (`setImmediate`). */
  const laisserPasserLaDiffusion = () => new Promise((resolve) => setImmediate(resolve))

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn()
    global.getRouterParam = vi.fn().mockImplementation((event: any, param: string) => {
      if (param === 'id') return '1'
      if (param === 'showCallId') return '1'
      return null
    })
    // La prise de marque avant diffusion : par défaut, c'est cette requête qui l'obtient.
    prismaMock.editionShowCall.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.user.findMany.mockResolvedValue([])
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
      expect(result.data.showCall.name).toBe('Nouveau nom')
      expect(prismaMock.editionShowCall.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({ name: 'Nouveau nom' }),
      })
    })

    it("devrait mettre à jour l'état d'ouverture", async () => {
      const updatedShowCall = { ...mockShowCall, visibility: 'PUBLIC' }
      prismaMock.editionShowCall.update.mockResolvedValue(updatedShowCall)

      global.readBody.mockResolvedValue({ visibility: 'PUBLIC' })
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.data.showCall.visibility).toBe('PUBLIC')
    })

    it('devrait mettre à jour la description', async () => {
      const updatedShowCall = { ...mockShowCall, description: 'Nouvelle description' }
      prismaMock.editionShowCall.update.mockResolvedValue(updatedShowCall)

      global.readBody.mockResolvedValue({ description: 'Nouvelle description' })
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.data.showCall.description).toBe('Nouvelle description')
    })

    it("devrait mettre à jour le mode et l'URL externe", async () => {
      const updatedShowCall = {
        ...mockShowCall,
        mode: 'EXTERNAL',
        externalUrl: 'https://external-form.com',
        visibility: 'PUBLIC',
      }
      prismaMock.editionShowCall.update.mockResolvedValue(updatedShowCall)

      global.readBody.mockResolvedValue({
        mode: 'EXTERNAL',
        externalUrl: 'https://external-form.com',
        visibility: 'PUBLIC',
      })
      const mockEvent = { context: { user: mockUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
      expect(result.data.showCall.mode).toBe('EXTERNAL')
      expect(result.data.showCall.externalUrl).toBe('https://external-form.com')
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
      expect(result.data.showCall.askAccommodation).toBe(true)
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

  /**
   * L'ouverture au public annonce l'appel à TOUS les comptes artiste du site. C'était une boucle
   * `for` avec un `await` par artiste, exécutée dans la requête, et rejouée à CHAQUE bascule en
   * PUBLIC — 113 allers-retours séquentiels avant que la réponse ne parte, sur la seule base de
   * développement, et autant de notifications en double à chaque fois qu'on refermait puis
   * rouvrait l'appel.
   *
   * La diffusion est désormais renvoyée à après la réponse, envoyée par tranches, et gardée par
   * `openedNotifiedAt`.
   */
  describe('annonce de l’ouverture aux comptes artiste', () => {
    beforeEach(() => {
      prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
      prismaMock.editionShowCall.findUnique.mockResolvedValue(null)
      prismaMock.editionShowCall.update.mockResolvedValue({
        ...mockShowCall,
        visibility: 'PUBLIC',
      })
      global.readBody.mockResolvedValue({ visibility: 'PUBLIC' })
    })

    it('prend la marque puis diffuse, à la première ouverture', async () => {
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
      prismaMock.user.findMany.mockResolvedValue([{ id: 10 }, { id: 11 }])

      await handler({ context: { user: mockUser } } as any)

      // La marque est posée par un update CONDITIONNEL : deux bascules simultanées ne peuvent pas
      // diffuser toutes les deux.
      expect(prismaMock.editionShowCall.updateMany).toHaveBeenCalledWith({
        where: { id: 1, openedNotifiedAt: null },
        data: { openedNotifiedAt: expect.any(Date) },
      })

      // Rien n'a encore été diffusé quand la réponse part : c'est tout l'objet du renvoi.
      expect(prismaMock.user.findMany).not.toHaveBeenCalled()

      await laisserPasserLaDiffusion()
      expect(prismaMock.user.findMany).toHaveBeenCalledWith({
        where: { isArtist: true },
        select: { id: true },
      })
    })

    it('ne rediffuse pas à la deuxième bascule en PUBLIC', async () => {
      // Le cas du constat : l'appel a déjà été annoncé, on le referme, on le rouvre.
      prismaMock.editionShowCall.findFirst.mockResolvedValue({
        ...mockShowCall,
        visibility: 'CLOSED',
        openedNotifiedAt: new Date('2026-09-01'),
      })

      const result = await handler({ context: { user: mockUser } } as any)

      expect(result.success).toBe(true)
      expect(prismaMock.editionShowCall.updateMany).not.toHaveBeenCalled()

      await laisserPasserLaDiffusion()
      expect(prismaMock.user.findMany).not.toHaveBeenCalled()
    })

    it('ne diffuse pas quand l’appel était déjà public', async () => {
      prismaMock.editionShowCall.findFirst.mockResolvedValue({
        ...mockShowCall,
        visibility: 'PUBLIC',
      })

      await handler({ context: { user: mockUser } } as any)

      expect(prismaMock.editionShowCall.updateMany).not.toHaveBeenCalled()
      await laisserPasserLaDiffusion()
      expect(prismaMock.user.findMany).not.toHaveBeenCalled()
    })

    it('ne diffuse pas si une autre requête a pris la marque entre-temps', async () => {
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
      // L'update conditionnel n'a touché aucune ligne : quelqu'un d'autre est passé avant.
      prismaMock.editionShowCall.updateMany.mockResolvedValue({ count: 0 })

      await handler({ context: { user: mockUser } } as any)

      await laisserPasserLaDiffusion()
      expect(prismaMock.user.findMany).not.toHaveBeenCalled()
    })

    it('n’attend pas la diffusion pour répondre', async () => {
      // La preuve que le renvoi fonctionne : la liste des artistes n'est même pas encore lue.
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
      prismaMock.user.findMany.mockResolvedValue(
        Array.from({ length: 45 }, (_, i) => ({ id: 100 + i }))
      )

      const result = await handler({ context: { user: mockUser } } as any)

      expect(result.success).toBe(true)
      expect(prismaMock.user.findMany).not.toHaveBeenCalled()

      // Vider la file avant de rendre la main : une diffusion laissée en attente arriverait
      // pendant le test suivant et s'ajouterait à son compte. C'est ce qui s'est produit ici même,
      // 45 annonces devenant 90.
      await laisserPasserLaDiffusion()
    })

    it('utilise event.waitUntil quand la plate-forme en propose un', async () => {
      // En production, Nitro pose `waitUntil` sur l'événement. Le repli `setImmediate` ne doit pas
      // être le seul chemin testé, sinon le chemin réel ne l'est jamais.
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
      const waitUntil = vi.fn()

      await handler({ context: { user: mockUser }, waitUntil } as any)

      expect(waitUntil).toHaveBeenCalledTimes(1)
      expect(waitUntil.mock.calls[0][0]).toBeInstanceOf(Promise)
      await waitUntil.mock.calls[0][0]
      expect(prismaMock.user.findMany).toHaveBeenCalled()
    })

    it('n’oublie et ne double aucun artiste, au-delà d’une tranche', async () => {
      // 45 artistes pour des tranches de 20 : deux tranches pleines et une partielle. C'est là que
      // se logerait un décalage d'indice dans le découpage — et il ne se verrait pas avec 20.
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
      const artistes = Array.from({ length: 45 }, (_, i) => ({ id: 100 + i }))
      prismaMock.user.findMany.mockResolvedValue(artistes)

      await handler({ context: { user: mockUser } } as any)
      await laisserPasserLaDiffusion()

      expect(annonceEmise).toHaveBeenCalledTimes(45)
      const destinataires = annonceEmise.mock.calls.map((appel: unknown[]) => appel[0])
      expect(new Set(destinataires).size).toBe(45)
      expect(destinataires.sort((a: number, b: number) => a - b)).toEqual(artistes.map((a) => a.id))
      // Le nom de l'appel et celui de l'édition accompagnent bien chaque annonce.
      expect(annonceEmise).toHaveBeenCalledWith(100, mockShowCall.name, mockEdition.name, 1)
    })

    it('ne touche à rien quand la bascule n’est pas vers PUBLIC', async () => {
      prismaMock.editionShowCall.findFirst.mockResolvedValue(mockShowCall)
      global.readBody.mockResolvedValue({ visibility: 'PRIVATE' })
      prismaMock.editionShowCall.update.mockResolvedValue({
        ...mockShowCall,
        visibility: 'PRIVATE',
      })

      await handler({ context: { user: mockUser } } as any)

      expect(prismaMock.editionShowCall.updateMany).not.toHaveBeenCalled()
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
        visibility: 'PUBLIC',
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
      prismaMock.editionShowCall.update.mockResolvedValue({ ...mockShowCall, visibility: 'PUBLIC' })
      prismaMock.user.findMany.mockResolvedValue([]) // Artistes pour notification

      global.readBody.mockResolvedValue({ visibility: 'PUBLIC' })
      const mockEvent = { context: { user: adminUser } }

      const result = await handler(mockEvent as any)

      expect(result.success).toBe(true)
    })
  })
})
