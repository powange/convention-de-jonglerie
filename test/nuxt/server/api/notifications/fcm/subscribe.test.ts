import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../server/api/notifications/fcm/subscribe.post'

// Utiliser le mock global de Prisma
const prismaMock = (globalThis as any).prisma

// Mock de getUserSession
vi.mock('nuxt-auth-utils', () => ({
  getUserSession: vi.fn(),
}))

import { getUserSession } from 'nuxt-auth-utils'

const mockGetUserSession = getUserSession as ReturnType<typeof vi.fn>

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
    mockGetUserSession.mockResolvedValue({ user: mockUser })
    global.readBody = vi.fn().mockResolvedValue({
      token: 'fcm-token-abc123',
      deviceId: 'device-123',
    })
    global.getHeader = vi.fn().mockReturnValue('Mozilla/5.0')
    prismaMock.fcmToken.findUnique.mockResolvedValue(null)
    prismaMock.fcmToken.create.mockResolvedValue(mockFcmToken)
  })

  it('devrait enregistrer un nouveau token FCM', async () => {
    const mockEvent = { node: { req: {} } }

    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(result.message).toBe('Token FCM enregistré')
    expect(prismaMock.fcmToken.create).toHaveBeenCalledWith({
      data: {
        userId: 1,
        token: 'fcm-token-abc123',
        isActive: true,
        deviceId: 'device-123',
        userAgent: 'Mozilla/5.0',
      },
    })
  })

  it('devrait mettre à jour un token existant', async () => {
    prismaMock.fcmToken.findUnique.mockResolvedValue(mockFcmToken)
    prismaMock.fcmToken.update.mockResolvedValue({ ...mockFcmToken, isActive: true })

    const mockEvent = { node: { req: {} } }

    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(result.message).toBe('Token FCM déjà enregistré')
    expect(prismaMock.fcmToken.update).toHaveBeenCalled()
    expect(prismaMock.fcmToken.create).not.toHaveBeenCalled()
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    mockGetUserSession.mockResolvedValue({ user: null })

    const mockEvent = { node: { req: {} } }

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('devrait rejeter si token manquant', async () => {
    global.readBody = vi.fn().mockResolvedValue({ deviceId: 'device-123' })

    const mockEvent = { node: { req: {} } }

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it("devrait rejeter si token n'est pas une chaîne", async () => {
    global.readBody = vi.fn().mockResolvedValue({ token: 123 })

    const mockEvent = { node: { req: {} } }

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('devrait gérer le cas sans deviceId', async () => {
    global.readBody = vi.fn().mockResolvedValue({ token: 'fcm-token-abc123' })

    const mockEvent = { node: { req: {} } }

    await handler(mockEvent as any)

    expect(prismaMock.fcmToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        deviceId: null,
      }),
    })
  })

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.fcmToken.findUnique.mockRejectedValue(new Error('DB Error'))

    const mockEvent = { node: { req: {} } }

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 500,
    })
  })
})
