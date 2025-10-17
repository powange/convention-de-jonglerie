import { defineStore } from 'pinia'

export interface Notification {
  id: string
  userId: number
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'

  // Système de traduction (notifications système)
  titleKey?: string
  messageKey?: string
  translationParams?: Record<string, any>
  actionTextKey?: string

  // Texte libre (notifications custom/orgas)
  titleText?: string
  messageText?: string
  actionText?: string

  category?: string
  entityType?: string
  entityId?: string
  isRead: boolean
  readAt?: string
  actionUrl?: string
  createdAt: string
  updatedAt: string
}

/**
 * Type pour les notifications de l'API qui peuvent avoir l'ancienne structure
 * Avant la migration : { title, message, actionText }
 * Après la migration : { titleKey/titleText, messageKey/messageText, actionTextKey/actionText }
 */
interface RawNotification extends Notification {
  // Anciens champs (avant migration)
  title?: string
  message?: string
}

/**
 * Normalise une notification pour assurer la compatibilité avec l'ancienne structure
 * Convertit { title, message } → { titleText, messageText }
 */
function normalizeNotification(raw: RawNotification): Notification {
  const notification: Notification = { ...raw }

  // Si l'ancienne structure est utilisée (avant migration), la convertir
  if (raw.title && !raw.titleText && !raw.titleKey) {
    notification.titleText = raw.title
  }
  if (raw.message && !raw.messageText && !raw.messageKey) {
    notification.messageText = raw.message
  }

  return notification
}

