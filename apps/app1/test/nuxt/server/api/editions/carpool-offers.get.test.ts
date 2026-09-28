import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../../layers/carpool/server/api/editions/[id]/carpool-offers/index.get'
import { global } from '../../../globales-nitro'
import type { H3Event } from 'h3'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('GET /api/editions/[id]/carpool-offers', () => {
  const mockEvent = {
    context: {
      params: {
        id: '1',
      },
      query: {},
      user: undefined,
    },
  } as unknown as H3Event

  beforeEach(() => {
    prismaMock.carpoolOffer.findMany.mockReset()
    global.getQuery = vi.fn().mockReturnValue({})
  })

  /**
   * L'offre de référence, telle que la base la rend POUR CE POINT D'API : la réservation acceptée
   * seule, et le nombre de commentaires sans leur contenu.
   *
   * La version précédente portait trois réservations, une par statut, et la conversation complète.
   * Elle décrivait un état que la requête ne produit plus — `carpoolOfferListInclude` filtre sur
   * `ACCEPTED` et ne demande que `_count`. Un mock ignorant le `where`, les assertions bâties
   * dessus restaient vertes tout en parlant d'une forme qui n'existe pas.
   *
   * Le conducteur est l'utilisateur 1, le passager accepté l'utilisateur 2.
   */
  const offreMockee = () => ({
    id: 1,
    editionId: 1,
    userId: 1,
    tripDate: new Date('2024-06-15T10:00:00Z'),
    locationCity: 'Paris',
    locationAddress: '123 rue de la Paix',
    availableSeats: 3,
    description: 'Covoiturage vers convention',
    user: {
      id: 1,
      emailHash: 'hash1',
      pseudo: 'testuser',
      profilePicture: null,
      updatedAt: new Date(),
    },
    bookings: [
      {
        id: 10,
        carpoolOfferId: 1,
        requestId: null,
        seats: 1,
        message: 'Je monte à Orléans, merci !',
        status: 'ACCEPTED',
        createdAt: new Date(),
        updatedAt: new Date(),
        requesterId: 2,
        requester: {
          id: 2,
          emailHash: 'hash2',
          pseudo: 'passenger1',
          profilePicture: null,
          updatedAt: new Date(),
        },
      },
    ],
    passengers: [
      {
        id: 1,
        addedAt: new Date(),
        user: {
          id: 2,
          emailHash: 'hash2',
          pseudo: 'passenger1',
          profilePicture: null,
          updatedAt: new Date(),
        },
      },
    ],
    _count: { comments: 1 },
  })

  it('devrait récupérer les offres de covoiturage avec succès', async () => {
    prismaMock.carpoolOffer.findMany.mockResolvedValue([offreMockee()])

    const result = await handler(mockEvent)

    expect(prismaMock.carpoolOffer.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        editionId: 1,
        tripDate: expect.objectContaining({ gte: expect.any(Date) }),
      }),
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            emailHash: true,
            profilePicture: true,
            updatedAt: true,
          },
        },
        bookings: {
          // La base ne rend plus que les acceptées : la carte n'a jamais lu les autres.
          where: { status: 'ACCEPTED' },
          include: {
            requester: {
              select: {
                id: true,
                pseudo: true,
                emailHash: true,
                profilePicture: true,
                updatedAt: true,
              },
            },
          },
        },
        passengers: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                emailHash: true,
                profilePicture: true,
                updatedAt: true,
              },
            },
          },
          orderBy: { addedAt: 'asc' },
        },
        // Le NOMBRE de commentaires, pas la conversation. C'est tout ce que la carte affiche.
        _count: { select: { comments: true } },
      },
      orderBy: { tripDate: 'asc' },
    })

    expect(result).toHaveLength(1)
    expect(result[0].user.emailHash).toBe('hash1')
    expect(result[0].user).not.toHaveProperty('email') // Email doit être masqué
    expect(result[0].passengers[0].user.emailHash).toBe('hash2')
    expect(result[0].commentsCount).toBe(1)
    // Absent, et non pas vide : `comments: []` se lirait « aucun commentaire » alors que le compte
    // en annonce un. C'est une contradiction qui ne lève aucune erreur.
    expect(result[0]).not.toHaveProperty('comments')

    /*
     * Ce point d'API est PUBLIC : `mockEvent` n'a pas d'utilisateur. Un visiteur anonyme ne reçoit
     * que la réservation acceptée — les demandes en attente ou refusées ne le regardent pas — et
     * aucun message, qui n'est adressé qu'au conducteur.
     */
    expect(result[0].bookings.map((b: any) => b.status)).toEqual(['ACCEPTED'])
    expect(result[0].bookings[0]).not.toHaveProperty('message')
    // Le demandeur reste nommé : `passengers`, juste à côté, expose déjà publiquement ces personnes.
    expect(result[0].bookings[0].requester.emailHash).toBe('hash2')
    // 3 places, 1 prise par l'acceptée. Compté sur les places, pas sur les réservations montrées.
    expect(result[0].remainingSeats).toBe(2)
  })

  it('ne rend aucun message de réservation à un passager, pas même le sien', async () => {
    /*
     * Le passager 2 est l'auteur du message de la réservation acceptée. Il le relit par
     * `GET /carpool-offers/:id/bookings`, qui le lui rend — le lui refuser ici évite d'avoir deux
     * règles à tenir d'accord sur la même donnée.
     */
    const eventDuPassager = {
      context: { params: { id: '1' }, query: {}, user: { id: 2 } },
    } as unknown as H3Event

    prismaMock.carpoolOffer.findMany.mockResolvedValue([offreMockee()])

    const result = await handler(eventDuPassager)

    expect(result[0].bookings.map((b: any) => b.status)).toEqual(['ACCEPTED'])
    expect(result[0].bookings[0]).not.toHaveProperty('message')
    // Recherche dans la charge ENTIÈRE : un message qui ressortirait par un autre chemin serait
    // attrapé ici, là où une vérification champ par champ le laisserait passer.
    const serialise = JSON.stringify(result)
    for (const message of offreMockee().bookings.map((b) => b.message)) {
      expect(serialise, message).not.toContain(message)
    }
  })

  it('rend au conducteur le message de ses réservations acceptées, et rien de plus', async () => {
    /*
     * Ce test disait autrefois « la liste COMPLÈTE de ses réservations, messages compris », et
     * vérifiait les trois statuts. Il ne le peut plus : la requête filtre sur `ACCEPTED`, donc les
     * demandes en attente ou refusées n'arrivent tout simplement pas jusqu'ici. Le conducteur les
     * consulte par `GET /carpool-offers/:id/bookings` et par le détail de l'offre, qui n'ont pas
     * changé.
     *
     * Ce qui reste propre au conducteur, et qui se vérifie : le message lui est rendu, alors qu'il
     * est retiré à tout autre.
     */
    const eventDuConducteur = {
      context: { params: { id: '1' }, query: {}, user: { id: 1 } },
    } as unknown as H3Event

    prismaMock.carpoolOffer.findMany.mockResolvedValue([offreMockee()])

    const result = await handler(eventDuConducteur)

    expect(result[0].bookings.map((b: any) => b.message)).toEqual(['Je monte à Orléans, merci !'])
    // Le même chiffre que pour l'anonyme : il ne dépend pas du nombre de réservations montrées.
    expect(result[0].remainingSeats).toBe(2)
  })

  it('ne demande à la base que les réservations acceptées', async () => {
    /*
     * L'assertion qui porte réellement la restriction. Le mock de Prisma ignore le `where`, donc
     * aucune vérification sur la charge rendue ne pourrait prouver que les réservations en attente
     * ne sont plus transportées — seule la REQUÊTE le dit.
     */
    prismaMock.carpoolOffer.findMany.mockResolvedValue([offreMockee()])

    await handler(mockEvent)

    const { include } = prismaMock.carpoolOffer.findMany.mock.calls[0][0]
    expect(include.bookings.where).toEqual({ status: 'ACCEPTED' })
    expect(include).not.toHaveProperty('comments')
    expect(include._count).toEqual({ select: { comments: true } })
  })

  it("devrait échouer avec ID d'édition invalide", async () => {
    const eventWithInvalidId = {
      context: {
        params: {
          id: 'invalid',
        },
        query: {},
        user: undefined,
      },
    } as unknown as H3Event

    await expect(handler(eventWithInvalidId)).rejects.toThrow("ID d'édition invalide")
  })

  it("devrait échouer sans ID d'édition", async () => {
    const eventWithoutId = {
      context: {
        params: {},
        query: {},
        user: undefined,
      },
    } as unknown as H3Event

    await expect(handler(eventWithoutId)).rejects.toThrow("ID d'édition invalide")
  })

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.carpoolOffer.findMany.mockRejectedValue(new Error('DB Error'))

    await expect(handler(mockEvent)).rejects.toThrow('Erreur serveur interne')
  })

  it('devrait retourner un tableau vide si aucune offre', async () => {
    prismaMock.carpoolOffer.findMany.mockResolvedValue([])

    const result = await handler(mockEvent)

    expect(result).toEqual([])
  })

  it('devrait trier par date de départ croissante', async () => {
    const mockOffers = [
      {
        id: 1,
        tripDate: new Date('2024-06-20T10:00:00Z'),
        user: { id: 1, emailHash: 'hash1', pseudo: 'user1' },
        bookings: [],
        passengers: [],
        _count: { comments: 0 },
      },
      {
        id: 2,
        tripDate: new Date('2024-06-15T10:00:00Z'),
        user: { id: 2, emailHash: 'hash2', pseudo: 'user2' },
        bookings: [],
        passengers: [],
        _count: { comments: 0 },
      },
    ]

    prismaMock.carpoolOffer.findMany.mockResolvedValue(mockOffers)

    await handler(mockEvent)

    expect(prismaMock.carpoolOffer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { tripDate: 'asc' },
      })
    )
  })

  it('devrait masquer tous les emails et ajouter les hash', async () => {
    const mockOffers = [
      {
        id: 1,
        user: {
          id: 1,
          emailHash: 'driver-hash',
          pseudo: 'driver',
          profilePicture: 'avatar.jpg',
          updatedAt: new Date(),
        },
        bookings: [],
        passengers: [
          {
            id: 1,
            addedAt: new Date(),
            user: {
              id: 2,
              emailHash: 'passenger-hash',
              pseudo: 'passenger',
              profilePicture: null,
              updatedAt: new Date(),
            },
          },
        ],
        _count: { comments: 1 },
      },
    ]

    prismaMock.carpoolOffer.findMany.mockResolvedValue(mockOffers)

    const result = await handler(mockEvent)

    // Vérifier que les emails sont masqués et remplacés par des hash
    expect(result[0].user).not.toHaveProperty('email')
    expect(result[0].user.emailHash).toBe('driver-hash')

    expect(result[0].passengers[0].user).not.toHaveProperty('email')
    expect(result[0].passengers[0].user.emailHash).toBe('passenger-hash')

    // La conversation n'arrive plus par ce point d'API, seul son compte. Le masquage de l'email de
    // l'auteur d'un commentaire est vérifié là où il se joue désormais :
    // test/unit/utils/carpool-transform.test.ts.
    expect(result[0].commentsCount).toBe(1)
    expect(result[0]).not.toHaveProperty('comments')
  })

  it('devrait préserver les autres propriétés des utilisateurs', async () => {
    const mockOffers = [
      {
        id: 1,
        user: {
          id: 1,
          emailHash: 'test-hash',
          pseudo: 'testuser',
          profilePicture: 'avatar.jpg',
          updatedAt: new Date('2024-01-01'),
        },
        bookings: [],
        passengers: [],
        _count: { comments: 0 },
      },
    ]

    prismaMock.carpoolOffer.findMany.mockResolvedValue(mockOffers)

    const result = await handler(mockEvent)

    expect(result[0].user).toEqual({
      id: 1,
      pseudo: 'testuser',
      emailHash: 'test-hash',
      profilePicture: 'avatar.jpg',
      updatedAt: new Date('2024-01-01'),
    })
  })

  it('devrait parser correctement les IDs numériques', async () => {
    const eventWithStringId = {
      context: {
        params: {
          id: '123',
        },
        query: {},
        user: undefined,
      },
    } as unknown as H3Event

    prismaMock.carpoolOffer.findMany.mockResolvedValue([])

    await handler(eventWithStringId)

    expect(prismaMock.carpoolOffer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          editionId: 123,
          tripDate: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      })
    )
  })
})
