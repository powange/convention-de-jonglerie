import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock de requireAuth pour simuler un utilisateur authentifié
vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => {
    if (!event.context.user) {
      throw createError({ status: 401, message: 'Unauthorized' })
    }
    return event.context.user
  }),
}))

import handler from '../../../../../../server/api/notifications/fcm/unsubscribe.post'
import { global } from '../../../../globales-nitro'

// Utiliser le mock global de Prisma
const prismaMock = (globalThis as any).prisma

/**
 * Couper les notifications sur un appareil ne les coupe que sur celui-là.
 *
 * ⚠️ CE QUI N'ALLAIT PAS, et pourquoi ça ne se voyait pas. Un corps VIDE désactivait tous les
 * tokens actifs de l'utilisateur — et le client appelait justement cette route sans corps. Couper
 * les notifications sur son téléphone les coupait donc aussi sur son ordinateur et sa tablette.
 * Rien ne le disait ; on ne s'en apercevait qu'en ne recevant plus rien là où on n'avait rien
 * demandé, des jours plus tard, sans pouvoir relier les deux.
 *
 * Le corps vide n'est donc PAS accepté comme « tout » : c'était exactement la forme du défaut.
 * Effacer tous ses appareils reste possible, mais il faut le demander — `all: true`.
 */

describe('/api/notifications/fcm/unsubscribe POST', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    pseudo: 'testuser',
  }

  const mockEvent = { context: { user: mockUser }, node: { req: {} } }

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn().mockResolvedValue({ deviceId: 'appareil-a' })
    prismaMock.fcmToken.updateMany.mockResolvedValue({ count: 1 })
  })

  it('ne désactive que les tokens de l’APPAREIL désigné', async () => {
    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(prismaMock.fcmToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 1,
        OR: [{ deviceId: 'appareil-a' }],
      },
      data: { isActive: false },
    })
  })

  it('ne filtre JAMAIS sur `isActive` hors du cas « tous »', async () => {
    /*
     * Le test qui empêche le défaut de revenir sous une autre forme. Le seul `where` qui porte
     * `isActive: true` sans désigner d'appareil est celui de `all` : si un jour un critère
     * d'appareil disparaissait de la requête, il resterait « tous les tokens actifs » — c'est-à-dire
     * le défaut d'origine, à l'identique.
     */
    await handler(mockEvent as any)

    const where = prismaMock.fcmToken.updateMany.mock.calls[0][0].where
    expect(where.isActive).toBeUndefined()
    expect(where.OR.length).toBeGreaterThan(0)
  })

  it('vise l’appareil ET le token quand les deux sont donnés', async () => {
    /*
     * Ce n'est pas une redondance. Firebase fait TOURNER les tokens : un même appareil peut avoir
     * plusieurs lignes, et n'en désactiver qu'une laisserait les notifications arriver. À l'inverse,
     * les lignes créées avant la colonne `deviceId` portent `deviceId: null` et ne se retrouvent
     * que par leur token. Chaque critère rattrape ce que l'autre laisse passer.
     */
    global.readBody = vi.fn().mockResolvedValue({ deviceId: 'appareil-a', token: 'jeton-123' })

    await handler(mockEvent as any)

    expect(prismaMock.fcmToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 1,
        OR: [{ deviceId: 'appareil-a' }, { token: 'jeton-123' }],
      },
      data: { isActive: false },
    })
  })

  it('désactive un token seul quand l’appareil est inconnu', async () => {
    // Le cas des lignes anciennes, sans `deviceId`.
    global.readBody = vi.fn().mockResolvedValue({ token: 'jeton-123' })

    await handler(mockEvent as any)

    expect(prismaMock.fcmToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 1, OR: [{ token: 'jeton-123' }] },
      data: { isActive: false },
    })
  })

  it('`all: true` coupe bien TOUS les appareils', async () => {
    // Le geste reste possible — il doit seulement se demander.
    global.readBody = vi.fn().mockResolvedValue({ all: true })
    prismaMock.fcmToken.updateMany.mockResolvedValue({ count: 3 })

    const result = await handler(mockEvent as any)

    expect(result.data.count).toBe(3)
    expect(prismaMock.fcmToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 1, isActive: true },
      data: { isActive: false },
    })
  })

  it('un corps VIDE est refusé, et n’écrit rien', async () => {
    /*
     * Le cœur du lot. Cette forme-là est celle que le client envoyait, et celle qui effaçait tous
     * les appareils. La refuser est le seul moyen de garantir qu'aucun appelant — ni un onglet
     * resté ouvert, ni un script — ne puisse plus déclencher « tout » sans l'avoir écrit.
     */
    global.readBody = vi.fn().mockResolvedValue({})

    await expect(handler(mockEvent as any)).rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.fcmToken.updateMany).not.toHaveBeenCalled()
  })

  it('un corps ILLISIBLE est refusé de la même façon', async () => {
    // `readBody` en échec retombait sur un objet vide, donc sur « tous les appareils ».
    global.readBody = vi.fn().mockRejectedValue(new Error('Parse error'))

    await expect(handler(mockEvent as any)).rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.fcmToken.updateMany).not.toHaveBeenCalled()
  })

  it('`all: false` ne vaut pas « tous » — ni rien du tout', async () => {
    // Un client qui enverrait `all: false` en croyant désigner « cet appareil » ne désigne rien :
    // mieux vaut un refus lisible qu'une requête sans critère.
    global.readBody = vi.fn().mockResolvedValue({ all: false })

    await expect(handler(mockEvent as any)).rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.fcmToken.updateMany).not.toHaveBeenCalled()
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    await expect(handler({ context: {}, node: { req: {} } } as any)).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.fcmToken.updateMany.mockRejectedValue(new Error('DB Error'))

    await expect(handler(mockEvent as any)).rejects.toMatchObject({ statusCode: 500 })
  })

  it('devrait retourner count: 0 si aucun token à désactiver', async () => {
    prismaMock.fcmToken.updateMany.mockResolvedValue({ count: 0 })

    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(result.data.count).toBe(0)
  })
})
