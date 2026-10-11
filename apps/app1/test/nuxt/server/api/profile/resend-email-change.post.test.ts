import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRenvoyer = vi.hoisted(() => vi.fn())
const mockLimiteur = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))
vi.mock('#server/utils/changement-d-adresse', () => ({
  renvoyerCodeDeChangement: mockRenvoyer,
}))
vi.mock('#server/utils/rate-limiter', () => ({
  emailRateLimiter: mockLimiteur,
}))

import handler from '../../../../../server/api/profile/resend-email-change.post'

/**
 * Le renvoi du code de changement d'adresse — constat B2.
 *
 * ⚠️ CE QUI SE VÉRIFIE ICI N'EST PAS LA RÈGLE mais le limiteur, et un détail qui ne se voit pas à
 * la relecture : `emailRateLimiter` lit l'adresse dans `event.context.body`. Sans cette ligne, il
 * retombe sur l'IP — et compte alors ENSEMBLE tous les comptes derrière une même connexion, un
 * partage de festival par exemple.
 */
const MOI = 7
const MON_ADRESSE = 'camille@exemple.test'

describe('POST /api/profile/resend-email-change', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRenvoyer.mockResolvedValue({ pendingEmail: 'neuve@exemple.test' })
  })

  it('⚠️ DONNE SON ADRESSE AU LIMITEUR AVANT DE L’APPELER', async () => {
    const evenement: any = { context: { user: { id: MOI, email: MON_ADRESSE } } }

    const res: any = await handler(evenement)

    expect(evenement.context.body).toEqual({ email: MON_ADRESSE })
    expect(mockLimiteur).toHaveBeenCalled()
    expect(mockRenvoyer).toHaveBeenCalledWith(MOI)
    expect(res.data).toEqual({ pendingEmail: 'neuve@exemple.test' })
  })

  it('relaie le refus quand aucune demande n’est en cours', async () => {
    mockRenvoyer.mockRejectedValue(
      Object.assign(new Error('Aucun changement d’adresse en attente'), { statusCode: 400 })
    )

    await expect(
      handler({ context: { user: { id: MOI, email: MON_ADRESSE } } } as any)
    ).rejects.toThrow('Aucun changement')
  })
})
