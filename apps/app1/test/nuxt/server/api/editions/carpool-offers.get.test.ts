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
   * L'offre de référence : trois réservations, une par statut, pour que le filtre appliqué par
   * `transformCarpoolOffer` ait quelque chose à trancher. Le conducteur est l'utilisateur 1, le
   * passager accepté l'utilisateur 2.
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
      {
        id: 11,
        carpoolOfferId: 1,
        requestId: null,
        seats: 1,
        message: 'Reste-t-il une place ? Mon numéro : 06 11 22 33 44',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
        requesterId: 4,
        requester: {
          id: 4,
          emailHash: 'hash4',
          pseudo: 'candidat',
          profilePicture: null,
          updatedAt: new Date(),
        },
      },
      {
        id: 12,
        carpoolOfferId: 1,
        requestId: null,
        seats: 1,
        message: 'Finalement non, désolé',
        status: 'REJECTED',
        createdAt: new Date(),
        updatedAt: new Date(),
        requesterId: 5,
        requester: {
          id: 5,
          emailHash: 'hash5',
          pseudo: 'econduit',
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
    comments: [
      {
        id: 1,
        content: 'Intéressé !',
        createdAt: new Date(),
        user: {
          id: 3,
          emailHash: 'hash3',
          pseudo: 'commenter',
          profilePicture: null,
          updatedAt: new Date(),
        },
      },
    ],
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
        comments: {
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
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { tripDate: 'asc' },
    })

    expect(result).toHaveLength(1)
    expect(result[0].user.emailHash).toBe('hash1')
    expect(result[0].user).not.toHaveProperty('email') // Email doit être masqué
    expect(result[0].passengers[0].user.emailHash).toBe('hash2')
    expect(result[0].comments[0].user.emailHash).toBe('hash3')

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

  it('rend au conducteur la liste complète de ses réservations, messages compris', async () => {
    const eventDuConducteur = {
      context: { params: { id: '1' }, query: {}, user: { id: 1 } },
    } as unknown as H3Event

    prismaMock.carpoolOffer.findMany.mockResolvedValue([offreMockee()])

    const result = await handler(eventDuConducteur)

    expect(result[0].bookings.map((b: any) => b.status)).toEqual([
      'ACCEPTED',
      'PENDING',
      'REJECTED',
    ])
    expect(result[0].bookings.map((b: any) => b.message)).toEqual([
      'Je monte à Orléans, merci !',
      'Reste-t-il une place ? Mon numéro : 06 11 22 33 44',
      'Finalement non, désolé',
    ])
    // Le même chiffre que pour l'anonyme : il ne dépend pas du nombre de réservations montrées.
    expect(result[0].remainingSeats).toBe(2)
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
        comments: [],
      },
      {
        id: 2,
        tripDate: new Date('2024-06-15T10:00:00Z'),
        user: { id: 2, emailHash: 'hash2', pseudo: 'user2' },
        bookings: [],
        passengers: [],
        comments: [],
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
        comments: [
          {
            id: 1,
            content: 'Test comment',
            createdAt: new Date(),
            user: {
              id: 3,
              emailHash: 'commenter-hash',
              pseudo: 'commenter',
              profilePicture: null,
              updatedAt: new Date(),
            },
          },
        ],
      },
    ]

    prismaMock.carpoolOffer.findMany.mockResolvedValue(mockOffers)

    const result = await handler(mockEvent)

    // Vérifier que les emails sont masqués et remplacés par des hash
    expect(result[0].user).not.toHaveProperty('email')
    expect(result[0].user.emailHash).toBe('driver-hash')

    expect(result[0].passengers[0].user).not.toHaveProperty('email')
    expect(result[0].passengers[0].user.emailHash).toBe('passenger-hash')

    expect(result[0].comments[0].user).not.toHaveProperty('email')
    expect(result[0].comments[0].user.emailHash).toBe('commenter-hash')
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
        comments: [],
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
