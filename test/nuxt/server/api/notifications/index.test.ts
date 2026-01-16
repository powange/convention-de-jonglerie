import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../server/api/notifications/index.get'

// Mock du NotificationService
vi.mock('../../../../../server/utils/notification-service', () => ({
  NotificationService: {
    getForUser: vi.fn(),
    getUnreadCount: vi.fn(),
  },
}))

import { NotificationService } from '../../../../../server/utils/notification-service'

const mockNotificationService = NotificationService as {
  getForUser: ReturnType<typeof vi.fn>
  getUnreadCount: ReturnType<typeof vi.fn>
}

describe('/api/notifications GET', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    pseudo: 'testuser',
    isGlobalAdmin: false,
  }

  const mockNotifications = [
    {
      id: 'notif-1',
      userId: 1,
      type: 'info',
      category: 'general',
      title: 'Test notification',
      message: 'Test message',
      isRead: false,
      createdAt: new Date(),
      user: {
        id: 1,
        pseudo: 'testuser',
        emailHash: 'abc123',
        profilePicture: null,
      },
    },
    {
      id: 'notif-2',
      userId: 1,
      type: 'success',
      category: 'convention',
      title: 'Another notification',
      message: 'Another message',
      isRead: true,
      createdAt: new Date(),
      user: {
        id: 1,
        pseudo: 'testuser',
        emailHash: 'abc123',
        profilePicture: null,
      },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockNotificationService.getForUser.mockResolvedValue(mockNotifications)
    mockNotificationService.getUnreadCount.mockResolvedValue(5)
    global.getQuery = vi.fn().mockReturnValue({})
  })

  it("devrait retourner les notifications de l'utilisateur", async () => {
    const mockEvent = {
      context: { user: mockUser },
    }

    const result = await handler(mockEvent as any)

    expect(result.data).toHaveLength(2)
    expect(result.unreadCount).toBe(5)
    expect(mockNotificationService.getForUser).toHaveBeenCalledWith({
      userId: 1,
      isRead: undefined,
      category: undefined,
      limit: 50,
      offset: 0,
    })
  })

  it('devrait filtrer par statut de lecture', async () => {
    const mockEvent = {
      context: { user: mockUser },
    }
    global.getQuery = vi.fn().mockReturnValue({ isRead: 'false' })

    await handler(mockEvent as any)

    expect(mockNotificationService.getForUser).toHaveBeenCalledWith(
      expect.objectContaining({ isRead: false })
    )
  })

  it('devrait filtrer par catégorie', async () => {
    const mockEvent = {
      context: { user: mockUser },
    }
    global.getQuery = vi.fn().mockReturnValue({ category: 'convention' })

    await handler(mockEvent as any)

    expect(mockNotificationService.getForUser).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'convention' })
    )
  })

  it('devrait supporter la pagination', async () => {
    const mockEvent = {
      context: { user: mockUser },
    }
    global.getQuery = vi.fn().mockReturnValue({ limit: '10', offset: '20' })

    await handler(mockEvent as any)

    expect(mockNotificationService.getForUser).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 20 })
    )
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const mockEvent = {
      context: {},
    }

    await expect(handler(mockEvent as any)).rejects.toThrow()
  })

  it('devrait retourner la structure paginée correcte', async () => {
    const mockEvent = {
      context: { user: mockUser },
    }

    const result = await handler(mockEvent as any)

    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('pagination')
    expect(result).toHaveProperty('unreadCount')
    expect(result.pagination).toHaveProperty('page')
    expect(result.pagination).toHaveProperty('limit')
    expect(result.pagination).toHaveProperty('totalCount')
  })

  it("devrait masquer l'email dans les données utilisateur", async () => {
    const mockEvent = {
      context: { user: mockUser },
    }

    const result = await handler(mockEvent as any)

    result.data.forEach((notif: any) => {
      expect(notif.user).not.toHaveProperty('email')
      expect(notif.user).toHaveProperty('emailHash')
    })
  })
})
