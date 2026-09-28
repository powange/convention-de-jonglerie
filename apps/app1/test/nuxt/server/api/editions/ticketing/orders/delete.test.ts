import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockJournal = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/ticketing/journal-des-entrees', () => ({
  journaliserMouvementDEntree: mockJournal,
}))

import handler from '../../../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/orders/[orderId]/index.delete'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

// Mock de canManageTicketingById pour autoriser l'accès
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: vi.fn().mockResolvedValue(true),
}))

// Mock de requireAuth pour simuler un utilisateur authentifié
vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn(() => ({ id: 1, email: 'admin@test.com' })),
}))

const mockEvent = (editionId: number, orderId: number) => ({
  context: {
    params: { id: editionId.toString(), orderId: orderId.toString() },
    user: {
      id: 1,
      email: 'admin@test.com',
    },
  },
})

describe('DELETE /api/editions/[id]/ticketing/orders/[orderId]', () => {
  beforeEach(() => {
    prismaMock.ticketingOrder.findUnique.mockReset()
    prismaMock.ticketingOrder.update.mockReset()
    prismaMock.ticketingOrder.delete.mockReset()
    prismaMock.ticketingOrderItem.updateMany.mockReset()
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])
    mockJournal.mockReset()
    // Les deux écritures partent ensemble : l'annulation ne doit pas pouvoir n'en réussir qu'une.
    prismaMock.$transaction.mockImplementation(async (operations: any) =>
      Array.isArray(operations) ? operations : operations(prismaMock)
    )
  })

  it('devrait annuler une commande manuelle non annulée', async () => {
    const mockOrder = {
      id: 1,
      editionId: 1,
      externalTicketingId: null,
      payerFirstName: 'John',
      payerLastName: 'Doe',
      payerEmail: 'john@example.com',
      amount: 2000,
      status: 'Processed',
      orderDate: new Date(),
      helloAssoOrderId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      externalTicketing: null,
    }

    prismaMock.ticketingOrder.findUnique.mockResolvedValue(mockOrder)
    prismaMock.ticketingOrder.update.mockResolvedValue({
      ...mockOrder,
      status: 'Refunded',
    })

    const result = await handler(mockEvent(1, 1) as any)

    expect(result).toEqual({
      success: true,
      data: null,
      message: 'Commande annulée avec succès',
    })
    expect(prismaMock.ticketingOrder.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'Refunded' },
    })
    expect(prismaMock.ticketingOrder.delete).not.toHaveBeenCalled()
  })

  it('marque aussi chacun des billets de la commande', async () => {
    /**
     * « Ce billet vaut-il encore ? » se lisait sur deux niveaux — l'état de la ligne OU le statut
     * de sa commande — et c'est cette double lecture qui a produit les divergences que
     * `billets-qui-comptent.ts` documente : un écran interrogeait l'un, son voisin l'autre.
     *
     * Tout se lit désormais sur le billet. Le remboursement, lui, n'est PAS touché : annuler ne
     * dit pas qu'on a rendu l'argent, et ces billets doivent apparaître comme dus.
     */
    prismaMock.ticketingOrder.findUnique.mockResolvedValue({
      id: 1,
      editionId: 1,
      externalTicketingId: null,
      status: 'Processed',
      externalTicketing: null,
    })

    await handler(mockEvent(1, 1) as any)

    expect(prismaMock.ticketingOrderItem.updateMany).toHaveBeenCalledWith({
      where: { orderId: 1, state: { not: 'Canceled' } },
      data: expect.objectContaining({ state: 'Canceled', canceledById: 1 }),
    })
    const data = prismaMock.ticketingOrderItem.updateMany.mock.calls[0][0].data
    expect(data.canceledAt).toBeInstanceOf(Date)
    expect(data).not.toHaveProperty('refunded')
  })

  it('fait ressortir les billets déjà entrés, journal compris', async () => {
    /**
     * Annuler une commande dont des billets ont été validés doit les dévalider — et l'écrire au
     * JOURNAL des mouvements, car c'est lui que lit le graphique d'affluence. Sans cette trace,
     * les personnes resteraient comptées présentes jusqu'à la fin de l'édition.
     *
     * Les billets concernés sont relevés AVANT la mise à jour : elle efface le drapeau qui permet
     * de les reconnaître.
     */
    prismaMock.ticketingOrder.findUnique.mockResolvedValue({
      id: 1,
      editionId: 1,
      externalTicketingId: null,
      status: 'Processed',
      externalTicketing: null,
    })
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([{ id: 11 }, { id: 12 }])

    await handler(mockEvent(1, 1) as any)

    expect(prismaMock.ticketingOrderItem.updateMany.mock.calls[0][0].data).toMatchObject({
      entryValidated: false,
      entryValidatedAt: null,
      entryValidatedBy: null,
    })
    expect(mockJournal).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ticket',
        participantIds: [11, 12],
        mouvement: 'INVALIDATED',
      })
    )
  })

  it('n’écrit rien au journal si aucun billet n’était entré', async () => {
    prismaMock.ticketingOrder.findUnique.mockResolvedValue({
      id: 1,
      editionId: 1,
      externalTicketingId: null,
      status: 'Processed',
      externalTicketing: null,
    })

    await handler(mockEvent(1, 1) as any)

    expect(mockJournal).not.toHaveBeenCalled()
  })

  it('devrait supprimer une commande manuelle déjà annulée', async () => {
    const mockOrder = {
      id: 1,
      editionId: 1,
      externalTicketingId: null,
      payerFirstName: 'John',
      payerLastName: 'Doe',
      payerEmail: 'john@example.com',
      amount: 2000,
      status: 'Refunded',
      orderDate: new Date(),
      helloAssoOrderId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      externalTicketing: null,
    }

    prismaMock.ticketingOrder.findUnique.mockResolvedValue(mockOrder)
    prismaMock.ticketingOrder.delete.mockResolvedValue(mockOrder)

    const result = await handler(mockEvent(1, 1) as any)

    expect(result).toEqual({
      success: true,
      data: null,
      message: 'Commande supprimée avec succès',
    })
    expect(prismaMock.ticketingOrder.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    })
    expect(prismaMock.ticketingOrder.update).not.toHaveBeenCalled()
  })

  it('ne devrait pas supprimer une commande importée depuis HelloAsso', async () => {
    const mockOrder = {
      id: 1,
      editionId: 1,
      externalTicketingId: 'external-123',
      payerFirstName: 'Jane',
      payerLastName: 'Smith',
      payerEmail: 'jane@example.com',
      amount: 3000,
      status: 'Processed',
      orderDate: new Date(),
      helloAssoOrderId: 12345,
      createdAt: new Date(),
      updatedAt: new Date(),
      externalTicketing: {
        id: 'external-123',
        editionId: 1,
        provider: 'HELLOASSO',
        organizationSlug: 'test-org',
        formSlug: 'test-form',
        formType: 'Event',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncAt: null,
        clientId: null,
        clientSecret: null,
      },
    }

    prismaMock.ticketingOrder.findUnique.mockResolvedValue(mockOrder)

    await expect(handler(mockEvent(1, 1) as any)).rejects.toThrow()
  })

  it('devrait retourner une erreur pour une commande inexistante', async () => {
    prismaMock.ticketingOrder.findUnique.mockResolvedValue(null)

    await expect(handler(mockEvent(1, 999) as any)).rejects.toThrow()
  })

  it("devrait retourner une erreur si la commande n'appartient pas à l'édition", async () => {
    const mockOrder = {
      id: 1,
      editionId: 2, // Édition différente
      externalTicketingId: null,
      payerFirstName: 'John',
      payerLastName: 'Doe',
      payerEmail: 'john@example.com',
      amount: 2000,
      status: 'Processed',
      orderDate: new Date(),
      helloAssoOrderId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      externalTicketing: null,
    }

    prismaMock.ticketingOrder.findUnique.mockResolvedValue(mockOrder)

    await expect(handler(mockEvent(1, 1) as any)).rejects.toThrow()
  })
})
