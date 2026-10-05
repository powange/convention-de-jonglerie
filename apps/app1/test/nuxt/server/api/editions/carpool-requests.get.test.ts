import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../../../layers/carpool/server/api/editions/[id]/carpool-requests/index.get'
import { global } from '../../../globales-nitro'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const mockEvent = {
  context: {
    params: { id: '1' },
    query: {},
    user: undefined,
  },
}

describe('/api/editions/[id]/carpool-requests GET', () => {
  beforeEach(() => {
    prismaMock.carpoolRequest.findMany.mockReset()
    global.getQuery = vi.fn().mockReturnValue({})
  })

  it('devrait retourner les demandes de covoiturage avec emails masqués', async () => {
    const mockRequests = [
      {
        id: 1,
        editionId: 1,
        userId: 1,
        tripDate: new Date('2024-07-15T08:00:00Z'),
        locationCity: 'Lyon',
        seatsNeeded: 2,
        description: 'Cherche covoiturage',
        phoneNumber: '0123456789',
        createdAt: new Date('2024-01-01'),
        user: {
          id: 1,
          pseudo: 'passenger1',
          emailHash: 'passenger-hash',
          profilePicture: null,
          updatedAt: new Date('2024-01-01'),
        },
        // Le compte, tel que `carpoolRequestListInclude` le demande désormais. La carte d'une
        // demande ne lisait même pas la conversation : elle laissait sa modale la redemander, une
        // requête par carte affichée.
        _count: { comments: 1 },
      },
    ]

    prismaMock.carpoolRequest.findMany.mockResolvedValue(mockRequests)

    const result = await handler(mockEvent as any)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 1,
      editionId: 1,
      userId: 1,
      tripDate: new Date('2024-07-15T08:00:00Z'),
      locationCity: 'Lyon',
      // La ligne mockée n'en porte pas : `null` et non `undefined`, car la transformation normalise.
      // `toEqual` étant exhaustif, c'est bien ici que l'exposition des deux champs se vérifie.
      latitude: null,
      longitude: null,
      seatsNeeded: 2,
      direction: undefined,
      description: 'Cherche covoiturage',
      hasPhoneNumber: true,
      phoneNumber: null, // Non authentifié -> masqué
      createdAt: new Date('2024-01-01'),
      updatedAt: undefined,
      user: {
        id: 1,
        pseudo: 'passenger1',
        emailHash: 'passenger-hash',
        profilePicture: null,
        updatedAt: new Date('2024-01-01'),
      },
      // `toEqual` est exhaustif : l'absence d'une clé `comments` est donc vérifiée ici même.
      commentsCount: 1,
    })

    expect(prismaMock.carpoolRequest.findMany).toHaveBeenCalledWith({
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
        _count: { select: { comments: true } },
      },
      orderBy: { tripDate: 'asc' },
    })
  })

  it("devrait rejeter un ID d'édition invalide", async () => {
    const eventWithBadId = {
      context: {
        params: { id: 'invalid' },
        query: {},
        user: undefined,
      },
    }

    await expect(handler(eventWithBadId as any)).rejects.toThrow("ID d'édition invalide")
  })

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.carpoolRequest.findMany.mockRejectedValue(new Error('Database error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
  })

  it("devrait retourner un tableau vide s'il n'y a pas de demandes", async () => {
    prismaMock.carpoolRequest.findMany.mockResolvedValue([])

    const result = await handler(mockEvent as any)

    expect(result).toEqual([])
  })

  it('devrait trier les demandes par date de départ croissante', async () => {
    const mockRequests = [
      {
        id: 2,
        tripDate: new Date('2024-07-16T10:00:00Z'),
        locationCity: 'Marseille',
        user: {
          id: 2,
          pseudo: 'user2',
          emailHash: 'hash2',
          profilePicture: null,
          updatedAt: new Date(),
        },
        _count: { comments: 0 },
      },
      {
        id: 1,
        tripDate: new Date('2024-07-15T08:00:00Z'),
        locationCity: 'Lyon',
        user: {
          id: 1,
          pseudo: 'user1',
          emailHash: 'hash1',
          profilePicture: null,
          updatedAt: new Date(),
        },
        _count: { comments: 0 },
      },
    ]

    prismaMock.carpoolRequest.findMany.mockResolvedValue(mockRequests)

    await handler(mockEvent as any)

    expect(prismaMock.carpoolRequest.findMany).toHaveBeenCalledWith({
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
        _count: { select: { comments: true } },
      },
      orderBy: { tripDate: 'asc' }, // Vérification du tri
    })
  })

  it('devrait gérer les demandes sans commentaires', async () => {
    const mockRequests = [
      {
        id: 1,
        editionId: 1,
        userId: 1,
        tripDate: new Date('2024-07-15T08:00:00Z'),
        locationCity: 'Lyon',
        seatsNeeded: 1,
        user: {
          id: 1,
          pseudo: 'passenger1',
          emailHash: 'hash1',
          profilePicture: null,
          updatedAt: new Date(),
        },
        _count: { comments: 0 },
      },
    ]

    prismaMock.carpoolRequest.findMany.mockResolvedValue(mockRequests)

    const result = await handler(mockEvent as any)

    expect(result[0].commentsCount).toBe(0)
    expect(result[0]).not.toHaveProperty('comments')
  })

  /*
   * DEUX TESTS RETIRÉS ICI, et où leur objet a déménagé.
   *
   * « trier les commentaires par date décroissante » : ce point d'API ne charge plus les
   * commentaires, il n'a donc plus d'ordre à leur donner. Rien n'est perdu — la conversation se lit
   * par `GET /api/carpool-requests/:id/comments`, qui la rend en ordre CROISSANT
   * (`commentsHandler.ts`), ce qui est l'ordre d'une conversation. Le tri décroissant de la liste
   * contredisait d'ailleurs celui de la modale qui affichait ces mêmes commentaires.
   *
   * « masquer les emails des commentaires » : l'auteur d'un commentaire n'arrive plus par ici. Le
   * masquage se vérifie sur `transformCarpoolOffer`/`transformCarpoolRequest` eux-mêmes, dans
   * test/unit/utils/carpool-transform.test.ts, qui les reçoit toujours par le détail.
   *
   * Le masquage de l'email de l'auteur d'une DEMANDE, lui, reste vérifié dans le premier test de ce
   * fichier.
   */

  it("devrait traiter correctement l'ID numérique", async () => {
    const eventWithStringId = {
      context: {
        params: { id: '123' },
        query: {},
        user: undefined,
      },
    }

    prismaMock.carpoolRequest.findMany.mockResolvedValue([])

    await handler(eventWithStringId as any)

    expect(prismaMock.carpoolRequest.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        editionId: 123,
        tripDate: expect.objectContaining({ gte: expect.any(Date) }),
      }), // Converti en nombre
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
        _count: { select: { comments: true } },
      },
      orderBy: { tripDate: 'asc' },
    })
  })
})
