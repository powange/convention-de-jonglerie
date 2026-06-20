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
})
