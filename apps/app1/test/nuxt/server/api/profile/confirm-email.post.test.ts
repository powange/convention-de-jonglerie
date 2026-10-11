import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockConfirmer = vi.hoisted(() => vi.fn())
const mockLimiteur = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))
vi.mock('#server/utils/changement-d-adresse', () => ({
  confirmerChangementDAdresse: mockConfirmer,
}))
vi.mock('#server/utils/rate-limiter', () => ({
  verificationCodeRateLimiter: mockLimiteur,
}))

import handler from '../../../../../server/api/profile/confirm-email.post'
import { global } from '../../../globales-nitro'

/**
 * Le second temps du changement d'adresse — constat B2.
 *
 * La règle elle-même est éprouvée dans `changement-d-adresse.test.ts` : ce qui se vérifie ici est
 * le CÂBLAGE, et surtout l'ordre — un code à six chiffres se force, et un point d'API de
 * vérification sans limiteur de débit est une invitation.
 */
const MOI = 7
const evenement = { context: { user: { id: MOI, email: 'camille@exemple.test' } } }

describe('POST /api/profile/confirm-email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfirmer.mockResolvedValue({ email: 'neuve@exemple.test', emailHash: 'abc' })
    global.readBody.mockReset()
  })

  it('⚠️ PASSE PAR LE LIMITEUR DE DÉBIT, puis bascule l’adresse', async () => {
    global.readBody.mockResolvedValue({ code: ' 123456 ' })

    const res: any = await handler(evenement as any)

    expect(mockLimiteur).toHaveBeenCalled()
    // Le code est rogné par le schéma : un copier-coller avec une espace ne doit pas échouer.
    expect(mockConfirmer).toHaveBeenCalledWith({ userId: MOI, code: '123456' })
    expect(res.data).toEqual({ email: 'neuve@exemple.test', emailHash: 'abc' })
  })

  it('refuse un corps sans code', async () => {
    global.readBody.mockResolvedValue({})

    await expect(handler(evenement as any)).rejects.toThrow()
    expect(mockConfirmer).not.toHaveBeenCalled()
  })

  it('relaie le refus de la règle', async () => {
    mockConfirmer.mockRejectedValue(
      Object.assign(new Error('Code de confirmation expiré'), { statusCode: 400 })
    )
    global.readBody.mockResolvedValue({ code: '123456' })

    await expect(handler(evenement as any)).rejects.toThrow('expiré')
  })
})
