import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../server/api/notifications/fcm/unsubscribe.post'

// Utiliser le mock global de Prisma
const prismaMock = (globalThis as any).prisma

// Mock de getUserSession
vi.mock('nuxt-auth-utils', () => ({
  getUserSession: vi.fn(),
}))

import { getUserSession } from 'nuxt-auth-utils'

const mockGetUserSession = getUserSession as ReturnType<typeof vi.fn>

describe('/api/notifications/fcm/unsubscribe POST', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    pseudo: 'testuser',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue({ user: mockUser })
    global.readBody = vi.fn().mockResolvedValue({})
    prismaMock.fcmToken.updateMany.mockResolvedValue({ count: 3 })
  })

  it("devrait désactiver tous les tokens de l'utilisateur", async () => {
    const mockEvent = { node: { req: {} } }

    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(result.count).toBe(3)
    expect(prismaMock.fcmToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 1,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    })
  })

  it('devrait désactiver un token spécifique', async () => {
    global.readBody = vi.fn().mockResolvedValue({ token: 'specific-token-123' })
    prismaMock.fcmToken.updateMany.mockResolvedValue({ count: 1 })

    const mockEvent = { node: { req: {} } }

    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(result.count).toBe(1)
    expect(prismaMock.fcmToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 1,
        token: 'specific-token-123',
      },
      data: {
        isActive: false,
      },
    })
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    mockGetUserSession.mockResolvedValue({ user: null })

    const mockEvent = { node: { req: {} } }

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.fcmToken.updateMany.mockRejectedValue(new Error('DB Error'))

    const mockEvent = { node: { req: {} } }

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 500,
    })
  })

  it('devrait retourner count: 0 si aucun token à désactiver', async () => {
    prismaMock.fcmToken.updateMany.mockResolvedValue({ count: 0 })

    const mockEvent = { node: { req: {} } }

    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(result.count).toBe(0)
  })

  it('devrait gérer le cas où readBody échoue', async () => {
    global.readBody = vi.fn().mockRejectedValue(new Error('Parse error'))
    prismaMock.fcmToken.updateMany.mockResolvedValue({ count: 2 })

    const mockEvent = { node: { req: {} } }

    // Le handler attrape l'erreur et utilise un objet vide
    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
  })
})
