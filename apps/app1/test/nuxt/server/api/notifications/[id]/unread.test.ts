import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../server/api/notifications/[id]/unread.patch'

// Mock du NotificationService
vi.mock('../../../../../../server/utils/notification-service', () => ({
  NotificationService: {
    markAsUnread: vi.fn(),
  },
}))

import { NotificationService } from '../../../../../../server/utils/notification-service'

const mockNotificationService = NotificationService as {
  markAsUnread: ReturnType<typeof vi.fn>
}

describe('/api/notifications/[id]/unread PATCH', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    pseudo: 'testuser',
    isGlobalAdmin: false,
  }

  const mockNotification = {
    id: 'notif-123',
    userId: 1,
    type: 'info',
    title: 'Test',
    message: 'Test message',
    isRead: false,
    createdAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockNotificationService.markAsUnread.mockResolvedValue(mockNotification)
    global.getRouterParam = vi.fn().mockReturnValue('notif-123')
  })

  it('devrait marquer une notification comme non lue', async () => {
    const mockEvent = {
      context: { user: mockUser },
    }

    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(result.message).toBe('Notification marquée comme non lue')
    expect(result.data.notification).toEqual(mockNotification)
    expect(mockNotificationService.markAsUnread).toHaveBeenCalledWith('notif-123', 1)
  })

  it('devrait rejeter si ID manquant', async () => {
    const mockEvent = {
      context: { user: mockUser },
    }
    global.getRouterParam = vi.fn().mockReturnValue(undefined)

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const mockEvent = {
      context: {},
    }

    await expect(handler(mockEvent as any)).rejects.toThrow()
  })

  it('devrait rejeter si notification non trouvée (P2025)', async () => {
    const mockEvent = {
      context: { user: mockUser },
    }
    mockNotificationService.markAsUnread.mockRejectedValue({ code: 'P2025' })

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('devrait encapsuler les erreurs génériques en erreur 500', async () => {
    const mockEvent = {
      context: { user: mockUser },
    }
    const error = new Error('Database error')
    mockNotificationService.markAsUnread.mockRejectedValue(error)

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 500,
    })
  })
})
