<template>
  <div>
    <!-- En-tête de page -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold flex items-center gap-3">
        <UIcon name="i-heroicons-bell" class="text-blue-600" />
        {{ $t('navigation.notifications') }}
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mt-2">
        {{ $t('notifications.manage_description') }}
      </p>
    </div>

    <!-- Toggle Push Notifications -->
    <NotificationsPushNotificationToggle class="mb-8" />

    <!-- Statistiques rapides -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ $t('common.total') }}
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ stats?.total || 0 }}
            </p>
          </div>
          <UIcon name="i-heroicons-bell" class="h-8 w-8 text-blue-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ $t('notifications.unread') }}
            </p>
            <p class="text-2xl font-bold text-red-600">
              {{ notificationsStore.unreadCount }}
            </p>
          </div>
          <UIcon name="i-heroicons-bell-alert" class="h-8 w-8 text-red-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ $t('notifications.this_week') }}
            </p>
            <p class="text-2xl font-bold text-green-600">
              {{ weeklyCount }}
            </p>
          </div>
          <UIcon name="i-heroicons-calendar-days" class="h-8 w-8 text-green-500" />
        </div>
      </UCard>
    </div>

    <!-- Filtres et actions -->
    <UCard class="mb-6">
      <div class="flex flex-wrap gap-4 items-center justify-between">
        <div class="flex flex-wrap gap-4 items-center">
          <!-- Filtre par statut -->
          <USelect
            v-model="selectedStatus"
            :items="statusOptions"
            :placeholder="$t('common.status')"
            class="w-40"
          />

          <!-- Filtre par catégorie -->
          <USelect
            v-model="selectedCategory"
            :items="categoryOptions"
            :placeholder="$t('common.category')"
            class="w-48"
          />

          <!-- Bouton effacer filtres -->
          <UButton
            icon="i-heroicons-x-mark"
            variant="outline"
            color="neutral"
            @click="clearFilters"
          >
            Effacer
          </UButton>
        </div>

        <div class="flex gap-3">
          <!-- Actualiser -->
          <UButton
            icon="i-heroicons-arrow-path"
            variant="outline"
            :loading="notificationsStore.loading"
            @click="refreshNotifications"
          >
            Actualiser
          </UButton>

          <!-- Marquer toutes comme lues -->
          <UButton
            v-if="notificationsStore.unreadCount > 0"
            icon="i-heroicons-check"
            @click="markAllAsRead"
          >
            Marquer toutes comme lues
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- Liste des notifications -->
    <UCard>
      <!-- Chargement -->
      <div v-if="notificationsStore.loading && notifications.length === 0" class="p-8 text-center">
        <UIcon
          name="i-heroicons-arrow-path"
          class="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400"
        />
        <p class="text-gray-500">{{ $t('notifications.loading') }}</p>
      </div>

      <!-- Aucune notification -->
      <div v-else-if="notifications.length === 0" class="p-8 text-center">
        <UIcon name="i-heroicons-bell-slash" class="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <p class="text-gray-500 mb-2">{{ $t('notifications.none_found') }}</p>
        <p class="text-sm text-gray-400">
          {{
            selectedStatus || selectedCategory
              ? 'Essayez de modifier vos filtres'
              : 'Vous recevrez ici vos notifications'
          }}
        </p>
      </div>

      <!-- Liste -->
      <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          class="p-6 transition-colors"
          :class="{
            'bg-blue-50 dark:bg-blue-900/20': !notification.isRead,
          }"
        >
          <div class="flex items-start gap-4">
            <!-- Icône -->
            <div class="flex-shrink-0 mt-1">
              <UIcon
                :name="getNotificationIcon(notification.type)"
                :class="getNotificationIconColor(notification.type)"
                class="h-6 w-6"
              />
            </div>

            <!-- Contenu -->
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                    {{ notification.title }}
                    <UBadge
                      v-if="!notification.isRead"
                      color="secondary"
                      variant="soft"
                      class="ml-2"
                    >
                      Nouveau
                    </UBadge>
                  </h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {{ notification.message }}
                  </p>
                </div>

                <!-- Actions -->
                <div class="flex items-center gap-2 ml-4">
                  <!-- Marquer comme lu/non lu -->
                  <UButton
                    :icon="notification.isRead ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                    variant="ghost"
                    size="sm"
                    :title="notification.isRead ? 'Marquer comme non lu' : 'Marquer comme lu'"
                    @click="toggleReadStatus(notification)"
                  />

                  <!-- Supprimer -->
                  <UButton
                    icon="i-heroicons-trash"
                    variant="ghost"
                    size="sm"
                    color="error"
                    @click="confirmDeleteNotification(notification.id)"
                  />
                </div>
              </div>

              <!-- Métadonnées -->
              <div class="flex items-center gap-4 mt-3 text-xs text-gray-500">
                <span
                  class="flex items-center gap-1"
                  :title="formatDateTime(notification.createdAt)"
                >
                  <UIcon name="i-heroicons-clock" class="h-3 w-3" />
                  {{ formatRelativeTime(notification.createdAt) }}
                </span>
                <span v-if="notification.category" class="flex items-center gap-1">
                  <UIcon name="i-heroicons-tag" class="h-3 w-3" />
                  {{ getCategoryLabel(notification.category) }}
                </span>
                <span
                  v-if="notification.isRead && notification.readAt"
                  class="flex items-center gap-1"
                  :title="formatDateTime(notification.readAt)"
                >
                  <UIcon name="i-heroicons-check" class="h-3 w-3" />
                  Lu {{ formatRelativeTime(notification.readAt) }}
                </span>
              </div>

              <!-- Bouton d'action -->
              <div v-if="notification.actionText && notification.actionUrl" class="mt-4">
                <UButton :to="notification.actionUrl" variant="outline" size="sm">
                  {{ notification.actionText }}
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div
        v-if="notificationsStore.hasMore && notifications.length > 0"
        class="p-6 border-t border-gray-200 dark:border-gray-700"
      >
        <UButton variant="outline" block :loading="notificationsStore.loading" @click="loadMore">
          Charger plus
        </UButton>
      </div>
    </UCard>

    <!-- Modal de confirmation pour suppression -->
    <UiConfirmModal
      v-model="showDeleteModal"
      :title="$t('notifications.confirm_delete_title')"
      :description="$t('notifications.confirm_delete_description')"
      :confirm-label="$t('common.delete')"
      :cancel-label="$t('common.cancel')"
      confirm-color="error"
      icon-name="i-heroicons-trash"
      icon-color="text-red-500"
      @confirm="executeDeleteNotification"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useNotificationsStore } from '~/stores/notifications'
