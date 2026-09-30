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

import handler from '../../../../../../server/api/notifications/fcm/subscribe.post'
import { global } from '../../../../globales-nitro'

// Utiliser le mock global de Prisma
const prismaMock = (globalThis as any).prisma

describe('/api/notifications/fcm/subscribe POST', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    pseudo: 'testuser',
  }

  const mockFcmToken = {
    id: 'token-1',
    userId: 1,
    token: 'fcm-token-abc123',
    deviceId: 'device-123',
    userAgent: 'Mozilla/5.0',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn().mockResolvedValue({
      token: 'fcm-token-abc123',
      deviceId: 'device-123',
    })
    global.getHeader = vi.fn().mockReturnValue('Mozilla/5.0')
    prismaMock.fcmToken.upsert.mockResolvedValue(mockFcmToken)
    /*
     * L'abonnement libère désormais ce token chez les AUTRES comptes (cf. le bloc dédié plus bas).
     * Le mocker ici est le défaut : Prisma rend toujours un compte, et rendre le handler tolérant
     * à un `undefined` masquerait l'oubli d'une fixture.
     */
    prismaMock.fcmToken.updateMany.mockResolvedValue({ count: 0 })
  })

  it('devrait enregistrer un nouveau token FCM', async () => {
    const mockEvent = { context: { user: mockUser }, node: { req: {} } }

    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(result.message).toBe('Token FCM enregistré')
    expect(prismaMock.fcmToken.upsert).toHaveBeenCalledWith({
      where: {
        userId_token: {
          userId: 1,
          token: 'fcm-token-abc123',
        },
      },
      update: {
        isActive: true,
        deviceId: 'device-123',
        userAgent: 'Mozilla/5.0',
      },
      create: {
        userId: 1,
        token: 'fcm-token-abc123',
        isActive: true,
        deviceId: 'device-123',
        userAgent: 'Mozilla/5.0',
      },
    })
  })

  it('devrait mettre à jour un token existant via upsert', async () => {
    const mockEvent = { context: { user: mockUser }, node: { req: {} } }

    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(result.message).toBe('Token FCM enregistré')
    expect(prismaMock.fcmToken.upsert).toHaveBeenCalledTimes(1)
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const mockEvent = { context: {}, node: { req: {} } }

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('devrait rejeter si token manquant', async () => {
    global.readBody = vi.fn().mockResolvedValue({ deviceId: 'device-123' })

    const mockEvent = { context: { user: mockUser }, node: { req: {} } }

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it("devrait rejeter si token n'est pas une chaîne", async () => {
    global.readBody = vi.fn().mockResolvedValue({ token: 123 })

    const mockEvent = { context: { user: mockUser }, node: { req: {} } }

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('devrait gérer le cas sans deviceId', async () => {
    global.readBody = vi.fn().mockResolvedValue({ token: 'fcm-token-abc123' })

    const mockEvent = { context: { user: mockUser }, node: { req: {} } }

    await handler(mockEvent as any)

    expect(prismaMock.fcmToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          deviceId: undefined,
        }),
        create: expect.objectContaining({
          deviceId: null,
        }),
      })
    )
  })

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.fcmToken.upsert.mockRejectedValue(new Error('DB Error'))

    const mockEvent = { context: { user: mockUser }, node: { req: {} } }

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 500,
    })
  })

  describe('un token appartient à un NAVIGATEUR, pas à un compte', () => {
    /**
     * ⚠️ LE SCÉNARIO, sur un poste partagé — l'ordinateur du guichet, celui d'une médiathèque.
     * Quelqu'un se connecte, s'abonne, part. La personne suivante se connecte et s'abonne :
     * Firebase rend LE MÊME token, puisque c'est la même installation de navigateur. La contrainte
     * `@@unique([userId, token])` autorise les deux lignes à coexister, toutes deux actives — et
     * les notifications du PREMIER continuent d'arriver sur l'écran du SECOND.
     *
     * Le contenu s'affiche dans la notification SYSTÈME : titre, message, nom de l'édition. Il
     * n'est pas besoin d'être connecté pour les lire, ni même d'avoir le site ouvert.
     */

    it('libère le token chez les AUTRES comptes', async () => {
      const mockEvent = { context: { user: mockUser }, node: { req: {} } }

      await handler(mockEvent as any)

      expect(prismaMock.fcmToken.updateMany).toHaveBeenCalledWith({
        where: { token: 'fcm-token-abc123', userId: { not: mockUser.id }, isActive: true },
        data: { isActive: false },
      })
    })

    it('ne touche PAS à la ligne du compte qui s’abonne', async () => {
      /*
       * L'`upsert` qui suit s'en charge. La désactiver ici pour la réactiver juste après
       * laisserait une fenêtre — courte, mais réelle — où l'abonné n'est abonné à rien. Et si
       * l'`upsert` échouait, il resterait désabonné après avoir demandé le contraire.
       */
      const mockEvent = { context: { user: mockUser }, node: { req: {} } }

      await handler(mockEvent as any)

      const where = prismaMock.fcmToken.updateMany.mock.calls[0][0].where
      expect(where.userId).toEqual({ not: mockUser.id })
    })

    it('libère AVANT d’enregistrer', async () => {
      // Mesuré sur l'ordre réel : l'inverse laisserait les deux lignes actives le temps d'un
      // aller-retour, et définitivement si la libération échouait.
      const ordre: string[] = []
      prismaMock.fcmToken.updateMany.mockImplementation(async () => {
        ordre.push('liberation')
        return { count: 1 }
      })
      prismaMock.fcmToken.upsert.mockImplementation(async () => {
        ordre.push('enregistrement')
        return mockFcmToken
      })

      await handler({ context: { user: mockUser }, node: { req: {} } } as any)

      expect(ordre).toEqual(['liberation', 'enregistrement'])
    })

    it('ne désactive que les lignes ACTIVES', async () => {
      // Réécrire une ligne déjà inactive ne changerait rien et toucherait des lignes pour rien.
      await handler({ context: { user: mockUser }, node: { req: {} } } as any)

      expect(prismaMock.fcmToken.updateMany.mock.calls[0][0].where.isActive).toBe(true)
    })
  })
})
