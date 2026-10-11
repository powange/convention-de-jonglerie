import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockGetEventTiming = vi.hoisted(() => vi.fn())
const mockAccesAuxDonnees = vi.hoisted(() => vi.fn())

// Étape modularisation : l'existence de l'événement vient désormais du port lost-found.
vi.mock('#server/lost-found/ports/registry', () => ({
  useLostFoundPorts: () => ({ event: { getEventTiming: mockGetEventTiming } }),
}))

/*
 * ⚠️ SEUL `canAccessEditionData` EST REMPLACÉ, le reste du module demeure réel : c'est lui que
 * `assurerEditionLisible` interroge pour savoir si le demandeur fait partie de l'organisation. Un
 * `vi.mock` complet de ce module le priverait de ses autres exports, dont dépend la chaîne
 * d'imports du handler.
 */
vi.mock('#server/utils/permissions/edition-permissions', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  canAccessEditionData: mockAccesAuxDonnees,
}))

import handler from '../../../../../../../../layers/lost-found/server/api/editions/[id]/lost-found/index.get'
import { global } from '../../../../globales-nitro'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const mockEvent = {}

const mockLostFoundItems = [
  {
    id: 1,
    editionId: 1,
    userId: 1,
    description: 'Gants noirs trouvés près de la scène',
    imageUrl: '/uploads/lost-found/item-1.jpg',
    status: 'LOST',
    createdAt: new Date('2024-01-04T10:00:00Z'),
    user: {
      id: 1,
      pseudo: 'finder1',
      prenom: 'John',
      nom: 'Doe',
      profilePicture: null,
      emailHash: 'hash-finder1',
    },
    comments: [
      {
        id: 1,
        content: "Je pense que c'est à moi",
        createdAt: new Date('2024-01-04T11:00:00Z'),
        user: {
          id: 2,
          pseudo: 'owner1',
          prenom: 'Jane',
          nom: 'Smith',
          profilePicture: null,
          emailHash: 'hash-owner1',
        },
      },
    ],
  },
  {
    id: 2,
    editionId: 1,
    userId: 2,
    description: 'Téléphone oublié sur une table',
    imageUrl: null,
    status: 'RETURNED',
    createdAt: new Date('2024-01-04T09:00:00Z'),
    user: {
      id: 2,
      pseudo: 'finder2',
      prenom: 'Alice',
      nom: 'Johnson',
      profilePicture: '/avatars/alice.jpg',
      emailHash: 'hash-finder2',
    },
    comments: [],
  },
]

