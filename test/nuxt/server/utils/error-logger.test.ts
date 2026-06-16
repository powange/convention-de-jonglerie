import { describe, it, expect, vi, beforeEach } from 'vitest'

import { logApiError } from '../../../../server/utils/error-logger'

// Mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const makeEvent = (userId?: number) => ({
  node: {
    req: {
      url: '/api/test',
      method: 'GET',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    },
  },
  context: { user: userId ? { id: userId } : undefined },
})

describe('error-logger – logApiError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('enregistre le log avec le userId de la session', async () => {
    prismaMock.apiErrorLog.create.mockResolvedValue({})

    await logApiError({ error: new Error('boom'), statusCode: 400, event: makeEvent(7) as any })

    expect(prismaMock.apiErrorLog.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.apiErrorLog.create.mock.calls[0][0].data.userId).toBe(7)
  })

  // Garde-fou : le userId vient d'un cookie de session et peut référencer un utilisateur supprimé
  // (ex. session restée valide après un reset de la base). Le log ne doit pas être perdu : on
  // réessaie sans le lien utilisateur sur violation de clé étrangère (P2003).
  it('réessaie sans userId quand la clé étrangère userId est violée (P2003)', async () => {
    prismaMock.apiErrorLog.create
      .mockRejectedValueOnce(Object.assign(new Error('FK'), { code: 'P2003' }))
      .mockResolvedValueOnce({})

    await logApiError({ error: new Error('boom'), statusCode: 400, event: makeEvent(999) as any })

    expect(prismaMock.apiErrorLog.create).toHaveBeenCalledTimes(2)
    expect(prismaMock.apiErrorLog.create.mock.calls[0][0].data.userId).toBe(999)
    expect(prismaMock.apiErrorLog.create.mock.calls[1][0].data.userId).toBeNull()
  })

  it('ne réessaie pas pour une autre erreur de base de données', async () => {
    prismaMock.apiErrorLog.create.mockRejectedValue(
      Object.assign(new Error('autre'), { code: 'P2002' })
    )

    // L'erreur est avalée par le try/catch externe de logApiError (le logging ne doit jamais
    // faire planter l'application) : l'appel ne rejette pas.
    await expect(
      logApiError({ error: new Error('boom'), statusCode: 400, event: makeEvent(7) as any })
    ).resolves.toBeUndefined()

    expect(prismaMock.apiErrorLog.create).toHaveBeenCalledTimes(1)
  })
})