export interface NotificationFilters {
  isRead?: boolean
  category?: string
  limit?: number
  offset?: number
}

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    notifications: [] as Notification[],
    unreadCount: 0,
    loading: false,
    lastFetch: null as Date | null,
    // Filtres actifs
    currentFilters: {
      isRead: undefined,
      category: undefined,
      limit: 20,
      offset: 0,
    } as NotificationFilters,
    // Pagination
    hasMore: true,
    // Support SSE
    realTimeEnabled: false,
    lastRealTimeUpdate: null as Date | null,
  }),

  getters: {
    unreadNotifications: (state) => state.notifications.filter((n) => !n.isRead),

    notificationsByCategory: (state) => {
      const grouped: Record<string, Notification[]> = {}
      state.notifications.forEach((notification) => {
        const category = notification.category || 'other'
        if (!grouped[category]) {
          grouped[category] = []
        }
        grouped[category].push(notification)
      })
      return grouped
    },

    recentNotifications: (state) => {
      return state.notifications.filter((n) => !n.isRead).slice(0, 5) // Afficher seulement les 5 plus récentes
    },
  },

  actions: {
    /**
     * Charge les notifications depuis l'API
     */
    async fetchNotifications(filters: NotificationFilters = {}, append: boolean = false) {
      this.loading = true

      try {
        const params = new URLSearchParams()

        if (filters.isRead !== undefined) {
          params.append('isRead', filters.isRead.toString())
        }
        if (filters.category) {
          params.append('category', filters.category)
        }
        if (filters.limit) {
          params.append('limit', filters.limit.toString())
        }
        if (filters.offset) {
          params.append('offset', filters.offset.toString())
        }

        const response = await $fetch<{
          success: boolean
          notifications: RawNotification[]
          unreadCount: number
          pagination: { limit: number; offset: number; hasMore: boolean }
        }>(`/api/notifications?${params}`)

        // Normaliser les notifications pour la compatibilité
        const normalizedNotifications = response.notifications.map(normalizeNotification)

        if (append) {
          this.notifications.push(...normalizedNotifications)
        } else {
          this.notifications = normalizedNotifications
        }

        this.unreadCount = response.unreadCount
        this.hasMore = response.pagination.hasMore
        this.currentFilters = { ...filters }
        this.lastFetch = new Date()

        return response
      } catch (error) {
        console.error('Erreur lors du chargement des notifications:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Charge plus de notifications (pagination)
     */
    async loadMore() {
      if (!this.hasMore || this.loading) return

      const newOffset = (this.currentFilters.offset || 0) + (this.currentFilters.limit || 20)

      await this.fetchNotifications(
        {
          ...this.currentFilters,
          offset: newOffset,
        },
        true
      )
    },

    /**
     * Marque une notification comme lue
     */
    async markAsRead(notificationId: string) {
      try {
        await $fetch(`/api/notifications/${notificationId}/read`, {
          method: 'PATCH',
        })

        // Mettre à jour localement
        const notification = this.notifications.find((n) => n.id === notificationId)
        if (notification && !notification.isRead) {
          notification.isRead = true
          notification.readAt = new Date().toISOString()
          this.unreadCount = Math.max(0, this.unreadCount - 1)
        }
      } catch (error) {
        console.error('Erreur lors de la mise à jour de la notification:', error)
        throw error
      }
    },

    /**
     * Marque une notification comme non lue
     */
    async markAsUnread(notificationId: string) {
      try {
        await $fetch(`/api/notifications/${notificationId}/unread`, {
          method: 'PATCH',
        })

        // Mettre à jour localement
        const notification = this.notifications.find((n) => n.id === notificationId)
        if (notification && notification.isRead) {
          notification.isRead = false
          notification.readAt = undefined
          this.unreadCount++
        }
      } catch (error) {
        console.error('Erreur lors de la mise à jour de la notification:', error)
        throw error
      }
    },

    /**
     * Marque toutes les notifications comme lues
     */
    async markAllAsRead(category?: string) {
      try {
        const response = await $fetch<{ updatedCount: number }>(
          '/api/notifications/mark-all-read',
          {
            method: 'PATCH',
            body: category ? { category } : {},
          }
        )

        // Mettre à jour localement
        this.notifications.forEach((notification) => {
          if (!notification.isRead && (!category || notification.category === category)) {
            notification.isRead = true
            notification.readAt = new Date().toISOString()
          }
        })

        if (category) {
          const categoryNotifications = this.notifications.filter(
            (n) => n.category === category && !n.isRead
          )
          this.unreadCount = Math.max(0, this.unreadCount - categoryNotifications.length)
        } else {
          this.unreadCount = 0
        }

        return response
      } catch (error) {
        console.error('Erreur lors de la mise à jour des notifications:', error)
        throw error
      }
    },

    /**
     * Supprime une notification
     */
    async deleteNotification(notificationId: string) {
      try {
        await $fetch(`/api/notifications/${notificationId}/delete`, {
          method: 'DELETE',
        })

        // Supprimer localement
        const index = this.notifications.findIndex((n) => n.id === notificationId)
        if (index > -1) {
          const notification = this.notifications[index]
          if (!notification.isRead) {
            this.unreadCount = Math.max(0, this.unreadCount - 1)
          }
          this.notifications.splice(index, 1)
        }
      } catch (error) {
        console.error('Erreur lors de la suppression de la notification:', error)
        throw error
      }
    },

    /**
     * Applique des filtres et recharge les notifications
     */
    async applyFilters(filters: NotificationFilters) {
      this.currentFilters = { ...filters, offset: 0 }
      await this.fetchNotifications(this.currentFilters)
    },

    /**
     * Efface tous les filtres
     */
    async clearFilters() {
      await this.applyFilters({
        isRead: undefined,
        category: undefined,
        limit: 20,
        offset: 0,
      })
    },

    /**
     * Obtient les statistiques des notifications
     */
    async getStats() {
      try {
        const response = await $fetch<{
          success: boolean
          stats: {
            total: number
            unread: number
            byType: Array<{ type: string; count: number }>
          }
        }>('/api/notifications/stats')

        return response.stats
      } catch (error) {
        console.error('Erreur lors de la récupération des statistiques:', error)
        throw error
      }
    },

    /**
     * Ajoute une notification reçue en temps réel via SSE
     */
    addRealTimeNotification(notification: RawNotification) {
      // Vérifier si la notification n'existe pas déjà
      const exists = this.notifications.some((n) => n.id === notification.id)
      if (exists) {
        return
      }

      // Normaliser la notification pour la compatibilité
      const normalizedNotification = normalizeNotification(notification)

      // Ajouter la notification en tête de liste
      this.notifications.unshift(normalizedNotification)

      // Mettre à jour le compteur de non lues
      if (!normalizedNotification.isRead) {
        this.unreadCount++
      }

      // Marquer le timestamp de la dernière mise à jour
      this.lastRealTimeUpdate = new Date()

      console.log(
        '[Store] Notification temps réel ajoutée:',
        normalizedNotification.titleKey ||
          normalizedNotification.titleText ||
          normalizedNotification.id
      )
    },

    /**
     * Active/désactive le mode temps réel
     */
    setRealTimeEnabled(enabled: boolean) {
      this.realTimeEnabled = enabled
      console.log('[Store] Mode temps réel:', enabled ? 'activé' : 'désactivé')
    },

    /**
     * Actualise les notifications (mode intelligent avec SSE)
     */
    async refresh(force: boolean = false) {
      // Si le temps réel est activé et qu'il y a eu une mise à jour récente,
      // ne pas refaire un fetch complet sauf si forcé
      const hasRecentRealTimeUpdate =
        this.lastRealTimeUpdate && Date.now() - this.lastRealTimeUpdate.getTime() < 30000 // 30 secondes

      if (this.realTimeEnabled && hasRecentRealTimeUpdate && !force) {
        console.log('[Store] Skip refresh - données temps réel récentes')
        return
      }

      // Actualiser si pas de dernière récupération ou si > 5 secondes
      const shouldRefresh = force || !this.lastFetch || Date.now() - this.lastFetch.getTime() > 5000

      if (shouldRefresh) {
        await this.fetchNotifications(this.currentFilters)
      }
    },

    /**
     * Réinitialise le store
     */
    reset() {
      this.notifications = []
      this.unreadCount = 0
      this.loading = false
      this.lastFetch = null
      this.currentFilters = {
        isRead: undefined,
        category: undefined,
        limit: 20,
        offset: 0,
      }
      this.hasMore = true
      this.realTimeEnabled = false
      this.lastRealTimeUpdate = null
    },
  },
})