describe('/api/editions/[id]/lost-found GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    /*
     * ⚠️ `visibilite` EST OBLIGATOIRE DANS LE JEU D'ESSAI depuis le constat B1 : le port le rend
     * dans la même lecture que `found`, et le handler s'en sert pour refuser une édition retirée
     * de la vue du public. L'omettre ne ferait pas échouer les cas — le handler sauterait la garde
     * — mais ils cesseraient de l'exercer, en silence : c'est le pire des deux.
     */
    mockGetEventTiming.mockResolvedValue({
      found: true,
      startDate: new Date('2024-01-01'),
      visibilite: { status: 'PUBLISHED', creatorId: 7, conventionAuthorId: 11 },
    })
    mockAccesAuxDonnees.mockResolvedValue(false)
    prismaMock.lostFoundItem.findMany.mockReset()
    global.getRouterParam = vi.fn().mockReturnValue('1')
  })

  it("devrait récupérer tous les objets trouvés d'une édition", async () => {
    prismaMock.lostFoundItem.findMany.mockResolvedValue(mockLostFoundItems)

    const result = await handler(mockEvent as any)

    // Vérifie longueur identique
    expect(result).toHaveLength(mockLostFoundItems.length)
    // Vérifie structure minimale du premier élément (sans exiger égalité stricte car on ajoute emailHash)
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: mockLostFoundItems[0].id,
        description: mockLostFoundItems[0].description,
        status: mockLostFoundItems[0].status,
      })
    )
    expect(result[0].user).toEqual(
      expect.objectContaining({
        id: mockLostFoundItems[0].user.id,
        pseudo: mockLostFoundItems[0].user.pseudo,
        prenom: mockLostFoundItems[0].user.prenom,
        nom: mockLostFoundItems[0].user.nom,
        profilePicture: mockLostFoundItems[0].user.profilePicture,
      })
    )
    // emailHash peut être undefined si pas d'email mocké
    expect(result[0].user).toHaveProperty('emailHash')

    expect(mockGetEventTiming).toHaveBeenCalledWith(1)
    // Tolère champs additionnels (email, updatedAt)
    expect(prismaMock.lostFoundItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { editionId: 1 },
        include: expect.objectContaining({
          user: expect.objectContaining({ select: expect.objectContaining({ id: true }) }),
          comments: expect.any(Object),
        }),
        orderBy: { createdAt: 'desc' },
      })
    )
  })

  it('devrait retourner une liste vide si aucun objet trouvé', async () => {
    prismaMock.lostFoundItem.findMany.mockResolvedValue([])

    const result = await handler(mockEvent as any)

    expect(result).toEqual([])
  })

  it("devrait rejeter si ID d'édition invalide", async () => {
    global.getRouterParam.mockReturnValue('invalid')

    await expect(handler(mockEvent as any)).rejects.toThrow("ID d'édition invalide")
  })

  it("devrait rejeter si ID d'édition est NaN", async () => {
    global.getRouterParam.mockReturnValue('abc')

    await expect(handler(mockEvent as any)).rejects.toThrow("ID d'édition invalide")
  })

  it("devrait rejeter si ID d'édition est 0", async () => {
    global.getRouterParam.mockReturnValue('0')

    await expect(handler(mockEvent as any)).rejects.toThrow("ID d'édition invalide")
  })

  it('devrait rejeter si édition non trouvée', async () => {
    mockGetEventTiming.mockResolvedValue({ found: false, startDate: null })

    await expect(handler(mockEvent as any)).rejects.toThrow('Édition non trouvée')
    expect(prismaMock.lostFoundItem.findMany).not.toHaveBeenCalled()
  })

  it('devrait inclure tous les détails utilisateur', async () => {
    prismaMock.lostFoundItem.findMany.mockResolvedValue(mockLostFoundItems)

    const result = await handler(mockEvent as any)

    expect(result[0].user).toHaveProperty('id')
    expect(result[0].user).toHaveProperty('pseudo')
    expect(result[0].user).toHaveProperty('prenom')
    expect(result[0].user).toHaveProperty('nom')
    expect(result[0].user).toHaveProperty('profilePicture')
    expect(result[0].user).toHaveProperty('emailHash')
  })

  it('devrait inclure les commentaires avec les détails utilisateur', async () => {
    prismaMock.lostFoundItem.findMany.mockResolvedValue(mockLostFoundItems)

    const result = await handler(mockEvent as any)

    expect(result[0].comments).toHaveLength(1)
    expect(result[0].comments[0].user).toHaveProperty('id')
    expect(result[0].comments[0].user).toHaveProperty('pseudo')
    expect(result[0].comments[0].user).toHaveProperty('prenom')
    expect(result[0].comments[0].user).toHaveProperty('nom')
    expect(result[0].comments[0].user).toHaveProperty('profilePicture')
    expect(result[0].comments[0].user).toHaveProperty('emailHash')
  })

  it('devrait trier les objets par date de création décroissante', async () => {
    prismaMock.lostFoundItem.findMany.mockResolvedValue(mockLostFoundItems)

    await handler(mockEvent as any)

    expect(prismaMock.lostFoundItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } })
    )
  })

  it('devrait trier les commentaires par date de création croissante', async () => {
    prismaMock.lostFoundItem.findMany.mockResolvedValue(mockLostFoundItems)

    await handler(mockEvent as any)

    expect(prismaMock.lostFoundItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          comments: expect.objectContaining({
            orderBy: { createdAt: 'asc' },
          }),
        }),
      })
    )
  })

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.lostFoundItem.findMany.mockRejectedValue(new Error('DB Error'))

    await expect(handler(mockEvent as any)).rejects.toThrow('Erreur serveur interne')
  })

  it('devrait relancer les erreurs HTTP', async () => {
    const httpError = {
      statusCode: 403,
      statusMessage: 'Access denied',
    }

    mockGetEventTiming.mockRejectedValue(httpError)

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError)
  })

  it("devrait traiter correctement l'ID numérique", async () => {
    global.getRouterParam.mockReturnValue('123')

    prismaMock.lostFoundItem.findMany.mockResolvedValue([])

    await handler(mockEvent as any)

    expect(mockGetEventTiming).toHaveBeenCalledWith(123)
    expect(prismaMock.lostFoundItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { editionId: 123 },
      })
    )
  })
  /**
   * ⚠️⚠️ LA GARDE DE VISIBILITÉ, arrivée AVEC l'ouverture au public — constat B1.
   *
   * Jusqu'ici le middleware répondait 401 à tout anonyme sur cette route, et c'est ce qui tenait
   * lieu de protection : la page affichait alors un toast d'erreur puis « aucun objet n'a été
   * signalé », soit le contraire de la vérité. Déclarer la route publique corrige cet état vide
   * trompeur — mais le handler ne vérifiait QUE l'existence de l'édition.
   *
   * Sans la garde, on aurait donc remplacé un affichage faux par une FUITE : les objets d'une
   * édition hors ligne, pseudos et photos des auteurs compris, lisibles de qui connaît son numéro.
   * Les deux cas ci-dessous sont les deux moitiés de cette décision, et le second est indispensable
   * — une garde qui refuserait TOUT LE MONDE satisferait le premier.
   */
  describe('visibilité de l’édition', () => {
    const horsLigne = () =>
      mockGetEventTiming.mockResolvedValue({
        found: true,
        startDate: new Date('2024-01-01'),
        visibilite: { status: 'OFFLINE', creatorId: 7, conventionAuthorId: 11 },
      })

    it('⚠️ UN VISITEUR NE LIT PAS LES OBJETS D’UNE ÉDITION HORS LIGNE', async () => {
      horsLigne()
      prismaMock.lostFoundItem.findMany.mockResolvedValue(mockLostFoundItems)

      // 404 et non 403 : distinguer les deux dirait qu'il EXISTE quelque chose derrière ce numéro.
      await expect(handler(mockEvent as any)).rejects.toThrow('Édition non trouvée')
      expect(prismaMock.lostFoundItem.findMany).not.toHaveBeenCalled()
    })

    it('mais l’organisation, elle, continue de les lire', async () => {
      horsLigne()
      mockAccesAuxDonnees.mockResolvedValue(true)
      prismaMock.lostFoundItem.findMany.mockResolvedValue(mockLostFoundItems)

      const result = await handler({ context: { user: { id: 7 } } } as any)

      expect(result).toHaveLength(mockLostFoundItems.length)
      expect(mockAccesAuxDonnees).toHaveBeenCalledWith(1, 7, expect.anything())
    })

    it('et une édition publiée reste ouverte à tous, sans interroger les droits', async () => {
      /*
       * LE TÉMOIN. Il garde le cas ORDINAIRE : une garde posée trop haut — avant le test du statut
       * — ferait un aller-retour de droits sur chaque affichage public, et refuserait tout anonyme
       * sur une édition parfaitement publiée.
       */
      prismaMock.lostFoundItem.findMany.mockResolvedValue(mockLostFoundItems)

      const result = await handler(mockEvent as any)

      expect(result).toHaveLength(mockLostFoundItems.length)
      expect(mockAccesAuxDonnees).not.toHaveBeenCalled()
    })
  })
})
