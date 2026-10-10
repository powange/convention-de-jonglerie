import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../server/api/notifications/index.get'

// Mock du NotificationService
vi.mock('../../../../../server/utils/notification-service', () => ({
  NotificationService: {
    getForUser: vi.fn(),
    /*
     * ⚠️ À DÉCLARER ICI, SOUS PEINE DE « n'est pas une fonction ». Un service bouché ne rend que ce
     * qu'on y met : une méthode oubliée fait échouer le handler au premier appel, avec un message
     * qui accuse le code au lieu du harnais.
     */
    countForUser: vi.fn(),
    getUnreadCount: vi.fn(),
  },
}))

import { NotificationService } from '../../../../../server/utils/notification-service'
import { global } from '../../../globales-nitro'

const mockNotificationService = NotificationService as {
  getForUser: ReturnType<typeof vi.fn>
  countForUser: ReturnType<typeof vi.fn>
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
    mockNotificationService.countForUser.mockResolvedValue(mockNotifications.length)
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

  /**
   * Le total de la pagination — constat B3, moitié serveur.
   *
   * ## ⚠️ LE DÉFAUT
   *
   * Le total était ESTIMÉ : `offset + reçues + (page pleine ? limite : 0)`. Comme c'est lui qui
   * décide de `hasNextPage` et de `totalPages`, deux chiffres en sortaient faux. Le cas le plus
   * désagréable est la page exactement pleine : l'estimation ajoutait une page entière qui pouvait
   * être vide, et l'écran proposait un « Charger plus » qui ne rendait rien.
   *
   * ## ⚠️⚠️ CE QUI REND CES CAS NON CREUX
   *
   * Le service est bouché : `getForUser` et `countForUser` rendent ce qu'on leur dit. Ce qu'on
   * mesure n'est donc pas la base, mais le CALCUL du handler — et c'est précisément là qu'était le
   * défaut. Le témoin est une page pleine dont le total dit qu'il n'y a rien de plus : avec
   * l'ancienne estimation, elle annonçait une page suivante.
   */
  describe('le total de la pagination', () => {
    /** Vingt notifications demandées, vingt rendues : la page est exactement pleine. */
    const pagePleine = () => {
      mockNotificationService.getForUser.mockResolvedValue(
        Array.from({ length: 20 }, (_, i) => ({ ...mockNotifications[0], id: `n-${i}` }))
      )
      global.getQuery = vi.fn().mockReturnValue({ limit: '20' })
    }

    it('⚠️ VIENT D’UN COMPTE RÉEL, et annonce la page suivante quand elle existe', async () => {
      pagePleine()
      mockNotificationService.countForUser.mockResolvedValue(25)

      const result = await handler({ context: { user: mockUser } } as any)

      expect(result.pagination.totalCount).toBe(25)
      expect(result.pagination.hasNextPage).toBe(true)
      expect(result.pagination.totalPages).toBe(2)
    })

    it('⚠️ N’EN ANNONCE PAS QUAND LA PAGE PLEINE EST LA DERNIÈRE', async () => {
      /*
       * LE TÉMOIN. Vingt notifications en tout, vingt rendues : il n'y a rien de plus. L'ancienne
       * estimation ajoutait `limit` dès que la page était pleine et annonçait donc une page
       * suivante vide — un « Charger plus » qui ne rend rien se lit comme une panne.
       */
      pagePleine()
      mockNotificationService.countForUser.mockResolvedValue(20)

      const result = await handler({ context: { user: mockUser } } as any)

      expect(result.pagination.totalCount).toBe(20)
      expect(result.pagination.hasNextPage).toBe(false)
      expect(result.pagination.totalPages).toBe(1)
    })

    it('compte sur les MÊMES filtres que la liste', async () => {
      /*
       * Un compte qui ne poserait pas la même condition que la liste annoncerait des pages qui
       * n'existent pas — ou en cacherait. Les deux partent du même objet de filtres, et ce cas le
       * fige : seules la limite et le décalage distinguent les deux appels.
       */
      global.getQuery = vi.fn().mockReturnValue({ isRead: 'false', category: 'convention' })

      await handler({ context: { user: mockUser } } as any)

      expect(mockNotificationService.countForUser).toHaveBeenCalledWith({
        userId: 1,
        isRead: false,
        category: 'convention',
      })
      expect(mockNotificationService.getForUser).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, isRead: false, category: 'convention' })
      )
    })
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
