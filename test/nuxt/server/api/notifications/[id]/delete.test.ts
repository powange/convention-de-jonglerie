import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../server/api/notifications/[id]/delete.delete'

// Mock du NotificationService
vi.mock('../../../../../../server/utils/notification-service', () => ({
  NotificationService: {
    delete: vi.fn(),
  },
}))

import { NotificationService } from '../../../../../../server/utils/notification-service'

const mockNotificationService = NotificationService as {
  delete: ReturnType<typeof vi.fn>
}

describe('/api/notifications/[id] DELETE', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    pseudo: 'testuser',
    isGlobalAdmin: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockNotificationService.delete.mockResolvedValue(undefined)
    global.getRouterParam = vi.fn().mockReturnValue('notif-123')
  })

  it('devrait supprimer une notification', async () => {
    const mockEvent = {
      context: { user: mockUser },
    }

    const result = await handler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(result.message).toBe('Notification supprimée')
    expect(mockNotificationService.delete).toHaveBeenCalledWith('notif-123', 1)
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
    mockNotificationService.delete.mockRejectedValue({ code: 'P2025' })

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('devrait encapsuler les erreurs génériques en erreur 500', async () => {
    const mockEvent = {
      context: { user: mockUser },
    }
    const error = new Error('Database error')
    mockNotificationService.delete.mockRejectedValue(error)

    await expect(handler(mockEvent as any)).rejects.toMatchObject({
      statusCode: 500,
    })
  })
})
