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

  /**
   * La pagination TELLE QUE LE SERVEUR LA REND.
   *
   * ⚠️ Les anciennes attentes de ce fichier écrivaient `{ limit, offset, hasMore }` — une forme que
   * `/api/notifications` n'a jamais renvoyée. Elles passaient parce qu'aucune n'exigeait
   * `hasMore: true` : le champ absent valait `undefined`, donc `false`, donc « il n'y a plus rien ».
   * C'est exactement le défaut du store, recopié dans son test, et c'est ce qui l'a laissé vivre.
   *
   * `createPaginatedResponse` rend ces six champs, et pas d'autres.
   */
  const paginationDe = ({
    page = 1,
    limit = 20,
    totalCount = 2,
  }: { page?: number; limit?: number; totalCount?: number } = {}) => ({
    page,
    limit,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    hasNextPage: page * limit < totalCount,
    hasPrevPage: page > 1,
  })

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
        pagination: paginationDe({ limit: 20, totalCount: 2 }),
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
        pagination: paginationDe({ limit: 10, totalCount: 0 }),
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
        pagination: paginationDe({ limit: 20, totalCount: 2 }),
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

  /**
   * Le drapeau « il reste des pages » — constat B3, moitié client.
   *
   * ## ⚠️ LE DÉFAUT
   *
   * Le store lisait `response.pagination?.hasMore`. Le point d'API, lui, répond par
   * `createPaginatedResponse`, qui nomme ce drapeau **`hasNextPage`**. Le champ lu n'existait donc
   * pas : `undefined || false` → `false` au premier chargement. Le bouton « Charger plus » de
   * `/notifications` n'apparaissait jamais, et la garde de `loadMore` refermait la porte derrière
   * lui — **tout ce qui dépasse la première page était inaccessible**, sans la moindre erreur.
   *
   * Ce qui rend ce défaut durable : `hasMore` existe ailleurs dans le dépôt — les groupes du
   * journal d'erreurs le rendent vraiment. Le nom est plausible, et un nom plausible et absent se
   * lit comme « il n'y a plus rien », jamais comme une faute.
   */
  describe('hasMore, d’après la réponse du serveur', () => {
    const repondAvec = (pagination: ReturnType<typeof paginationDe>) => {
      vi.mocked($fetch).mockResolvedValue({
        success: true,
        data: mockNotifications,
        unreadCount: 0,
        pagination,
      })
    }

    it('⚠️ VAUT « VRAI » QUAND IL RESTE UNE PAGE', async () => {
      // 25 notifications, 20 par page : il en reste. Avec `hasMore`, ce cas rendait `false`.
      repondAvec(paginationDe({ page: 1, limit: 20, totalCount: 25 }))

      await store.fetchNotifications({ limit: 20 })

      expect(store.hasMore).toBe(true)
    })

    it('vaut « faux » sur la dernière page', async () => {
      /*
       * LE TÉMOIN. Sans lui, un `hasMore` figé à `true` satisferait le cas ci-dessus — et le bouton
       * « Charger plus » resterait affiché pour toujours, à rapporter des pages vides.
       */
      repondAvec(paginationDe({ page: 2, limit: 20, totalCount: 25 }))

      await store.fetchNotifications({ limit: 20, offset: 20 })

      expect(store.hasMore).toBe(false)
    })

    it('laisse « Charger plus » faire son travail', async () => {
      // Le bout de chaîne que le défaut coupait : un premier chargement qui annonce une suite doit
      // permettre à `loadMore` de partir. C'est la garde `if (!this.hasMore) return` qui bloquait.
      repondAvec(paginationDe({ page: 1, limit: 20, totalCount: 25 }))
      await store.fetchNotifications({ limit: 20 })
      vi.mocked($fetch).mockClear()

      await store.loadMore()

      expect($fetch).toHaveBeenCalledWith('/api/notifications?limit=20&offset=20')
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
        pagination: paginationDe({ page: 2, limit: 10, totalCount: 11 }),
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

      vi.mocked($fetch).mockResolvedValue({ success: true, data: { updatedCount: 1 } })

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

      vi.mocked($fetch).mockResolvedValue({ success: true, data: { updatedCount: 1 } })

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
        pagination: paginationDe({ limit: 20, totalCount: 2 }),
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
