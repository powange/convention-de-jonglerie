import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * ⚠️ Trois modules bouchonnés, et au niveau du MODULE : le point d'API les importe explicitement,
 * donc un bouchon posé sur `global` ne les atteindrait pas — la vraie garde s'exécuterait et
 * tomberait sur un auto-import non câblé, laissant les cas SAUTÉS plutôt que rouges.
 */
const mockRequireAdmin = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/admin-auth', () => ({
  requireGlobalAdminWithDbCheck: mockRequireAdmin,
}))

const mockConfig = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/ai-config', () => ({ getEffectiveAIConfigAsync: mockConfig }))

const mockClasser = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/veille-classement', () => ({ classerLesCandidats: mockClasser }))

import handler from '../../../../../server/api/admin/veille/classer.post'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

const BILAN = {
  soumis: 3,
  classes: 2,
  illisibles: 1,
  echecs: 0,
  premiereErreur: null,
  parAvis: { CONVENTION: 1, HORS_SUJET: 1, INCERTAIN: 0 },
}

const appeler = (corps: unknown = {}) => {
  global.readBody = vi.fn().mockResolvedValue(corps)
  return (handler as (e: unknown) => Promise<any>)({ context: {} })
}

describe('POST /api/admin/veille/classer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 1, isGlobalAdmin: true })
    mockConfig.mockResolvedValue({ aiProvider: 'anthropic', anthropicApiKey: 'clé-de-test' })
    mockClasser.mockResolvedValue(BILAN)
    prismaMock.candidatEvenement.count.mockResolvedValue(380)
  })

  it('classe avec la limite par défaut et rend le bilan', async () => {
    const resultat = await appeler({})

    expect(mockClasser).toHaveBeenCalledTimes(1)
    expect(mockClasser.mock.calls[0]![0]).toBe(20)
    expect(resultat.data.bilan).toEqual(BILAN)
  })

  it('⚠️ PLAFONNE la limite demandée, plutôt que de lancer des centaines d’appels', async () => {
    /*
     * LE cas. Un appel IA par événement : accepter `limite: 5000` ferait dépasser tous les délais
     * d'attente — requête, proxy, navigateur — et l'opérateur n'aurait AUCUN moyen de savoir ce
     * qui a été classé avant la coupure, tout en l'ayant payé.
     */
    await expect(appeler({ limite: 5000 })).rejects.toBeDefined()
    expect(mockClasser).not.toHaveBeenCalled()
  })

  it('📍 rend le nombre de RESTANTS, compté sur la base et non sur la liste affichée', async () => {
    /*
     * Sans lui, l'écran devrait deviner s'il reste du travail d'après le nombre de lignes
     * visibles — qui est filtré, donc sans rapport avec la file réelle.
     */
    const resultat = await appeler({})

    expect(resultat.data.restants).toBe(380)
    const where = prismaMock.candidatEvenement.count.mock.calls[0][0].where
    expect(where).toEqual({ verdict: 'A_EXAMINER', avisIa: null })
  })

  it('⚠️ relit la configuration IA à CHAQUE appel', async () => {
    /*
     * Un administrateur peut changer de fournisseur entre deux balayages depuis l'écran de
     * configuration. Une config mise en cache ici le ferait classer avec l'ancien — en silence,
     * et avec des résultats qu'il croirait venir du nouveau.
     */
    await appeler({})
    await appeler({})

    expect(mockConfig).toHaveBeenCalledTimes(2)
    // Et la config lue est bien celle passée au moteur, pas un objet reconstruit au passage.
    expect(mockClasser.mock.calls[0]![1]).toMatchObject({ aiProvider: 'anthropic' })
  })

  it('refuse un visiteur qui n’est pas administrateur global', async () => {
    mockRequireAdmin.mockRejectedValue(
      Object.assign(new Error('Accès refusé'), { statusCode: 403 })
    )

    await expect(appeler({})).rejects.toBeDefined()
    expect(mockClasser).not.toHaveBeenCalled()
  })
})
