import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNotificationsStore, type Notification } from '../../../app/stores/notifications'

// Mock $fetch
global.$fetch = vi.fn()

describe('notifications store', () => {
  let store: ReturnType<typeof useNotificationsStore>
  const mockNotifications: Notification[] = [
    {
      id: '1',
      userId: 1,
      type: 'INFO',
      title: 'Test 1',
      titleText: 'Test 1',
      message: 'Message 1',
      messageText: 'Message 1',
      category: 'convention',
      isRead: false,
      createdAt: '2024-03-20T10:00:00Z',
      updatedAt: '2024-03-20T10:00:00Z',
    },
    {
      id: '2',
      userId: 1,
      type: 'SUCCESS',
      title: 'Test 2',
      titleText: 'Test 2',
      message: 'Message 2',
      messageText: 'Message 2',
      category: 'edition',
      isRead: true,
      readAt: '2024-03-20T11:00:00Z',
      createdAt: '2024-03-20T09:00:00Z',
      updatedAt: '2024-03-20T11:00:00Z',
    },
  ]

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useNotificationsStore()
    vi.clearAllMocks()
    // Réinitialiser complètement le store
    store.reset()
  })

  describe('state initial', () => {
    it('a un état initial correct', () => {
      expect(store.notifications).toEqual([])
      expect(store.unreadCount).toBe(0)
      expect(store.loading).toBe(false)
      expect(store.hasMore).toBe(true)
      expect(store.realTimeEnabled).toBe(false)
    })
  })

  describe('getters', () => {
    beforeEach(() => {
      store.notifications = mockNotifications
    })

    it('filtre les notifications non lues', () => {
      expect(store.unreadNotifications).toHaveLength(1)
      expect(store.unreadNotifications[0].id).toBe('1')
    })

    it('groupe les notifications par catégorie', () => {
      const grouped = store.notificationsByCategory
      expect(grouped.convention).toHaveLength(1)
      expect(grouped.edition).toHaveLength(1)
      expect(grouped.convention[0].id).toBe('1')
    })

    it('retourne les notifications récentes', () => {
      expect(store.recentNotifications).toHaveLength(1)
      expect(store.recentNotifications[0].id).toBe('1')
    })
  })

  describe('fetchNotifications', () => {
    it("charge les notifications depuis l'API", async () => {
      const mockResponse = {
        success: true,
        data: mockNotifications,
        unreadCount: 1,
        pagination: { limit: 20, offset: 0, hasMore: false },
      }

      vi.mocked($fetch).mockResolvedValue(mockResponse)

      await store.fetchNotifications()

      expect($fetch).toHaveBeenCalledWith('/api/notifications?')
      expect(store.notifications).toEqual(mockNotifications)
      expect(store.unreadCount).toBe(1)
      expect(store.hasMore).toBe(false)
    })

    it('applique les filtres dans la requête', async () => {
      const mockResponse = {
        success: true,
        data: [],
        unreadCount: 0,
        pagination: { limit: 10, offset: 0, hasMore: false },
      }

      vi.mocked($fetch).mockResolvedValue(mockResponse)

      await store.fetchNotifications({
        isRead: false,
        category: 'convention',
        limit: 10,
      })

      expect($fetch).toHaveBeenCalledWith(
        '/api/notifications?isRead=false&category=convention&limit=10'
      )
    })

    it('ajoute les notifications en mode append', async () => {
      store.notifications = [mockNotifications[0]]

      const mockResponse = {
        success: true,
        data: [mockNotifications[1]],
        unreadCount: 1,
        pagination: { limit: 20, offset: 1, hasMore: false },
      }

      vi.mocked($fetch).mockResolvedValue(mockResponse)

      await store.fetchNotifications({}, true)

      expect(store.notifications).toHaveLength(2)
      expect(store.notifications[1]).toEqual(mockNotifications[1])
    })

    it('gère les erreurs de chargement', async () => {
      vi.mocked($fetch).mockRejectedValue(new Error('API Error'))

      await expect(store.fetchNotifications()).rejects.toThrow('API Error')
      expect(store.loading).toBe(false)
    })
  })

  describe('loadMore', () => {
    it('charge plus de notifications avec pagination', async () => {
      store.hasMore = true
      store.currentFilters = { limit: 10, offset: 0 }

      const mockResponse = {
        success: true,
        data: [mockNotifications[1]],
        unreadCount: 1,
        pagination: { limit: 10, offset: 10, hasMore: false },
      }

      vi.mocked($fetch).mockResolvedValue(mockResponse)

      await store.loadMore()

      expect($fetch).toHaveBeenCalledWith('/api/notifications?limit=10&offset=10')
    })

    it('ne charge pas si hasMore est false', async () => {
      store.hasMore = false

      await store.loadMore()

      expect($fetch).not.toHaveBeenCalled()
    })

    it('ne charge pas si déjà en cours de chargement', async () => {
      store.loading = true
      store.hasMore = true

      await store.loadMore()

      expect($fetch).not.toHaveBeenCalled()
    })
  })

  describe('markAsRead', () => {
    it('marque une notification comme lue', async () => {
      store.notifications = [{ ...mockNotifications[0] }]
      store.unreadCount = 1

      vi.mocked($fetch).mockResolvedValue({})

      await store.markAsRead('1')

      expect($fetch).toHaveBeenCalledWith('/api/notifications/1/read', {
        method: 'PATCH',
      })
      expect(store.notifications[0].isRead).toBe(true)
      expect(store.notifications[0].readAt).toBeDefined()
      expect(store.unreadCount).toBe(0)
    })

    it('ne modifie pas le compteur si déjà lue', async () => {
      store.notifications = [{ ...mockNotifications[1] }] // Déjà lue
      store.unreadCount = 0

      vi.mocked($fetch).mockResolvedValue({})

      await store.markAsRead('2')

      expect(store.unreadCount).toBe(0)
    })
  })

  describe('markAllAsRead', () => {
    it('marque toutes les notifications comme lues', async () => {
      store.notifications = [...mockNotifications]
      store.unreadCount = 1

      vi.mocked($fetch).mockResolvedValue({ updatedCount: 1 })

      await store.markAllAsRead()

      expect($fetch).toHaveBeenCalledWith('/api/notifications/mark-all-read', {
        method: 'PATCH',
        body: {},
      })
      expect(store.notifications[0].isRead).toBe(true)
      expect(store.unreadCount).toBe(0)
    })

    it("marque seulement les notifications d'une catégorie", async () => {
      store.notifications = [...mockNotifications]
      store.unreadCount = 1

      vi.mocked($fetch).mockResolvedValue({ updatedCount: 1 })

      await store.markAllAsRead('convention')

      expect($fetch).toHaveBeenCalledWith('/api/notifications/mark-all-read', {
        method: 'PATCH',
        body: { category: 'convention' },
      })
    })
  })

  describe('deleteNotification', () => {
    it('supprime une notification non lue', async () => {
      // Créer des copies profondes pour éviter les mutations
      const testNotifications = [
        {
          id: '1',
          userId: 1,
          type: 'INFO' as const,
          title: 'Test 1',
          titleText: 'Test 1',
          message: 'Message 1',
          messageText: 'Message 1',
          category: 'convention',
          isRead: false,
          createdAt: '2024-03-20T10:00:00Z',
          updatedAt: '2024-03-20T10:00:00Z',
        },
        {
          id: '2',
          userId: 1,
          type: 'SUCCESS' as const,
          title: 'Test 2',
          titleText: 'Test 2',
          message: 'Message 2',
          messageText: 'Message 2',
          category: 'edition',
          isRead: true,
          readAt: '2024-03-20T11:00:00Z',
          createdAt: '2024-03-20T09:00:00Z',
          updatedAt: '2024-03-20T11:00:00Z',
        },
      ]

      store.notifications = testNotifications
      store.unreadCount = 1 // Il y a 1 notification non lue (id: '1')

      vi.mocked($fetch).mockResolvedValue({})

      await store.deleteNotification('1') // Supprimer la notification non lue

      expect($fetch).toHaveBeenCalledWith('/api/notifications/1/delete', {
        method: 'DELETE',
      })
      expect(store.notifications).toHaveLength(1)
      expect(store.notifications[0].id).toBe('2')
      expect(store.unreadCount).toBe(0) // Le compteur doit être décrémenté
    })

    it('supprime une notification déjà lue sans affecter le compteur', async () => {
      store.notifications = mockNotifications.map((n) => ({ ...n }))
      store.unreadCount = 1 // Il y a 1 notification non lue (id: '1')

      vi.mocked($fetch).mockResolvedValue({})

      await store.deleteNotification('2') // Supprimer la notification déjà lue

      expect($fetch).toHaveBeenCalledWith('/api/notifications/2/delete', {
        method: 'DELETE',
      })
      expect(store.notifications).toHaveLength(1)
      expect(store.notifications[0].id).toBe('1')
      expect(store.unreadCount).toBe(1) // Le compteur ne change pas
    })
  })

  describe('addRealTimeNotification', () => {
    it('ajoute une notification en temps réel', () => {
      const newNotification: Notification = {
        id: '3',
        userId: 1,
        type: 'WARNING',
        title: 'Temps réel',
        titleText: 'Temps réel',
        message: 'Message temps réel',
        messageText: 'Message temps réel',
        isRead: false,
        createdAt: '2024-03-20T12:00:00Z',
        updatedAt: '2024-03-20T12:00:00Z',
      }

      store.addRealTimeNotification(newNotification)

      expect(store.notifications).toHaveLength(1)
      expect(store.notifications[0]).toEqual(newNotification)
      expect(store.unreadCount).toBe(1)
      expect(store.lastRealTimeUpdate).toBeInstanceOf(Date)
    })

    it('ignore les notifications déjà existantes', () => {
      store.notifications = [mockNotifications[0]]

      store.addRealTimeNotification(mockNotifications[0])

      expect(store.notifications).toHaveLength(1)
    })
  })

  describe('refresh', () => {
    beforeEach(() => {
      vi.mocked($fetch).mockResolvedValue({
        success: true,
        notifications: [],
        unreadCount: 0,
        pagination: { limit: 20, offset: 0, hasMore: false },
      })
    })

    it('actualise si pas de dernière récupération', async () => {
      await store.refresh()

      expect($fetch).toHaveBeenCalled()
    })

    it('actualise si force est true', async () => {
      store.lastFetch = new Date()
      store.realTimeEnabled = true
      store.lastRealTimeUpdate = new Date()

      await store.refresh(true)

      expect($fetch).toHaveBeenCalled()
    })

    it('ignore si temps réel actif avec mise à jour récente', async () => {
      store.realTimeEnabled = true
      store.lastRealTimeUpdate = new Date()

      await store.refresh()

      expect($fetch).not.toHaveBeenCalled()
    })
  })

  describe('reset', () => {
    it("remet le store à l'état initial", () => {
      store.notifications = mockNotifications
      store.unreadCount = 5
      store.loading = true
      store.realTimeEnabled = true

      store.reset()

      expect(store.notifications).toEqual([])
      expect(store.unreadCount).toBe(0)
      expect(store.loading).toBe(false)
      expect(store.realTimeEnabled).toBe(false)
      expect(store.hasMore).toBe(true)
    })
  })
})
