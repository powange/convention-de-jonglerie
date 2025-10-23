import { describe, it, expect, beforeEach, vi } from 'vitest'

import { prismaMock } from '../../../../../../__mocks__/prisma'
import handler from '../../../../../../../server/api/editions/[id]/ticketing/orders/[orderId].delete'

// Mock de canAccessEditionData pour autoriser l'accès
vi.mock('@@/server/utils/permissions/edition-permissions', () => ({
  canAccessEditionData: vi.fn().mockResolvedValue(true),
}))

// Mock de requireAuth pour simuler un utilisateur authentifié
vi.mock('@@/server/utils/auth-utils', () => ({
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

    expect(result.success).toBe(true)
    expect(result.message).toContain('annulée')
    expect(prismaMock.ticketingOrder.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'Refunded' },
    })
    expect(prismaMock.ticketingOrder.delete).not.toHaveBeenCalled()
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

    expect(result.success).toBe(true)
    expect(result.message).toContain('supprimée')
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
