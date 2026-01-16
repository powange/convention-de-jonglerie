import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../server/api/notifications/fcm/check.get'

// Utiliser le mock global de Prisma
const prismaMock = (globalThis as any).prisma

describe('/api/notifications/fcm/check GET', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    pseudo: 'testuser',
    isGlobalAdmin: false,
  }

  const mockActiveToken = {
    id: 'token-uuid-123',
    userId: 1,
    token: 'fcm-token-xxx',
    deviceId: 'my-phone',
    isActive: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.getQuery = vi.fn().mockReturnValue({})
    prismaMock.fcmToken.findFirst.mockResolvedValue(null)
    prismaMock.fcmToken.count.mockResolvedValue(0)
  })

  it('devrait retourner hasActiveToken=false si pas de deviceId fourni', async () => {
    const mockEvent = {
      context: { user: mockUser },
    }
    global.getQuery = vi.fn().mockReturnValue({})
    prismaMock.fcmToken.count.mockResolvedValue(2)

    const result = await handler(mockEvent as any)

    expect(result.hasActiveToken).toBe(false)
    expect(result.tokenCount).toBe(2)
    expect(prismaMock.fcmToken.findFirst).not.toHaveBeenCalled()
  })

  it('devrait retourner hasActiveToken=true si deviceId a un token actif', async () => {
    const mockEvent = {
      context: { user: mockUser },
    }
    global.getQuery = vi.fn().mockReturnValue({ deviceId: 'my-phone' })
    prismaMock.fcmToken.findFirst.mockResolvedValue(mockActiveToken)
    prismaMock.fcmToken.count.mockResolvedValue(1)

    const result = await handler(mockEvent as any)

    expect(result.hasActiveToken).toBe(true)
    expect(result.tokenCount).toBe(1)
  })

  it("devrait retourner hasActiveToken=false si deviceId n'a pas de token actif", async () => {
    const mockEvent = {
      context: { user: mockUser },
    }
    global.getQuery = vi.fn().mockReturnValue({ deviceId: 'unknown-device' })
    prismaMock.fcmToken.findFirst.mockResolvedValue(null)
    prismaMock.fcmToken.count.mockResolvedValue(3)

    const result = await handler(mockEvent as any)

    expect(result.hasActiveToken).toBe(false)
    expect(result.tokenCount).toBe(3)
  })

  it("devrait chercher uniquement les tokens actifs de l'utilisateur", async () => {
    const mockEvent = {
      context: { user: mockUser },
    }
    global.getQuery = vi.fn().mockReturnValue({ deviceId: 'my-phone' })
    prismaMock.fcmToken.findFirst.mockResolvedValue(mockActiveToken)
    prismaMock.fcmToken.count.mockResolvedValue(1)

    await handler(mockEvent as any)

    expect(prismaMock.fcmToken.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 1,
        isActive: true,
        deviceId: 'my-phone',
      },
    })
  })

  it('devrait compter uniquement les tokens actifs', async () => {
    const mockEvent = {
      context: { user: mockUser },
    }
    global.getQuery = vi.fn().mockReturnValue({})
    prismaMock.fcmToken.count.mockResolvedValue(5)

    await handler(mockEvent as any)

    expect(prismaMock.fcmToken.count).toHaveBeenCalledWith({
      where: {
        userId: 1,
        isActive: true,
      },
    })
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const mockEvent = {
      context: {},
    }

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('devrait gérer les erreurs de base de données', async () => {
    const mockEvent = {
      context: { user: mockUser },
    }
    global.getQuery = vi.fn().mockReturnValue({ deviceId: 'my-phone' })
    prismaMock.fcmToken.findFirst.mockRejectedValue(new Error('DB Error'))

    await expect(handler(mockEvent as any)).rejects.toThrow()
  })
})