import type { Notification } from '~/stores/notifications'

// Métadonnées de la page
definePageMeta({
  middleware: 'auth-protected',
})

useSeoMeta({
  title: 'Mes Notifications - Convention de Jonglerie',
  description: 'Gérez vos notifications et préférences',
})

const notificationsStore = useNotificationsStore()
const authStore = useAuthStore()
const toast = useToast()

// État réactif
const selectedStatus = ref('all')
const selectedCategory = ref('all')
const stats = ref(null)

// Modal de confirmation pour suppression
const showDeleteModal = ref(false)
const notificationToDelete = ref<string | null>(null)

// Options statiques pour les filtres
const statusOptions = [
  { label: 'Toutes', value: 'all' },
  { label: 'Non lues', value: 'false' },
  { label: 'Lues', value: 'true' },
]

const categoryOptions = [
  { label: 'Toutes les catégories', value: 'all' },
  { label: 'Système', value: 'system' },
  { label: 'Éditions', value: 'edition' },
  { label: 'Covoiturage', value: 'carpool' },
  { label: 'Bénévolat', value: 'volunteer' },
  { label: 'Commentaires', value: 'comment' },
  { label: 'Favoris', value: 'favorite' },
  { label: 'Réservations', value: 'booking' },
  { label: 'Autres', value: 'other' },
]

// Computed
const notifications = computed(() => notificationsStore.notifications)

const weeklyCount = computed(() => {
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  return notifications.value.filter((notification) => new Date(notification.createdAt) > oneWeekAgo)
    .length
})

// Méthodes utilitaires
const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'SUCCESS':
      return 'i-heroicons-check-circle'
    case 'WARNING':
      return 'i-heroicons-exclamation-triangle'
    case 'ERROR':
      return 'i-heroicons-x-circle'
    default:
      return 'i-heroicons-information-circle'
  }
}

const getNotificationIconColor = (type: string) => {
  switch (type) {
    case 'SUCCESS':
      return 'text-green-500'
    case 'WARNING':
      return 'text-yellow-500'
    case 'ERROR':
      return 'text-red-500'
    default:
      return 'text-blue-500'
  }
}

const getCategoryLabel = (category: string) => {
  const labels: Record<string, string> = {
    system: 'Système',
    edition: 'Édition',
    volunteer: 'Bénévolat',
    other: 'Autre',
  }
  return labels[category] || category
}

