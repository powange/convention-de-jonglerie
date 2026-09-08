import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockRequireApiToken = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/api-helpers', () => ({
  wrapApiHandler: (handler: any) => handler,
}))

vi.mock('#server/utils/public-api-auth', () => ({
  requireApiToken: mockRequireApiToken,
}))

import handler from '../../../../../server/api/public/error-logs.get'

const prismaMock = (globalThis as any).prisma

/** Les options passées au `findMany` des logs. */
const requete = () => prismaMock.apiErrorLog.findMany.mock.calls[0]?.[0] ?? {}

/**
 * Cet endpoint est ouvert à un token de supervision : ce qu'il expose est un contrat, et le
 * commentaire du fichier ne suffit pas à le tenir.
 *
 * Le référent y a été ajouté après coup — des `/api/editions/NaN` revenaient sans qu'on puisse
 * dire quelle page construisait l'URL, et le diagnostic s'arrêtait là. Le reste des champs de
 * contexte doit rester dehors : c'est là que se trouvent l'adresse IP, le navigateur, le corps
 * de la requête et l'utilisateur.
 */
describe('GET /api/public/error-logs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireApiToken.mockResolvedValue(undefined)
    // `getQuery` est un auto-import de Nitro, absent du contexte de test.
    ;(global as any).getQuery = vi.fn().mockReturnValue({})
    prismaMock.apiErrorLog.count.mockResolvedValue(0)
    prismaMock.apiErrorLog.findMany.mockResolvedValue([])
  })

  const evenement = { context: {}, node: { req: { url: '/api/public/error-logs' } } }

  it('expose le référent', async () => {
    await handler(evenement as any)

    expect(requete().select).toMatchObject({ referer: true })
  })

  it('laisse dehors tout ce qui identifie la personne ou la requête', async () => {
    await handler(evenement as any)

    const champs = Object.keys(requete().select ?? {})
    for (const sensible of [
      'ip',
      'userAgent',
      'headers',
      'body',
      'stack',
      'userId',
      'user',
      'queryParams',
      'url',
    ]) {
      expect(champs).not.toContain(sensible)
    }
  })

  it('exige le scope error-logs avant toute lecture', async () => {
    await handler(evenement as any)

    expect(mockRequireApiToken).toHaveBeenCalledWith(expect.anything(), 'error-logs')
  })

  it('ne rend que les erreurs non résolues', async () => {
    await handler(evenement as any)

    expect(requete().where).toMatchObject({ resolved: false })
  })
})
