import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../server/api/user/show-applications.get'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

vi.mock('../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event: any) => {
    if (!event.context.user) {
      const error = new Error('Non authentifié')
      ;(error as any).statusCode = 401
      throw error
    }
    return event.context.user
  }),
}))

describe('/api/user/show-applications GET', () => {
  const mockUser = {
    id: 1,
    email: 'artist@example.com',
    pseudo: 'artistuser',
    isGlobalAdmin: false,
  }

  const mockConvention = {
    id: 1,
    name: 'Convention de Jonglerie',
    logo: 'https://example.com/logo.png',
  }

  const mockEdition = {
    id: 1,
    name: 'Édition 2025',
    startDate: new Date('2025-07-01'),
    endDate: new Date('2025-07-05'),
    city: 'Paris',
    country: 'France',
    imageUrl: 'https://example.com/edition.jpg',
    convention: mockConvention,
  }

  const mockShowCall = {
    id: 1,
    name: 'Appel à spectacles principal',
    visibility: 'PUBLIC',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    edition: mockEdition,
  }

  const mockApplication = {
    id: 1,
    status: 'PENDING',
    artistName: 'John Doe',
    showTitle: 'Mon super spectacle',
    showDescription: 'Description du spectacle',
    showDuration: 30,
    showCategory: 'JONGLERIE',
    additionalPerformersCount: 2,
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
    // Pas d'`organizerNotes` : le `select` du handler ne le demande plus, donc la base ne le
    // renvoie plus. Le laisser ici décrirait une forme qui n'existe pas.
    decidedAt: null,
    showCall: mockShowCall,
    // La conversation, que le `select` du handler demande désormais pour rattacher le compte de
    // non-lus. `null` quand aucune discussion n'a été ouverte — le cas le plus courant.
    conversation: { id: 'conv-1' },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentification', () => {
    it("devrait rejeter avec 401 si l'utilisateur n'est pas authentifié", async () => {
      const mockEvent = { context: {} }

      await expect(handler(mockEvent as any)).rejects.toThrow('Non authentifié')

      expect(prismaMock.showApplication.findMany).not.toHaveBeenCalled()
    })

    it('devrait retourner les candidatures pour un utilisateur authentifié', async () => {
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([mockApplication])

      const result = await handler(mockEvent as any)

      expect(result).toHaveLength(1)
    })
  })

  describe('Filtrage par utilisateur', () => {
    it("devrait filtrer les candidatures par l'ID de l'utilisateur", async () => {
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([])

      await handler(mockEvent as any)

      expect(prismaMock.showApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUser.id },
        })
      )
    })

    it("devrait retourner uniquement les candidatures de l'utilisateur", async () => {
      const anotherUser = { ...mockUser, id: 2 }
      const mockEvent = { context: { user: anotherUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([])

      await handler(mockEvent as any)

      expect(prismaMock.showApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 2 },
        })
      )
    })
  })

  describe('Données retournées', () => {
    it('devrait retourner les informations de la candidature', async () => {
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([mockApplication])

      const result = await handler(mockEvent as any)

      expect(result[0]).toMatchObject({
        id: mockApplication.id,
        status: mockApplication.status,
        artistName: mockApplication.artistName,
        showTitle: mockApplication.showTitle,
        showDescription: mockApplication.showDescription,
        showDuration: mockApplication.showDuration,
        showCategory: mockApplication.showCategory,
        additionalPerformersCount: mockApplication.additionalPerformersCount,
      })
    })

    it("devrait inclure les informations de l'appel à spectacles", async () => {
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([mockApplication])

      const result = await handler(mockEvent as any)

      expect(result[0].showCall).toMatchObject({
        id: mockShowCall.id,
        name: mockShowCall.name,
        visibility: mockShowCall.visibility,
        deadline: mockShowCall.deadline,
      })
    })

    it("devrait inclure les informations de l'édition", async () => {
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([mockApplication])

      const result = await handler(mockEvent as any)

      expect(result[0].showCall.edition).toMatchObject({
        id: mockEdition.id,
        name: mockEdition.name,
        city: mockEdition.city,
        country: mockEdition.country,
      })
    })

    it('devrait inclure les informations de la convention', async () => {
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([mockApplication])

      const result = await handler(mockEvent as any)

      expect(result[0].showCall.edition.convention).toMatchObject({
        id: mockConvention.id,
        name: mockConvention.name,
        logo: mockConvention.logo,
      })
    })

    it('ne demande jamais les notes internes de l’organisateur à la base', async () => {
      // La garde porte sur le `select`, et c'est donc lui qu'on regarde : le mock de Prisma ignore
      // le `select` et renvoie ce qu'on lui donne, si bien qu'une assertion sur l'objet retourné
      // ne prouverait rien du tout — elle testerait le mock.
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([mockApplication])

      await handler(mockEvent as any)

      const { select } = prismaMock.showApplication.findMany.mock.calls[0][0]
      expect(select).not.toHaveProperty('organizerNotes')
      // La contrepartie : sans elle, un `select` vide passerait ce test.
      expect(select).toHaveProperty('showTitle', true)
    })

    it('devrait inclure la date de décision', async () => {
      const applicationDecidee = {
        ...mockApplication,
        status: 'ACCEPTED',
        decidedAt: new Date('2025-01-20'),
      }
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([applicationDecidee])

      const result = await handler(mockEvent as any)

      expect(result[0].decidedAt).toBeDefined()
    })
  })

  describe('Statuts des candidatures', () => {
    it('devrait retourner les candidatures en attente', async () => {
      const pendingApplication = { ...mockApplication, status: 'PENDING' }
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([pendingApplication])

      const result = await handler(mockEvent as any)

      expect(result[0].status).toBe('PENDING')
    })

    it('devrait retourner les candidatures acceptées', async () => {
      const acceptedApplication = {
        ...mockApplication,
        status: 'ACCEPTED',
        decidedAt: new Date('2025-01-20'),
      }
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([acceptedApplication])

      const result = await handler(mockEvent as any)

      expect(result[0].status).toBe('ACCEPTED')
    })

    it('devrait retourner les candidatures refusées', async () => {
      const rejectedApplication = {
        ...mockApplication,
        status: 'REJECTED',
        decidedAt: new Date('2025-01-20'),
      }
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([rejectedApplication])

      const result = await handler(mockEvent as any)

      expect(result[0].status).toBe('REJECTED')
    })
  })

  describe('Tri des résultats', () => {
    it('devrait trier par date de création décroissante', async () => {
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([])

      await handler(mockEvent as any)

      expect(prismaMock.showApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      )
    })
  })

  describe('Plusieurs candidatures', () => {
    it('devrait retourner plusieurs candidatures', async () => {
      const application2 = {
        ...mockApplication,
        id: 2,
        showTitle: 'Deuxième spectacle',
        showCall: {
          ...mockShowCall,
          id: 2,
          name: 'Autre appel',
        },
      }
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([mockApplication, application2])

      const result = await handler(mockEvent as any)

      expect(result).toHaveLength(2)
    })

    it('devrait retourner un tableau vide si aucune candidature', async () => {
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockResolvedValue([])

      const result = await handler(mockEvent as any)

      expect(result).toHaveLength(0)
    })
  })

  describe('Gestion des erreurs', () => {
    it('devrait gérer les erreurs de base de données', async () => {
      const mockEvent = { context: { user: mockUser } }

      prismaMock.showApplication.findMany.mockRejectedValue(new Error('Database error'))

      await expect(handler(mockEvent as any)).rejects.toThrow()
    })
  })
  /**
   * Les messages en attente de chaque candidature.
   *
   * ## Le défaut que ces cas ferment
   *
   * Il existait `GET /api/show-applications/[id]/unread-count`, que **personne n'appelait**, et
   * aucun écran ne signalait qu'une discussion attendait une réponse : il fallait ouvrir chaque
   * fiche pour le savoir.
   *
   * ⚠️ Le point d'API mort était aussi **divergent** — il comptait depuis `lastReadMessageId` et
   * **n'excluait pas les messages de la personne elle-même**, là où le service partagé emploie
   * `lastReadAt` et les exclut. Il aurait donc annoncé à l'organisateur ses propres messages comme
   * non lus : une pastille qui ne s'éteint jamais, puisque répondre l'aurait fait monter.
   *
   * 📍 `$queryRaw` existe dans le mock central mais rend `undefined` par défaut : un test qui
   * oublie de le garnir lève sur `.map`. C'est un échec utile — il ne peut pas se lire comme un
   * zéro — mais il faut le savoir avant de conclure que ce point d'API n'est pas testable.
   */
  describe('messages non lus', () => {
    it('rend le compte de la conversation de chaque candidature', async () => {
      const mockEvent = { context: { user: mockUser } }
      prismaMock.showApplication.findMany.mockResolvedValue([mockApplication])
      prismaMock.$queryRaw.mockResolvedValue([{ conversationId: 'conv-1', nonLus: 3 }])

      const result: any = await handler(mockEvent as any)
      expect(result[0].unreadMessages).toBe(3)
    })

    it('rend 0 quand la conversation n’a aucun message non lu', async () => {
      /*
       * ⚠️ Le service ne rend QUE les conversations qui ont au moins un non-lu : l'absence de la
       * ligne est le cas NORMAL, pas une anomalie. L'appelant doit donc lire `?? 0`, et non
       * supposer que toute conversation a son entrée.
       */
      const mockEvent = { context: { user: mockUser } }
      prismaMock.showApplication.findMany.mockResolvedValue([mockApplication])
      prismaMock.$queryRaw.mockResolvedValue([])

      const result: any = await handler(mockEvent as any)
      expect(result[0].unreadMessages).toBe(0)
    })

    it('rend 0 pour une candidature sans conversation', async () => {
      const mockEvent = { context: { user: mockUser } }
      prismaMock.showApplication.findMany.mockResolvedValue([
        { ...mockApplication, conversation: null },
      ])
      prismaMock.$queryRaw.mockResolvedValue([{ conversationId: 'conv-1', nonLus: 3 }])

      const result: any = await handler(mockEvent as any)
      expect(result[0].unreadMessages).toBe(0)
    })

    it('n’interroge pas la base quand aucune candidature n’a de conversation', async () => {
      // Une requête qui n'aurait rien à compter : sur une liste de candidatures sans discussion,
      // c'est le cas le plus fréquent.
      const mockEvent = { context: { user: mockUser } }
      prismaMock.showApplication.findMany.mockResolvedValue([
        { ...mockApplication, conversation: null },
      ])

      await handler(mockEvent as any)
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
    })

    it('demande la conversation dans le select', async () => {
      /*
       * ⚠️ L'ASSERTION QUI N'EST PAS CREUSE. Le mock central IGNORE le `select` : il rend ce qu'on
       * lui a dit de rendre, donc tous les cas ci-dessus resteraient VERTS si le handler cessait de
       * demander la conversation — et en production le compte retomberait silencieusement à 0.
       */
      const mockEvent = { context: { user: mockUser } }
      prismaMock.showApplication.findMany.mockResolvedValue([])

      await handler(mockEvent as any)
      expect(prismaMock.showApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({ conversation: { select: { id: true } } }),
        })
      )
    })

    it('ne compte que pour la personne qui demande', async () => {
      // Le `userId` passé au service est celui de la session, jamais un identifiant du corps ou de
      // l'URL : sinon on afficherait les non-lus de quelqu'un d'autre.
      const mockEvent = { context: { user: mockUser } }
      prismaMock.showApplication.findMany.mockResolvedValue([mockApplication])
      prismaMock.$queryRaw.mockResolvedValue([])

      await handler(mockEvent as any)
      const appel = prismaMock.$queryRaw.mock.calls[0]
      expect(JSON.stringify(appel)).toContain(String(mockUser.id))
    })
  })
})
