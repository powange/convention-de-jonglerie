import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../server/api/notifications/mark-all-read.patch'

// Mock du NotificationService
vi.mock('../../../../../server/utils/notification-service', () => ({
  NotificationService: {
    markAllAsRead: vi.fn(),
  },
}))

import { NotificationService } from '../../../../../server/utils/notification-service'

const mockNotificationService = NotificationService as {
  markAllAsRead: ReturnType<typeof vi.fn>
}

describe('/api/notifications/mark-all-read PATCH', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    pseudo: 'testuser',
    isGlobalAdmin: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockNotificationService.markAllAsRead.mockResolvedValue({ count: 5 })
    global.readBody = vi.fn().mockResolvedValue({})
  })

  it('devrait marquer toutes les notifications comme lues', async () => {
    const mockEvent = {
      context: { user: mockUser },
    }

    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(result.data.updatedCount).toBe(5)
    expect(mockNotificationService.markAllAsRead).toHaveBeenCalledWith(1, undefined)
  })

  it("devrait marquer uniquement les notifications d'une catégorie", async () => {
    const mockEvent = {
      context: { user: mockUser },
    }
    global.readBody = vi.fn().mockResolvedValue({ category: 'convention' })

    await handler(mockEvent as any)

    expect(mockNotificationService.markAllAsRead).toHaveBeenCalledWith(1, 'convention')
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const mockEvent = {
      context: {},
    }

    await expect(handler(mockEvent as any)).rejects.toThrow()
  })

  it('devrait retourner un message adapté au nombre de notifications', async () => {
    const mockEvent = {
      context: { user: mockUser },
    }
    mockNotificationService.markAllAsRead.mockResolvedValue({ count: 1 })

    const result = await handler(mockEvent as any)

    expect(result.message).toContain('1 notification')
    expect(result.message).not.toContain('notifications')
  })

  it('devrait retourner un message pluriel pour plusieurs notifications', async () => {
    const mockEvent = {
      context: { user: mockUser },
    }
    mockNotificationService.markAllAsRead.mockResolvedValue({ count: 3 })

    const result = await handler(mockEvent as any)

    expect(result.message).toContain('3 notifications')
  })

  it('devrait gérer le cas où readBody échoue', async () => {
    const mockEvent = {
      context: { user: mockUser },
    }
    global.readBody = vi.fn().mockRejectedValue(new Error('Parse error'))

    // Le handler attrape l'erreur et utilise un objet vide
    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(mockNotificationService.markAllAsRead).toHaveBeenCalledWith(1, undefined)
  })
})
