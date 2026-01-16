import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../server/api/notifications/stats.get'

// Mock du NotificationService
vi.mock('../../../../../server/utils/notification-service', () => ({
  NotificationService: {
    getStats: vi.fn(),
  },
}))

import { NotificationService } from '../../../../../server/utils/notification-service'

const mockNotificationService = NotificationService as {
  getStats: ReturnType<typeof vi.fn>
}

describe('/api/notifications/stats GET', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    pseudo: 'testuser',
    isGlobalAdmin: false,
  }

  const mockStats = {
    total: 25,
    unread: 10,
    byCategory: {
      general: { total: 5, unread: 2 },
      convention: { total: 10, unread: 5 },
      volunteer: { total: 10, unread: 3 },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockNotificationService.getStats.mockResolvedValue(mockStats)
  })

  it('devrait retourner les statistiques de notifications', async () => {
    const mockEvent = {
      context: { user: mockUser },
    }

    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(result.stats).toEqual(mockStats)
    expect(mockNotificationService.getStats).toHaveBeenCalledWith(1)
  })

  it('devrait rejeter si utilisateur non authentifié', async () => {
    const mockEvent = {
      context: {},
    }

    await expect(handler(mockEvent as any)).rejects.toThrow()
  })

  it('devrait appeler getStats avec le bon userId', async () => {
    const mockEvent = {
      context: { user: { ...mockUser, id: 42 } },
    }

    await handler(mockEvent as any)

    expect(mockNotificationService.getStats).toHaveBeenCalledWith(42)
  })
})
