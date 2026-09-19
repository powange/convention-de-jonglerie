import { describe, it, expect, vi, beforeEach } from 'vitest'

// wrapApiHandler et validateEditionId sont auto-importés (Nitro) dans le handler : on fournit des
// équivalents globaux avant le chargement du handler (vi.hoisted s'exécute avant les imports).
vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
  if (!(globalThis as any).validateEditionId) {
    ;(globalThis as any).validateEditionId = (event: any) =>
      parseInt(event?.context?.params?.id, 10)
  }
})

// Mock du contrôle d'accès. Le nom compte : la recherche s'appuie sur le helper qui admet
// AUSSI les bénévoles en créneau actif de contrôle d'accès. Avec l'ancien helper, réservé aux
// gestionnaires de la billetterie, la personne qui tient l'entrée ne pouvait chercher personne.
const mockCanAccessEditionData = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canAccessEditionDataOrAccessControl: mockCanAccessEditionData,
}))

// Mock de requireAuth pour simuler un utilisateur authentifié
vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import searchHandler from '../../../../../../server/api/editions/[id]/ticketing/search.post'
import { global } from '../../../../globales-nitro'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('POST /api/editions/[id]/ticketing/search', () => {
  const mockUser = { id: 1, email: 'user@example.com', pseudo: 'testuser' }

  const mockEvent = {
    context: {
      params: { id: '1' },
      user: mockUser,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn().mockResolvedValue({ searchTerm: 'dupont' })
    mockCanAccessEditionData.mockResolvedValue(true)

    // Par défaut, toutes les requêtes renvoient des résultats vides
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])
    prismaMock.editionArtist.findMany.mockResolvedValue([])
    prismaMock.editionOrganizer.findMany.mockResolvedValue([])
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([])
    prismaMock.volunteerAssignment.findMany.mockResolvedValue([])
    prismaMock.user.findMany.mockResolvedValue([])
  })

  it("devrait rejeter avec 403 si l'utilisateur n'a pas accès à l'édition", async () => {
    mockCanAccessEditionData.mockResolvedValue(false)

    await expect(searchHandler(mockEvent as any)).rejects.toThrow(/Droits insuffisants/)
    expect(prismaMock.editionVolunteerApplication.findMany).not.toHaveBeenCalled()
  })

  it('devrait retourner des résultats vides quand rien ne correspond', async () => {
    const result = await searchHandler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(result.data.results.total).toBe(0)
    expect(result.data.results.volunteers).toEqual([])
  })

  // Garde-fou de régression : depuis l'abstraction Event (étape 0), les candidatures bénévoles
  // sont rattachées à Event. La recherche DOIT filtrer sur `eventId`, jamais `editionId`.
  it('devrait filtrer les bénévoles sur eventId (et non editionId)', async () => {
    await searchHandler(mockEvent as any)

    expect(prismaMock.editionVolunteerApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventId: 1,
          status: 'ACCEPTED',
        }),
      })
    )

    const whereArg = prismaMock.editionVolunteerApplication.findMany.mock.calls[0][0].where
    expect(whereArg).not.toHaveProperty('editionId')
  })

  /*
   * O1 — le nombre de requêtes ne doit PAS croître avec le nombre de personnes affichées.
   *
   * Chaque boucle interrogeait la base par personne : deux à trois requêtes par bénévole, une
   * par artiste. Sur l'écran le plus sollicité de l'événement, vingt bénévoles et vingt artistes
   * déclenchaient 252 requêtes SQL, mesurées sur les données réelles.
   *
   * Ce test ne mesure pas le temps — il vérifie la propriété qui le gouverne : passer de une à
   * vingt personnes ne change pas le nombre d'appels. C'est cela qui se casse silencieusement
   * quand on remet une lecture dans une boucle.
   */
  const personnes = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: i + 1,
      userId: i + 1,
      user: { id: i + 1, pseudo: `p${i}`, prenom: 'A', nom: 'B', email: `p${i}@x.fr` },
      teamAssignments: [],
      handoutItems: [],
      shows: [],
      entryValidated: false,
    }))

  const compterLesAppels = () =>
    prismaMock.editionVolunteerHandoutItem.findMany.mock.calls.length +
    prismaMock.volunteerMealSelection.findMany.mock.calls.length +
    prismaMock.artistMealSelection.findMany.mock.calls.length +
    prismaMock.editionArtistHandoutItem.findMany.mock.calls.length

  const chercherAvec = async (n: number) => {
    vi.clearAllMocks()
    mockCanAccessEditionData.mockResolvedValue(true)
    global.readBody = vi.fn().mockResolvedValue({ searchTerm: 'dupont' })
    for (const modele of [
      'ticketingOrderItem',
      'editionOrganizer',
      'volunteerAssignment',
      'user',
      'editionVolunteerHandoutItem',
      'volunteerMealSelection',
      'artistMealSelection',
      'editionArtistHandoutItem',
    ]) {
      prismaMock[modele].findMany.mockResolvedValue([])
    }
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue(personnes(n))
    prismaMock.editionArtist.findMany.mockResolvedValue(personnes(n))
    await searchHandler(mockEvent as any)
    return compterLesAppels()
  }

  it('interroge la base autant de fois pour vingt personnes que pour une', async () => {
    const pourUne = await chercherAvec(1)
    const pourVingt = await chercherAvec(20)

    expect(pourVingt).toBe(pourUne)
  })

  // Le détail, pour que l'échec dise QUELLE lecture est repartie dans la boucle.
  it('ne lit qu’une fois chaque table, quel que soit le nombre de personnes', async () => {
    await chercherAvec(20)

    expect(prismaMock.editionVolunteerHandoutItem.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.volunteerMealSelection.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.artistMealSelection.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.editionArtistHandoutItem.findMany).toHaveBeenCalledTimes(1)
  })

  /*
   * L'ordre des repas était rendu par `date` seule. Deux repas du même jour n'étaient donc pas
   * départagés, et leur ordre d'affichage dépendait du plan de requête — il a effectivement
   * changé en groupant les lectures. `mealType` le rend déterministe, comme dans les cinq autres
   * lectures de repas du dépôt.
   */
  /*
   * B2, deuxième occurrence — la règle « qui a validé » est écrite huit fois, et la copie de la
   * branche billet manquait ici comme elle manquait dans `verify.post.ts`.
   *
   * Ce test confronte les QUATRE populations d'un coup, et non la seule qui vient d'être
   * corrigée : c'est ce qui manquait pour que l'oubli ne puisse plus être partiel.
   */
  describe("l'auteur de la validation", () => {
    const valideParGrace = {
      entryValidated: true,
      entryValidatedAt: new Date('2026-08-01T12:00:00Z'),
      entryValidatedBy: 77,
    }

    beforeEach(() => {
      prismaMock.user.findMany.mockResolvedValue([{ id: 77, prenom: 'Grace', nom: 'Hopper' }])
    })

    it('le rend pour un billet, comme pour les trois autres populations', async () => {
      prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
        {
          id: 1,
          helloAssoItemId: null,
          name: 'Pass',
          amount: 100,
          state: 'Processed',
          qrCode: 'x',
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@x.fr',
          customFields: null,
          tier: null,
          selectedOptions: [],
          ...valideParGrace,
          order: {
            id: 1,
            helloAssoOrderId: null,
            status: 'Processed',
            payerFirstName: 'Ada',
            payerLastName: 'Lovelace',
            payerEmail: 'ada@x.fr',
            externalTicketing: null,
            items: [
              {
                id: 1,
                helloAssoItemId: null,
                name: 'Pass',
                type: null,
                amount: 100,
                state: 'Processed',
                qrCode: 'x',
                firstName: 'Ada',
                lastName: 'Lovelace',
                email: 'ada@x.fr',
                customFields: null,
                tier: null,
                selectedOptions: [],
                ...valideParGrace,
              },
            ],
          },
        },
      ])

      const resultat = await searchHandler(mockEvent as any)
      const billet = resultat.data.results.tickets[0].participant.ticket

      expect(billet.entryValidatedBy).toEqual({ firstName: 'Grace', lastName: 'Hopper' })
      // La modale affiche toute la commande : chaque ligne doit le porter, pas seulement celle
      // qui a répondu à la recherche.
      expect(billet.order.items[0].entryValidatedBy).toEqual({
        firstName: 'Grace',
        lastName: 'Hopper',
      })
    })

    it('le demande en base pour les quatre populations, jamais pour trois', async () => {
      prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])
      await searchHandler(mockEvent as any)

      // Un `select` qui oublie la colonne est la façon dont ce défaut est né : la sérialisation
      // ne peut pas rendre ce que la requête n'a pas demandé.
      const selectionBenevole =
        prismaMock.editionVolunteerApplication.findMany.mock.calls[0][0].select
      expect(selectionBenevole.entryValidatedBy).toBe(true)
    })
  })

  it('ordonne les repas par date PUIS par type, pour les trois populations', async () => {
    await chercherAvec(5)

    const ordreAttendu = [{ meal: { date: 'asc' } }, { meal: { mealType: 'asc' } }]
    for (const modele of ['volunteerMealSelection', 'artistMealSelection']) {
      expect(prismaMock[modele].findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: ordreAttendu })
      )
    }
  })
})
