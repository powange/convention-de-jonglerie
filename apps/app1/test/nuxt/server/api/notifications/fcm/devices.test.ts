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

import handler from '../../../../../../server/api/notifications/fcm/devices.get'

// Utiliser le mock global de Prisma
const prismaMock = (globalThis as any).prisma

describe('/api/notifications/fcm/devices GET', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    pseudo: 'testuser',
  }

  const mockDevices = [
    {
      id: 'device-1',
      deviceId: 'my-phone',
      userAgent: 'Mozilla/5.0 (iPhone)',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-15'),
    },
    {
      id: 'device-2',
      deviceId: 'my-laptop',
      userAgent: 'Mozilla/5.0 (Windows)',
      createdAt: new Date('2024-01-10'),
      updatedAt: new Date('2024-01-20'),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.fcmToken.findMany.mockResolvedValue(mockDevices)
  })

  it('devrait retourner la liste des appareils enregistrés', async () => {
    const mockEvent = { context: { user: mockUser }, node: { req: {} } }

    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(2)
    expect(result.data).toEqual(mockDevices)
  })

  it('devrait filtrer uniquement les tokens actifs', async () => {
    const mockEvent = { context: { user: mockUser }, node: { req: {} } }

    await handler(mockEvent as any)

    expect(prismaMock.fcmToken.findMany).toHaveBeenCalledWith({
      where: {
        userId: 1,
        isActive: true,
      },
      select: {
        id: true,
        deviceId: true,
        userAgent: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const mockEvent = { context: {}, node: { req: {} } }

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('devrait retourner une liste vide si aucun appareil', async () => {
    prismaMock.fcmToken.findMany.mockResolvedValue([])

    const mockEvent = { context: { user: mockUser }, node: { req: {} } }

    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(result.data).toEqual([])
  })

  it('devrait gérer les erreurs de base de données', async () => {
    prismaMock.fcmToken.findMany.mockRejectedValue(new Error('DB Error'))

    const mockEvent = { context: { user: mockUser }, node: { req: {} } }

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 500,
    })
  })
})
