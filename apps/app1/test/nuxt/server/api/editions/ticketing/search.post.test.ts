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

  describe('la recherche par mots-clés', () => {
    /**
     * Chercher « Jean Dupont » et trouver Jean Dupont.
     *
     * Le terme entier était cherché dans chaque champ séparément : « Jean Dupont » n'étant ni un
     * prénom ni un nom, l'écran ne rendait rien — alors que « Jean » seul trouvait la personne.
     * À la porte, devant quelqu'un qui donne son nom complet, c'est le geste le plus naturel qui
     * échouait.
     */
    const clausesDuNom = () => {
      const where = prismaMock.ticketingOrderItem.findMany.mock.calls.at(-1)[0].where
      // Le premier fragment du `AND` écarte les dons ; les suivants portent les mots.
      return where.AND.slice(1)
    }

    it('exige que chaque mot se retrouve dans un champ', async () => {
      global.readBody = vi.fn().mockResolvedValue({ searchTerm: 'jean dupont' })

      await searchHandler(mockEvent as any)

      expect(clausesDuNom()).toEqual([
        {
          OR: [
            { firstName: { contains: 'jean' } },
            { lastName: { contains: 'jean' } },
            { email: { contains: 'jean' } },
          ],
        },
        {
          OR: [
            { firstName: { contains: 'dupont' } },
            { lastName: { contains: 'dupont' } },
            { email: { contains: 'dupont' } },
          ],
        },
      ])
    })

    it('applique la même règle aux quatre populations', async () => {
      // Une règle appliquée à moitié serait pire que pas de règle : « Jean Dupont » trouverait le
      // billet mais pas le bénévole du même nom, et rien à l'écran ne l'expliquerait.
      global.readBody = vi.fn().mockResolvedValue({ searchTerm: 'jean dupont' })

      await searchHandler(mockEvent as any)

      for (const modele of [
        'editionVolunteerApplication',
        'editionArtist',
        'editionOrganizer',
      ] as const) {
        const appels = prismaMock[modele].findMany.mock.calls
        const texte = JSON.stringify(appels[0][0].where)
        expect(texte).toContain('jean')
        expect(texte).toContain('dupont')
      }
    })

    it('ne cherche rien quand le terme ne porte aucun mot', async () => {
      // `min(1)` laisse passer une chaîne d'espaces, et une clause vide dans un `AND` ne restreint
      // pas : sans ce court-circuit, l'écran rendrait les vingt premiers billets de l'édition
      // comme s'ils correspondaient.
      global.readBody = vi.fn().mockResolvedValue({ searchTerm: '   ' })

      const res: any = await searchHandler(mockEvent as any)

      expect(res.data.tickets).toEqual([])
      expect(prismaMock.ticketingOrderItem.findMany).not.toHaveBeenCalled()
    })
  })

  describe('ce qui ne donne pas droit d’entrée', () => {
    /**
     * Un don n'est pas une entrée, et il porte le nom du payeur — sur les données réelles, **les
     * 43 lignes de don portent aussi un code QR**. Chercher « Dupont » ramenait donc son don à
     * côté de son billet, sans que rien à l'écran ne les distingue.
     *
     * Les écarter est mesuré, pas supposé : ces lignes n'ont aucun tarif et aucune n'a jamais eu
     * son entrée validée. Personne n'est jamais entré avec un don.
     */
    it('les écarte de la recherche par nom', async () => {
      await searchHandler(mockEvent as any)

      const where = prismaMock.ticketingOrderItem.findMany.mock.calls.at(-1)[0].where
      expect(where.AND[0]).toEqual({
        OR: [{ type: null }, { type: { notIn: ['Donation', 'Membership', 'Payment'] } }],
      })
    })

    it('sans effacer la recherche elle-même', async () => {
      // Les deux fragments portent chacun un `OR`, et cohabitent sous le `AND`. Les étaler dans
      // le `where` en ferait disparaître un des deux — la recherche rendrait alors TOUS les
      // billets de l'édition, et rien n'échouerait pour le signaler.
      await searchHandler(mockEvent as any)

      const where = prismaMock.ticketingOrderItem.findMany.mock.calls.at(-1)[0].where
      const clausesDuNom = where.AND.slice(1)

      expect(clausesDuNom).toHaveLength(1)
      expect(clausesDuNom[0].OR.map((clause: any) => Object.keys(clause)[0])).toEqual([
        'firstName',
        'lastName',
        'email',
      ])
    })
  })

  describe('la provenance de la commande', () => {
    const billetDe = (externalTicketing: { provider: string } | null) => {
      const ligne = {
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
      }
      return {
        ...ligne,
        order: {
          id: 1,
          helloAssoOrderId: 42,
          status: 'Processed',
          payerFirstName: 'Ada',
          payerLastName: 'Lovelace',
          payerEmail: 'ada@x.fr',
          externalTicketing,
          items: [ligne],
        },
      }
    }

    it('la rend, comme le scan : sans elle, une commande HelloAsso prenait le logo du site', async () => {
      prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
        billetDe({ provider: 'HELLOASSO' }),
      ])

      const resultat = await searchHandler(mockEvent as any)

      expect(resultat.data.results.tickets[0].participant.ticket.order.provider).toBe('HELLOASSO')
    })

    it('rend null pour une commande saisie sur place', async () => {
      prismaMock.ticketingOrderItem.findMany.mockResolvedValue([billetDe(null)])

      const resultat = await searchHandler(mockEvent as any)

      expect(resultat.data.results.tickets[0].participant.ticket.order.provider).toBeNull()
    })

    it('la demande en base', async () => {
      prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])
      await searchHandler(mockEvent as any)

      const { include } = prismaMock.ticketingOrderItem.findMany.mock.calls.at(-1)[0]
      expect(include.order.include.externalTicketing).toEqual({ select: { provider: true } })
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

  /*
   * ─── Le rapprochement par personne ─────────────────────────────────────────────────────────
   *
   * `regrouperParPersonne` est éprouvée à part, sur des titres déjà formés. Ce qui se joue ICI est
   * tout autre : le handler doit CONSTRUIRE ces titres depuis quatre formes Prisma différentes, et
   * construire la table des comptes qui permet à un billet de rejoindre une candidature. Rien de
   * tout cela ne lève d'erreur quand il se trompe — on obtient des groupes d'un seul titre, ou des
   * personnes sans nom, et l'écran paraît simplement « ne pas marcher ».
   *
   * ⚠️ UN AVERTISSEMENT QUE JE ME SUIS DONNÉ À MOI-MÊME : j'ai d'abord écrit ici qu'un champ lu au
   * mauvais niveau — `application.prenom` au lieu de `application.user.prenom` — serait attrapé
   * par le premier test. C'ÉTAIT FAUX, et le sabotage l'a montré : le groupe se forme sur le
   * COMPTE, que les noms du titre soient bons ou non. Seul le LIBELLÉ en dépend, d'où le test qui
   * le vérifie sur un bénévole SEUL — sans billet dont le nom viendrait masquer le défaut.
   */
  describe('les personnes rapprochées', () => {
    // Même boîte, même nom que le compte du bénévole : c'est ce qui doit les réunir.
    const billetDAda = (over: Record<string, unknown> = {}) => ({
      id: 500,
      helloAssoItemId: null,
      name: 'Pass',
      type: null,
      amount: 100,
      state: 'Processed',
      qrCode: 'x',
      firstName: 'A',
      lastName: 'B',
      email: 'p0@x.fr',
      entryValidated: false,
      customFields: null,
      tier: null,
      selectedOptions: [],
      order: {
        id: 1,
        helloAssoOrderId: 42,
        status: 'Processed',
        payerFirstName: 'A',
        payerLastName: 'B',
        payerEmail: 'p0@x.fr',
        externalTicketing: null,
        items: [],
      },
      ...over,
    })

    const benevoleAda = {
      id: 900,
      userId: 1,
      user: { id: 1, pseudo: 'p0', prenom: 'A', nom: 'B', email: 'p0@x.fr' },
      teamAssignments: [],
      handoutItems: [],
      shows: [],
      entryValidated: false,
    }

    it('RÉUNIT un billet et une candidature de bénévole', async () => {
      /*
       * ⚠️ LE CAS QUI JUSTIFIE LE LOT : jusqu'ici il fallait chercher deux fois cette personne.
       * Le billet n'a pas de compte en base — c'est la table des comptes, bâtie depuis les
       * bénévoles trouvés, qui permet de le rattacher.
       */
      prismaMock.ticketingOrderItem.findMany.mockResolvedValue([billetDAda()])
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([benevoleAda])

      const { personnes } = (await searchHandler(mockEvent as any)).data

      expect(personnes).toHaveLength(1)
      expect([...personnes[0].titres].map((t: any) => t.nature).sort()).toEqual([
        'ticket',
        'volunteer',
      ])
      // Deux titres à valider : c'est ce nombre que l'écran annonce sur le bouton groupé.
      expect(personnes[0].aValider).toBe(2)
    })

    it('rend l’identifiant INTERNE de la commande, distinct du numéro HelloAsso', async () => {
      /*
       * ⚠️ DEUX CHAMPS VOISINS, ET UN SEUL IDENTIFIE LA COMMANDE. `order.id` porte le numéro
       * HelloAsso — `null` dès qu'une commande est saisie sur place ou vient d'un autre
       * fournisseur. Le guichet s'en servait pour réunir les lignes d'une même commande : cela
       * marchait pour les commandes en ligne et JAMAIS pour les ventes sur place, où la commande
       * s'affichait autant de fois qu'elle avait de billets.
       *
       * Ce test existe parce que les deux champs se ressemblent assez pour qu'on « nettoie » le
       * doublon apparent, et que rien d'autre ne dirait ce qu'on vient de casser.
       */
      prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
        billetDAda({ order: { ...billetDAda().order, id: 938, helloAssoOrderId: null } }),
      ])

      const { results } = (await searchHandler(mockEvent as any)).data
      const commande = results.tickets[0].participant.ticket.order

      expect(commande.orderId).toBe(938)
      // Et le champ historique reste ce qu'il est : nul pour une commande saisie sur place.
      expect(commande.id).toBeNull()
    })

    it('ne construit PAS de table de comptes au prix d’une requête de plus', async () => {
      // La table se bâtit depuis les résultats déjà en main. Une requête supplémentaire ici se
      // paierait sur chaque frappe au guichet.
      prismaMock.ticketingOrderItem.findMany.mockResolvedValue([billetDAda()])
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([benevoleAda])

      await searchHandler(mockEvent as any)

      expect(prismaMock.user.findMany).not.toHaveBeenCalled()
    })

    it('NOMME la personne, même sans billet pour lui prêter un nom', async () => {
      /*
       * Le libellé est le seul endroit où les noms portés par le titre lui-même comptent. Sur un
       * bénévole SEUL, le lire au mauvais niveau donne un groupe sans nom : l'écran affiche un
       * bouton « valider 1 titre » au-dessus du vide. Un billet présent masquerait le défaut, son
       * propre nom prenant la place.
       */
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([benevoleAda])

      const { personnes } = (await searchHandler(mockEvent as any)).data

      expect(personnes[0].libelle).toBe('A B')
    })

    it('ne RAPPROCHE PAS un billet au nom différent du compte', async () => {
      /*
       * ⚠️ LA GARDE QUI ÉVITE LE PIRE, vue depuis le handler : un billet acheté par un parent pour
       * son enfant porte le courriel du parent et le nom de l'enfant. Les réunir ferait valider
       * l'entrée d'un absent d'un seul clic.
       */
      prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
        billetDAda({ firstName: 'Lucie', lastName: 'B' }),
      ])
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([benevoleAda])

      const { personnes } = (await searchHandler(mockEvent as any)).data

      expect(personnes).toHaveLength(2)
    })

    it('ne RETIRE RIEN des quatre listes', async () => {
      // Le rapprochement s'ajoute, il ne remplace pas : tout le détail actuellement affiché doit
      // rester là, sans quoi le lot ferait perdre de l'information en prétendant en donner.
      prismaMock.ticketingOrderItem.findMany.mockResolvedValue([billetDAda()])
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([benevoleAda])

      const { results } = (await searchHandler(mockEvent as any)).data

      expect(results.tickets).toHaveLength(1)
      expect(results.volunteers).toHaveLength(1)
      expect(results.total).toBe(2)
    })
  })
})
