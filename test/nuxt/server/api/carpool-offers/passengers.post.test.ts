import { describe, it, expect } from 'vitest'

describe('/api/carpool-offers/[id]/passengers POST (deprecated)', () => {
  it('retourne une erreur 410 - endpoint retiré', async () => {
    const { default: handler } =
      await import('../../../../../server/api/carpool-offers/[id]/passengers.post')

    await expect(handler({} as any)).rejects.toThrow(
      'Endpoint retiré. Utilisez le système de réservations.'
    )
  })
})
