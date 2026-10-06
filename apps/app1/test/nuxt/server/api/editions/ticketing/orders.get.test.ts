import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock des utilitaires - DOIT être avant les imports
vi.mock('../../../../../../server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: vi.fn(),
}))

import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import handler from '../../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/orders.get'
import { global } from '../../../../globales-nitro'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const mockCanAccess = canManageTicketingById as ReturnType<typeof vi.fn>

const baseEvent = {
  context: {
    params: { id: '1' },
    user: { id: 10 },
  },
}

describe('/api/editions/[id]/ticketing/orders GET', () => {
  beforeEach(() => {
    mockCanAccess.mockReset()
    prismaMock.ticketingOrder.count.mockReset()
    prismaMock.ticketingOrder.findMany.mockReset()
    global.getQuery = vi.fn()
  })

  it('retourne les commandes avec pagination', async () => {
    mockCanAccess.mockResolvedValue(true)
    global.getQuery.mockReturnValue({ page: '1', limit: '20' })

    const mockOrders = [
      {
        id: 1,
        editionId: 1,
        orderDate: new Date('2024-01-01'),
        amount: 5000,
        payerFirstName: 'John',
        payerLastName: 'Doe',
        payerEmail: 'john@example.com',
        externalTicketing: null,
        // `state`, `refunded` et le statut de la commande servent au calcul de `refundDue` :
        // sans eux, la ligne serait vue comme « non annulée », ce qui est vrai ici mais par
        // accident. On dit donc ce qu'elle est.
        status: 'Processed',
        paymentMethod: 'card',
        items: [
          {
            id: 1,
            type: 'Participant',
            amount: 5000,
            state: 'Processed',
            refunded: false,
            tier: { id: 1, name: 'Tarif normal' },
            selectedOptions: [],
          },
        ],
      },
    ]

    prismaMock.ticketingOrder.count.mockResolvedValue(1)
    prismaMock.ticketingOrder.findMany.mockResolvedValue(mockOrders as any)

    const res = await handler(baseEvent as any)

    // Chaque article dit s'il répond aux filtres. Sans filtre d'article, tous y répondent : le
    // client n'en grise aucun, et la liste est exactement celle d'avant.
    expect(res.data).toEqual([
      {
        ...mockOrders[0],
        // Aucun billet annulé : rien à retirer de ce qu'a rapporté la commande.
        canceledAmount: 0,
        items: [
          {
            ...mockOrders[0]!.items[0],
            retenuParLesFiltres: true,
            // Le billet n'est pas annulé : on ne doit rien.
            refundDue: null,
          },
        ],
      },
    ])
    expect(res.pagination).toEqual({
      page: 1,
      limit: 20,
      totalCount: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    })
    expect(prismaMock.ticketingOrder.findMany).toHaveBeenCalledWith({
      where: { editionId: 1 },
      include: expect.any(Object),
      orderBy: { orderDate: 'desc' },
      skip: 0,
      take: 20,
    })
  })

  it('calcule les stats correctement sans filtres', async () => {
    mockCanAccess.mockResolvedValue(true)
    global.getQuery.mockReturnValue({ page: '1', limit: '20' })

    const mockOrders = [
      {
        id: 1,
        status: 'Processed',
        paymentMethod: 'cash',
        items: [{ type: 'Participant', amount: 5000, state: 'Processed', selectedOptions: [] }],
      },
      {
        id: 2,
        status: 'Processed',
        paymentMethod: 'cash',
        items: [
          { type: 'Participant', amount: 2500, state: 'Processed', selectedOptions: [] },
          { type: 'Donation', amount: 500, state: 'Processed', selectedOptions: [] },
        ],
      },
    ]

    prismaMock.ticketingOrder.count.mockResolvedValue(2)
    prismaMock.ticketingOrder.findMany
      .mockResolvedValueOnce([mockOrders[0]] as any) // Pour la pagination
      .mockResolvedValueOnce(mockOrders as any) // Pour les stats

    const res = await handler(baseEvent as any)

    expect(res.stats).toEqual({
      totalOrders: 2,
      totalItems: 2, // 1 + 1 (excluant les donations)
      totalAmount: 8000, // 5000 + 3000
      totalDonations: 1,
      totalDonationsAmount: 500,
      amountsByPaymentMethod: {
        cardHelloAsso: 0,
        cardOnsite: 0,
        cash: 8000,
        check: 0,
        online: 0,
        pending: 0,
        refunded: 0,
      },
    })
  })

  it('applique les filtres de tarifs aux stats', async () => {
    mockCanAccess.mockResolvedValue(true)
    global.getQuery.mockReturnValue({ page: '1', limit: '20', tierIds: '1,2' })

    const mockFilteredOrders = [
      {
        id: 1,
        amount: 5000,
        // L'article porte son tarif : sous un filtre de tarif, un article sans `tierId` ne peut
        // pas être celui que la requête a retenu, et le gabarit décrivait une situation qui
        // n'existe pas.
        status: 'Processed',
        paymentMethod: 'cash',
        items: [
          {
            type: 'Participant',
            amount: 5000,
            state: 'Processed',
            tierId: 1,
            selectedOptions: [],
          },
        ],
      },
    ]

    prismaMock.ticketingOrder.count.mockResolvedValue(1)
    prismaMock.ticketingOrder.findMany
      .mockResolvedValueOnce([
        {
          ...mockFilteredOrders[0],
          externalTicketing: null,
          items: [
            {
              id: 1,
              type: 'Participant',
              amount: 5000,
              tierId: 1,
              tier: { id: 1, name: 'Tarif normal', handoutItems: [] },
            },
          ],
        },
      ] as any) // Pour la pagination
      .mockResolvedValueOnce(mockFilteredOrders as any) // Pour les stats

    const res = await handler(baseEvent as any)

    // Vérifier que les stats ne contiennent que les commandes filtrées
    expect(res.stats).toEqual({
      totalOrders: 1,
      totalItems: 1,
      totalAmount: 5000,
      totalDonations: 0,
      totalDonationsAmount: 0,
      amountsByPaymentMethod: {
        cardHelloAsso: 0,
        cardOnsite: 0,
        cash: 5000,
        check: 0,
        online: 0,
        pending: 0,
        refunded: 0,
      },
    })

    // Vérifier que le filtre de tarifs a été appliqué aux stats
    expect(prismaMock.ticketingOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          editionId: 1,
          AND: [
            {
              items: {
                some: {
                  tierId: {
                    in: [1, 2],
                  },
                },
              },
            },
          ],
        }),
        select: {
          status: true,
          paymentMethod: true,
          externalTicketingId: true,
          items: {
            // De quoi rejouer les filtres article par article, et compter le prix des options
            // et l'état du billet : un billet annulé sort du montant.
            select: {
              type: true,
              amount: true,
              state: true,
              tierId: true,
              entryValidated: true,
              selectedOptions: { select: { optionId: true, amount: true } },
            },
          },
        },
      })
    )
  })

  it("applique les filtres de statut d'entrée aux stats", async () => {
    mockCanAccess.mockResolvedValue(true)
    global.getQuery.mockReturnValue({ page: '1', limit: '20', entryStatus: 'validated' })

    const mockFilteredOrders = [
      {
        id: 1,
        amount: 5000,
        // Sous un filtre « entrée validée », l'article retenu l'est forcément.
        status: 'Processed',
        paymentMethod: 'cash',
        items: [
          {
            type: 'Participant',
            amount: 5000,
            state: 'Processed',
            entryValidated: true,
            selectedOptions: [],
          },
        ],
      },
    ]

    prismaMock.ticketingOrder.count.mockResolvedValue(1)
    prismaMock.ticketingOrder.findMany
      .mockResolvedValueOnce([
        {
          ...mockFilteredOrders[0],
          externalTicketing: null,
          items: [
            {
              id: 1,
              type: 'Participant',
              amount: 5000,
              entryValidated: true,
              tier: { id: 1, name: 'Tarif normal', handoutItems: [] },
            },
          ],
        },
      ] as any) // Pour la pagination
      .mockResolvedValueOnce(mockFilteredOrders as any) // Pour les stats

    const res = await handler(baseEvent as any)

    expect(res.stats).toEqual({
      totalOrders: 1,
      totalItems: 1,
      totalAmount: 5000,
      totalDonations: 0,
      totalDonationsAmount: 0,
      amountsByPaymentMethod: {
        cardHelloAsso: 0,
        cardOnsite: 0,
        cash: 5000,
        check: 0,
        online: 0,
        pending: 0,
        refunded: 0,
      },
    })

    // Vérifier que le filtre de statut d'entrée a été appliqué aux stats
    expect(prismaMock.ticketingOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          editionId: 1,
          AND: [
            {
              items: {
                some: {
                  entryValidated: true,
                },
              },
            },
          ],
        }),
        select: {
          status: true,
          paymentMethod: true,
          externalTicketingId: true,
          items: {
            // De quoi rejouer les filtres article par article, et compter le prix des options
            // et l'état du billet : un billet annulé sort du montant.
            select: {
              type: true,
              amount: true,
              state: true,
              tierId: true,
              entryValidated: true,
              selectedOptions: { select: { optionId: true, amount: true } },
            },
          },
        },
      })
    )
  })

  it('ne compte QUE les articles du tarif demandé, pas toute la commande', async () => {
    // Le défaut signalé, dans sa forme exacte : une commande, deux billets de tarifs
    // différents, un filtre sur un seul de ces tarifs. Le bandeau annonçait « 1 commande,
    // 2 billets, 60,00 € » — la commande était juste, les deux autres chiffres comptaient un
    // billet qu'on n'avait pas demandé.
    mockCanAccess.mockResolvedValue(true)
    global.getQuery.mockReturnValue({ page: '1', limit: '20', tierIds: '72' })

    const commandeMixte = {
      id: 602,
      amount: 6000,
      status: 'Processed',
      paymentMethod: 'cash',
      externalTicketingId: null,
      items: [
        { type: 'Registration', amount: 2500, state: 'Processed', tierId: 72, selectedOptions: [] },
        { type: 'Registration', amount: 3500, state: 'Processed', tierId: 87, selectedOptions: [] },
      ],
    }

    prismaMock.ticketingOrder.count.mockResolvedValue(1)
    prismaMock.ticketingOrder.findMany
      .mockResolvedValueOnce([
        {
          ...commandeMixte,
          externalTicketing: null,
          items: commandeMixte.items.map((item, index) => ({ ...item, id: 977 + index })),
        },
      ] as any) // Pour la pagination
      .mockResolvedValueOnce([commandeMixte] as any) // Pour les stats

    const res = await handler(baseEvent as any)

    expect(res.stats!.totalOrders).toBe(1)
    expect(res.stats!.totalItems).toBe(1)
    // Le montant suit les articles retenus, sans quoi il contredirait le compte affiché à côté.
    expect(res.stats!.totalAmount).toBe(2500)
    expect(res.stats!.amountsByPaymentMethod.cash).toBe(2500)

    // Et la liste garde les DEUX articles — la commande reste ce qu'elle est —, en disant lequel
    // le filtre écarte. Les masquer ferait croire que ce billet n'a pas été vendu.
    const articles = (res.data as any[])[0].items
    expect(articles).toHaveLength(2)
    expect(articles.map((a: any) => a.retenuParLesFiltres)).toEqual([true, false])
  })

  it('compte les options, filtre posé ou non', async () => {
    // Le montant d'une commande dépasse la somme de ses billets du prix de leurs options — c'est
    // le cas des 18 commandes de l'édition 9 où l'écart avait été pris pour des frais de
    // billetterie externe. Sous un filtre de tarif, le montant reprenait le seul prix des billets
    // et perdait les options.
    mockCanAccess.mockResolvedValue(true)
    global.getQuery.mockReturnValue({ page: '1', limit: '20', tierIds: '4' })

    const avecOptions = {
      id: 257,
      status: 'Processed',
      paymentMethod: 'card',
      externalTicketingId: 3,
      items: [
        {
          type: 'Registration',
          amount: 5000,
          state: 'Processed',
          tierId: 4,
          selectedOptions: [
            { optionId: 1, amount: 500 },
            { optionId: 2, amount: 200 },
          ],
        },
      ],
    }

    prismaMock.ticketingOrder.count.mockResolvedValue(1)
    prismaMock.ticketingOrder.findMany
      .mockResolvedValueOnce([
        { ...avecOptions, externalTicketing: null, items: [{ ...avecOptions.items[0], id: 1 }] },
      ] as any)
      .mockResolvedValueOnce([avecOptions] as any)

    const res = await handler(baseEvent as any)

    expect(res.stats!.totalItems).toBe(1)
    expect(res.stats!.totalAmount).toBe(5700)
    expect(res.stats!.amountsByPaymentMethod.cardHelloAsso).toBe(5700)
  })

  it('écarte du total les billets annulés, sans les ajouter au « Total général »', async () => {
    // Les chiffres réels du tarif 84 de l'édition 22, réduits à deux commandes : la commande 686
    // garde son montant de 4 tee-shirts alors que 3 sont annulés, et une commande entière
    // annulée était ADDITIONNÉE au total sous l'intitulé « Remboursé ».
    mockCanAccess.mockResolvedValue(true)
    global.getQuery.mockReturnValue({ page: '1', limit: '20' })

    const billet = (state: string, amount = 1800) => ({
      type: 'Registration',
      amount,
      state,
      tierId: 84,
      selectedOptions: [],
    })
    const commandes = [
      {
        id: 686,
        status: 'Processed',
        paymentMethod: 'card',
        externalTicketingId: 3,
        items: [billet('Canceled'), billet('Processed'), billet('Canceled'), billet('Canceled')],
      },
      {
        id: 1116,
        status: 'Refunded',
        paymentMethod: 'card',
        externalTicketingId: null,
        items: [billet('Canceled', 2800)],
      },
      {
        id: 937,
        status: 'Onsite',
        paymentMethod: 'cash',
        externalTicketingId: null,
        items: [
          billet('Processed', 3400),
          // Un don annulé ne compte ni dans les dons, ni dans le montant.
          { ...billet('Canceled', 500), type: 'Donation' },
        ],
      },
    ]

    prismaMock.ticketingOrder.count.mockResolvedValue(3)
    prismaMock.ticketingOrder.findMany
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce(commandes as any)

    const res = await handler(baseEvent as any)

    expect(res.stats).toEqual({
      // Le nombre de commandes LISTÉES : la commande annulée y figure toujours.
      totalOrders: 3,
      totalItems: 2,
      totalAmount: 5200, // 1800 + 3400
      totalDonations: 0,
      totalDonationsAmount: 0,
      amountsByPaymentMethod: {
        cardHelloAsso: 1800,
        cardOnsite: 0,
        cash: 3400,
        check: 0,
        online: 0,
        pending: 0,
        refunded: 1800 * 3 + 2800 + 500, // hors du total
      },
    })
  })

  it('annonce sur chaque commande la part annulée, options comprises', async () => {
    // La commande 686 : cinq billets, trois annulés, et un montant payé qui ne bouge pas.
    mockCanAccess.mockResolvedValue(true)
    global.getQuery.mockReturnValue({ page: '1', limit: '20', search: 'x' })

    const billet = (id: number, state: string, options: number[] = []) => ({
      id,
      type: 'Registration',
      amount: 1800,
      state,
      refunded: false,
      selectedOptions: options.map((amount, i) => ({ id: i, optionId: i, amount })),
    })
    const commandes = [
      {
        id: 686,
        amount: 10200,
        status: 'Processed',
        paymentMethod: 'card',
        externalTicketing: null,
        items: [
          billet(1, 'Canceled', [500]),
          billet(2, 'Processed'),
          billet(3, 'Canceled'),
          billet(4, 'Canceled'),
          billet(5, 'Processed', [300]),
        ],
      },
      {
        id: 1116,
        amount: 2800,
        status: 'Refunded',
        paymentMethod: 'card',
        externalTicketing: null,
        // Commande annulée en entier : tout est annulé, même un billet resté `Processed`.
        items: [{ ...billet(6, 'Processed'), amount: 2800 }],
      },
    ]

    prismaMock.ticketingOrder.count.mockResolvedValue(2)
    prismaMock.ticketingOrder.findMany.mockResolvedValueOnce(commandes as any)

    const res = await handler(baseEvent as any)

    const lues = res.data as any[]
    expect(lues[0].canceledAmount).toBe(1800 * 3 + 500)
    expect(lues[0].amount).toBe(10200)
    expect(lues[1].canceledAmount).toBe(2800)
    // La somme due d'un billet annulé reprend ses options.
    expect(lues[0].items[0].refundDue).toBe(2300)
  })

  it('compte juste quand DEUX commandes sont retenues, dont une seule est mixte', async () => {
    // Le second signalement, avec ses chiffres réels (tarif 84 de l'édition 22) : deux commandes
    // retenues, l'une avec un seul billet à 18 €, l'autre avec ce même tarif à 18 € PLUS un
    // billet à 30 € d'un autre tarif. L'écran annonçait « 3 billets, 66,00 € » — il additionnait
    // le billet de trop et le montant de la commande entière.
    mockCanAccess.mockResolvedValue(true)
    global.getQuery.mockReturnValue({ page: '1', limit: '20', tierIds: '84' })

    const commandes = [
      {
        id: 461,
        amount: 1800,
        status: 'Processed',
        paymentMethod: 'cash',
        externalTicketingId: null,
        items: [
          {
            type: 'Registration',
            amount: 1800,
            state: 'Processed',
            tierId: 84,
            selectedOptions: [],
          },
        ],
      },
      {
        id: 537,
        amount: 4800,
        status: 'Processed',
        paymentMethod: 'cash',
        externalTicketingId: null,
        items: [
          {
            type: 'Registration',
            amount: 1800,
            state: 'Processed',
            tierId: 84,
            selectedOptions: [],
          },
          {
            type: 'Registration',
            amount: 3000,
            state: 'Processed',
            tierId: 87,
            selectedOptions: [],
          },
        ],
      },
    ]

    prismaMock.ticketingOrder.count.mockResolvedValue(2)
    prismaMock.ticketingOrder.findMany
      .mockResolvedValueOnce(
        commandes.map((c) => ({
          ...c,
          externalTicketing: null,
          items: c.items.map((item, i) => ({ ...item, id: c.id * 10 + i })),
        })) as any
      )
      .mockResolvedValueOnce(commandes as any)

    const res = await handler(baseEvent as any)

    expect(res.stats!.totalOrders).toBe(2)
    expect(res.stats!.totalItems).toBe(2)
    expect(res.stats!.totalAmount).toBe(3600)
  })

  describe('la recherche par mots-clés', () => {
    /**
     * Chercher « Jean Dupont » et trouver la commande de Jean Dupont.
     *
     * Le terme entier était cherché dans chaque champ séparément : « Jean Dupont » n'étant ni un
     * prénom ni un nom, la liste ne rendait rien — alors que « Jean » seul trouvait la commande.
     */
    const clausesDe = () =>
      prismaMock.ticketingOrder.findMany.mock.calls.at(-1)?.[0]?.where?.AND ?? []

    beforeEach(() => {
      mockCanAccess.mockResolvedValue(true)
      prismaMock.ticketingOrder.count.mockResolvedValue(0)
      prismaMock.ticketingOrder.findMany.mockResolvedValue([])
    })

    it('exige que chaque mot se retrouve quelque part', async () => {
      global.getQuery.mockReturnValue({ page: '1', limit: '20', search: 'jean dupont' })

      await handler(baseEvent as any)

      const clauses = clausesDe()
      expect(clauses).toHaveLength(2)
      // Chaque mot cherche sur la commande ET à travers ses billets.
      for (const [index, mot] of ['jean', 'dupont'].entries()) {
        const texte = JSON.stringify(clauses[index])
        expect(texte).toContain(mot)
        expect(texte).toContain('items')
      }
    })

    it('se comporte comme avant sur un mot unique', async () => {
      // Le cas de loin le plus fréquent : le changement doit être invisible pour qui cherchait
      // déjà par nom seul.
      global.getQuery.mockReturnValue({ page: '1', limit: '20', search: 'dupont' })

      await handler(baseEvent as any)

      expect(clausesDe()).toHaveLength(1)
    })

    it('ne filtre rien quand le terme ne porte aucun mot', async () => {
      // Ici une recherche vide veut dire « toutes les commandes » — l'écran les liste par défaut,
      // contrairement à la recherche du contrôle d'accès qui, elle, ne doit rien rendre.
      global.getQuery.mockReturnValue({ page: '1', limit: '20', search: '   ' })

      await handler(baseEvent as any)

      expect(clausesDe()).toHaveLength(0)
    })

    it('cherche toujours par identifiant, mot par mot', async () => {
      global.getQuery.mockReturnValue({ page: '1', limit: '20', search: '123 dupont' })

      await handler(baseEvent as any)

      const clauses = clausesDe()
      expect(JSON.stringify(clauses[0])).toContain('"id":123')
      // Un mot qui n'est pas un nombre ne cherche aucun identifiant.
      expect(JSON.stringify(clauses[1])).not.toContain('"id"')
    })
  })

  it('ne calcule pas les stats si recherche active', async () => {
    mockCanAccess.mockResolvedValue(true)
    global.getQuery.mockReturnValue({ page: '1', limit: '20', search: 'John' })

    prismaMock.ticketingOrder.count.mockResolvedValue(1)
    prismaMock.ticketingOrder.findMany.mockResolvedValue([
      {
        id: 1,
        editionId: 1,
        orderDate: new Date('2024-01-01'),
        amount: 5000,
        payerFirstName: 'John',
        payerLastName: 'Doe',
        payerEmail: 'john@example.com',
        externalTicketing: null,
        items: [],
      },
    ] as any)

    const res = await handler(baseEvent as any)

    expect(res.stats).toBeNull()
    // Vérifier que findMany n'a été appelé qu'une fois (pour la pagination)
    expect(prismaMock.ticketingOrder.findMany).toHaveBeenCalledTimes(1)
  })

  it('filtre par recherche', async () => {
    mockCanAccess.mockResolvedValue(true)
    global.getQuery.mockReturnValue({ page: '1', limit: '20', search: 'John' })

    prismaMock.ticketingOrder.count.mockResolvedValue(1)
    prismaMock.ticketingOrder.findMany.mockResolvedValue([])

    await handler(baseEvent as any)

    expect(prismaMock.ticketingOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          editionId: 1,
          // Les mots sont NORMALISÉS avant la requête — minuscules, accents retirés. Sans
          // conséquence sur les résultats, la collation de la base ignorant déjà l'un et l'autre ;
          // le gain est que « jerome » trouve désormais « Jérôme ».
          AND: [
            {
              OR: expect.arrayContaining([
                { payerFirstName: { contains: 'john' } },
                { payerLastName: { contains: 'john' } },
                { payerEmail: { contains: 'john' } },
              ]),
            },
          ],
        }),
      })
    )
  })

  it('filtre par ID de commande numérique', async () => {
    mockCanAccess.mockResolvedValue(true)
    global.getQuery.mockReturnValue({ page: '1', limit: '20', search: '123' })

    prismaMock.ticketingOrder.count.mockResolvedValue(1)
    prismaMock.ticketingOrder.findMany.mockResolvedValue([])

    await handler(baseEvent as any)

    expect(prismaMock.ticketingOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          editionId: 1,
          AND: [
            {
              OR: expect.arrayContaining([
                { id: 123 }, // Recherche par ID de commande
                { payerFirstName: { contains: '123' } },
              ]),
            },
          ],
        }),
      })
    )
  })

  it('filtre par ID de billet numérique', async () => {
    mockCanAccess.mockResolvedValue(true)
    global.getQuery.mockReturnValue({ page: '1', limit: '20', search: '456' })

    prismaMock.ticketingOrder.count.mockResolvedValue(1)
    prismaMock.ticketingOrder.findMany.mockResolvedValue([])

    await handler(baseEvent as any)

    expect(prismaMock.ticketingOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          editionId: 1,
          AND: [
            {
              OR: expect.arrayContaining([
                {
                  items: {
                    some: {
                      OR: expect.arrayContaining([
                        { id: 456 }, // Recherche par ID de billet
                      ]),
                    },
                  },
                },
              ]),
            },
          ],
        }),
      })
    )
  })

  it('rejette utilisateur non authentifié', async () => {
    await expect(
      handler({ ...baseEvent, context: { ...baseEvent.context, user: null } } as any)
    ).rejects.toThrow('Unauthorized')
  })

  it('rejette si pas de permission', async () => {
    mockCanAccess.mockResolvedValue(false)
    global.getQuery.mockReturnValue({ page: '1', limit: '20' })

    await expect(handler(baseEvent as any)).rejects.toThrow(
      'Droits insuffisants pour accéder à ces données'
    )
  })

  it('valide id invalide', async () => {
    const ev = { ...baseEvent, context: { ...baseEvent.context, params: { id: '0' } } }
    global.getQuery.mockReturnValue({ page: '1', limit: '20' })

    await expect(handler(ev as any)).rejects.toThrow("ID d'édition invalide")
  })

  it('combine plusieurs filtres', async () => {
    mockCanAccess.mockResolvedValue(true)
    global.getQuery.mockReturnValue({
      page: '1',
      limit: '20',
      tierIds: '1,2',
      entryStatus: 'validated',
    })

    prismaMock.ticketingOrder.count.mockResolvedValue(1)
    prismaMock.ticketingOrder.findMany.mockResolvedValue([
      {
        id: 1,
        editionId: 1,
        orderDate: new Date('2024-01-01'),
        amount: 5000,
        externalTicketing: null,
        items: [
          {
            id: 1,
            type: 'Participant',
            amount: 5000,
            tier: { id: 1, name: 'Tarif normal', handoutItems: [] },
            entryValidated: true,
          },
        ],
      },
    ] as any)

    await handler(baseEvent as any)

    // Vérifier que les filtres sont bien combinés avec AND
    expect(prismaMock.ticketingOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          editionId: 1,
          AND: [
            {
              items: {
                some: {
                  AND: [
                    {
                      tierId: {
                        in: [1, 2],
                      },
                    },
                    {
                      entryValidated: true,
                    },
                  ],
                },
              },
            },
          ],
        }),
      })
    )
  })

  it('filtre par statut de commande', async () => {
    mockCanAccess.mockResolvedValue(true)
    global.getQuery.mockReturnValue({ page: '1', limit: '20', statuses: 'Pending,Refunded' })

    prismaMock.ticketingOrder.count.mockResolvedValue(0)
    prismaMock.ticketingOrder.findMany.mockResolvedValue([])

    await handler(baseEvent as any)

    expect(prismaMock.ticketingOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          editionId: 1,
          AND: [{ status: { in: ['Pending', 'Refunded'] } }],
        }),
      })
    )
  })

  it('ignore un statut inconnu au lieu de le transmettre', async () => {
    // Le champ est une chaîne libre en base : un paramètre fabriqué à la main pourrait y glisser
    // n'importe quoi. Filtré ici, il ne restreint rien ; transmis, il rendrait une liste vide sans
    // que rien n'explique pourquoi.
    mockCanAccess.mockResolvedValue(true)
    global.getQuery.mockReturnValue({ page: '1', limit: '20', statuses: 'Pending,Inventé' })

    prismaMock.ticketingOrder.count.mockResolvedValue(0)
    prismaMock.ticketingOrder.findMany.mockResolvedValue([])

    await handler(baseEvent as any)

    expect(prismaMock.ticketingOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [{ status: { in: ['Pending'] } }],
        }),
      })
    )
  })

  it('garde la recherche ET le moyen de paiement, qui produisent deux « OR »', async () => {
    // La régression que ce test verrouille : les deux conditions rendaient chacune un objet
    // `{ OR: [...] }`, et elles étaient étalées dans un même objet littéral. Le second écrasait
    // le premier — chercher « John » en filtrant sur « Liquide » rendait TOUTES les commandes en
    // liquide, la recherche passée à la trappe, sans message ni indice à l'écran.
    //
    // Chaque critère occupe désormais sa propre entrée du `AND`, où deux `OR` coexistent.
    mockCanAccess.mockResolvedValue(true)
    global.getQuery.mockReturnValue({
      page: '1',
      limit: '20',
      search: 'John',
      paymentMethods: 'cash',
    })

    prismaMock.ticketingOrder.count.mockResolvedValue(0)
    prismaMock.ticketingOrder.findMany.mockResolvedValue([])

    await handler(baseEvent as any)

    const { where } = prismaMock.ticketingOrder.findMany.mock.calls.at(-1)![0]

    expect(where.AND).toEqual([
      { OR: [{ paymentMethod: 'cash' }] },
      expect.objectContaining({
        OR: expect.arrayContaining([{ payerFirstName: { contains: 'john' } }]),
      }),
    ])
  })
})
