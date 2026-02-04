import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock des utilitaires - DOIT être avant les imports
vi.mock('../../../../../../server/utils/permissions/edition-permissions', () => ({
  canAccessEditionData: vi.fn(),
}))

import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import handler from '../../../../../../server/api/editions/[id]/ticketing/orders.get'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const mockCanAccess = canAccessEditionData as ReturnType<typeof vi.fn>

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
        items: [
          { id: 1, type: 'Participant', amount: 5000, tier: { id: 1, name: 'Tarif normal' } },
        ],
      },
    ]

    prismaMock.ticketingOrder.count.mockResolvedValue(1)
    prismaMock.ticketingOrder.findMany.mockResolvedValue(mockOrders as any)

    const res = await handler(baseEvent as any)

    expect(res.data).toEqual(mockOrders)
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
        amount: 5000,
        items: [{ type: 'Participant', amount: 5000 }],
      },
      {
        id: 2,
        amount: 3000,
        items: [
          { type: 'Participant', amount: 2500 },
          { type: 'Donation', amount: 500 },
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
        cash: 0,
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
        items: [{ type: 'Participant', amount: 5000 }],
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
              tier: { id: 1, name: 'Tarif normal', returnableItems: [] },
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
        cash: 0,
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
          items: {
            some: {
              tierId: {
                in: [1, 2],
              },
            },
          },
        }),
        select: {
          amount: true,
          status: true,
          paymentMethod: true,
          externalTicketingId: true,
          items: {
            select: {
              type: true,
              amount: true,
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
        items: [{ type: 'Participant', amount: 5000 }],
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
              tier: { id: 1, name: 'Tarif normal', returnableItems: [] },
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
        cash: 0,
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
          items: {
            some: {
              entryValidated: true,
            },
          },
        }),
        select: {
          amount: true,
          status: true,
          paymentMethod: true,
          externalTicketingId: true,
          items: {
            select: {
              type: true,
              amount: true,
            },
          },
        },
      })
    )
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
          OR: expect.arrayContaining([
            { payerFirstName: { contains: 'John' } },
            { payerLastName: { contains: 'John' } },
            { payerEmail: { contains: 'John' } },
          ]),
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
          OR: expect.arrayContaining([
            { id: 123 }, // Recherche par ID de commande
            { payerFirstName: { contains: '123' } },
          ]),
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
            tier: { id: 1, name: 'Tarif normal', returnableItems: [] },
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
        }),
      })
    )
  })
})
