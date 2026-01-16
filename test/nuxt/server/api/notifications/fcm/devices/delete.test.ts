import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../../server/api/notifications/fcm/devices/[id].delete'

// Utiliser le mock global de Prisma
const prismaMock = (globalThis as any).prisma

// Mock de getUserSession
vi.mock('nuxt-auth-utils', () => ({
  getUserSession: vi.fn(),
}))

import { getUserSession } from 'nuxt-auth-utils'

const mockGetUserSession = getUserSession as ReturnType<typeof vi.fn>

describe('/api/notifications/fcm/devices/[id] DELETE', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    pseudo: 'testuser',
  }

  const mockDevice = {
    id: 'device-uuid-123',
    userId: 1,
    token: 'fcm-token-xxx',
    deviceId: 'my-phone',
    userAgent: 'Mozilla/5.0 (iPhone)',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue({ user: mockUser })
    global.getRouterParam = vi.fn().mockReturnValue('device-uuid-123')
    prismaMock.fcmToken.findFirst.mockResolvedValue(mockDevice)
    prismaMock.fcmToken.delete.mockResolvedValue(mockDevice)
  })

  it('devrait supprimer un appareil avec succès', async () => {
    const mockEvent = { node: { req: {} } }

    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(result.message).toBe('Appareil supprimé')
    expect(prismaMock.fcmToken.delete).toHaveBeenCalledWith({
      where: { id: 'device-uuid-123' },
    })
  })

  it("devrait vérifier que l'appareil appartient à l'utilisateur", async () => {
    const mockEvent = { node: { req: {} } }

    await handler(mockEvent as any)

    expect(prismaMock.fcmToken.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'device-uuid-123',
        userId: 1,
      },
    })
  })

  it('devrait rejeter si ID manquant', async () => {
    global.getRouterParam = vi.fn().mockReturnValue(undefined)

    const mockEvent = { node: { req: {} } }

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    mockGetUserSession.mockResolvedValue({ user: null })

    const mockEvent = { node: { req: {} } }

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('devrait rejeter si appareil non trouvé', async () => {
    prismaMock.fcmToken.findFirst.mockResolvedValue(null)

    const mockEvent = { node: { req: {} } }

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('devrait rejeter si appareil appartient à un autre utilisateur', async () => {
    // L'appareil existe mais avec un userId différent -> findFirst retourne null
    prismaMock.fcmToken.findFirst.mockResolvedValue(null)

    const mockEvent = { node: { req: {} } }

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.fcmToken.findFirst.mockRejectedValue(new Error('DB Error'))

    const mockEvent = { node: { req: {} } }

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 500,
    })
  })

  it('devrait relancer les erreurs HTTP', async () => {
    const httpError = { statusCode: 403, message: 'Forbidden' }
    prismaMock.fcmToken.findFirst.mockRejectedValue(httpError)

    const mockEvent = { node: { req: {} } }

    await expect(handler(mockEvent as any)).rejects.toEqual(httpError)
  })
})
