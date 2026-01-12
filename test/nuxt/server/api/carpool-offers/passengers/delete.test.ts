import { describe, it, expect } from 'vitest'

import handler from '../../../../../../server/api/carpool-offers/[id]/passengers/[userId].delete'

describe('/api/carpool-offers/[id]/passengers/[userId] DELETE (Deprecated)', () => {
  it('devrait retourner une erreur 410 Gone', async () => {
    const mockEvent = {
      context: {
        params: { id: '1', userId: '2' },
        user: { id: 1, email: 'test@example.com', pseudo: 'testuser', isGlobalAdmin: false },
      },
    }

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 410,
    })
  })

  it("devrait indiquer d'utiliser le système de réservations", async () => {
    const mockEvent = {
      context: {
        params: { id: '1', userId: '2' },
        user: { id: 1, email: 'test@example.com', pseudo: 'testuser', isGlobalAdmin: false },
      },
    }

    await expect(handler(mockEvent as any)).rejects.toThrow(
      'Endpoint retiré. Utilisez le système de réservations.'
    )
  })

  it('devrait rejeter même sans authentification', async () => {
    const mockEventWithoutUser = {
      context: {
        params: { id: '1', userId: '2' },
      },
    }

    await expect(handler(mockEventWithoutUser as any)).rejects.toMatchObject({
      statusCode: 410,
    })
  })
})