const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleString(locale.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const { locale } = useI18n()

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString)

  return useTimeAgoIntl(date, {
    locale: locale.value,
    relativeTimeFormatOptions: {
      numeric: 'auto',
      style: 'short',
    },
  }).value
}

// Actions
const applyFilters = async () => {
  const filters: any = {
    limit: 20,
    offset: 0,
  }

  if (selectedStatus.value && selectedStatus.value !== 'all') {
    filters.isRead = selectedStatus.value === 'true'
  }

  if (selectedCategory.value && selectedCategory.value !== 'all') {
    filters.category = selectedCategory.value
  }

  await notificationsStore.applyFilters(filters)
}

const clearFilters = async () => {
  selectedStatus.value = 'all'
  selectedCategory.value = 'all'
  await notificationsStore.clearFilters()
}

const refreshNotifications = async () => {
  try {
    await notificationsStore.refresh(true)
    await loadStats()
    toast.add({
      color: 'success',
      title: 'Actualisé',
      description: 'Notifications mises à jour',
    })
  } catch {
    toast.add({
      color: 'error',
      title: 'Erreur',
      description: 'Impossible de charger les notifications',
    })
  }
}

const markAllAsRead = async () => {
  try {
    await notificationsStore.markAllAsRead()
    await loadStats()
    toast.add({
      color: 'success',
      title: 'Succès',
      description: 'Toutes les notifications ont été marquées comme lues',
    })
  } catch {
    toast.add({
      color: 'error',
      title: 'Erreur',
      description: 'Impossible de marquer les notifications comme lues',
    })
  }
}

const toggleReadStatus = async (notification: Notification) => {
  try {
    if (!notification.isRead) {
      await notificationsStore.markAsRead(notification.id)
      toast.add({
        color: 'success',
        title: 'Marquée comme lue',
        description: 'Notification mise à jour',
      })
    } else {
      await notificationsStore.markAsUnread(notification.id)
      toast.add({
        color: 'success',
        title: 'Marquée comme non lue',
        description: 'Notification mise à jour',
      })
    }
  } catch {
    toast.add({
      color: 'error',
      title: 'Erreur',
      description: 'Impossible de mettre à jour la notification',
    })
  }
}

const confirmDeleteNotification = (notificationId: string) => {
  notificationToDelete.value = notificationId
  showDeleteModal.value = true
}

const executeDeleteNotification = async () => {
  if (!notificationToDelete.value) return

  try {
    await notificationsStore.deleteNotification(notificationToDelete.value)
    await loadStats()
    toast.add({
      color: 'success',
      title: 'Supprimée',
      description: 'Notification supprimée',
    })
  } catch {
    toast.add({
      color: 'error',
      title: 'Erreur',
      description: 'Impossible de supprimer la notification',
    })
  } finally {
    showDeleteModal.value = false
    notificationToDelete.value = null
  }
}

const loadMore = async () => {
  try {
    await notificationsStore.loadMore()
  } catch {
    toast.add({
      color: 'error',
      title: 'Erreur',
      description: 'Impossible de charger plus de notifications',
    })
  }
}

const loadStats = async () => {
  try {
    stats.value = await notificationsStore.getStats()
  } catch (error) {
    console.error('Erreur lors du chargement des statistiques:', error)
  }
}

// Polling automatique des notifications
let pollingInterval: NodeJS.Timeout | null = null

const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

// Watchers pour appliquer les filtres automatiquement
watch([selectedStatus, selectedCategory], () => {
  applyFilters()
})

// Plus besoin de ce watcher car le polling est géré par NotificationCenter

// Plus besoin de ces gestionnaires car le polling est géré par NotificationCenter

// Gérer la visibilité de la page
onMounted(() => {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Rafraîchir une fois quand l'utilisateur revient sur l'onglet
      // Le SSE ou le polling fallback dans NotificationCenter gérera les mises à jour continues
      if (authStore.user) {
        notificationsStore.refresh()
      }
    }
  })

  // Plus besoin d'écouter les événements push car le polling est géré centralement
})

// Initialisation
onMounted(async () => {
  if (authStore.user) {
    await Promise.all([notificationsStore.refresh(), loadStats()])
    // Plus de startPolling() car géré par NotificationCenter
  }
})

// Nettoyage
onUnmounted(() => {
  stopPolling() // Au cas où il y aurait encore un intervalle actif
  // Plus besoin de nettoyer les listeners d'événements push
})
</script>
