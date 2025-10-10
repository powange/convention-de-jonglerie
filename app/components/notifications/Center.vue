<template>
  <!-- Panel de notifications -->
  <UModal v-model:open="isOpen" :ui="{ content: 'w-full max-w-md' }">
    <!-- Bouton de déclenchement avec badge de nombre -->
    <UButton
      icon="i-heroicons-bell"
      variant="ghost"
      :color="notificationsStore.unreadCount > 0 ? 'primary' : 'neutral'"
      :class="['relative', notificationsStore.unreadCount > 0 ? 'animate-pulse' : '']"
    >
      <!-- Badge de notifications non lues -->
      <UBadge
        v-if="notificationsStore.unreadCount > 0"
        color="error"
        variant="solid"
        :label="
          notificationsStore.unreadCount > 99 ? '99+' : notificationsStore.unreadCount.toString()
        "
        class="absolute -top-1 -right-1 min-w-[18px] h-[18px] text-xs"
      />
    </UButton>

    <template #header>
      <div class="w-full space-y-3">
        <!-- Ligne 1 : Titre, boutons d'action et fermeture -->
        <div class="flex justify-between items-center gap-4">
          <h3 class="text-lg font-semibold">{{ $t('navigation.notifications') }}</h3>

          <div class="flex items-center gap-4">
            <!-- Boutons d'action -->
            <div class="flex items-center gap-2">
              <!-- Bouton actualiser -->
              <UButton
                icon="i-heroicons-arrow-path"
                variant="ghost"
                size="sm"
                :loading="notificationsStore.loading"
                @click="refreshNotifications"
              />
            </div>

            <!-- Fermer (séparé à droite) -->
            <UButton
              icon="i-heroicons-x-mark"
              color="neutral"
              variant="ghost"
              @click="isOpen = false"
            />
          </div>
        </div>

        <!-- Ligne 2 : Compteur non lues et indicateur temps réel -->
        <div class="flex items-center gap-3">
          <!-- Indicateur SSE -->
          <div
            v-if="showRealTimeIndicator"
            class="flex items-center gap-1.5"
            :title="
              isConnected
                ? 'Temps réel actif'
                : isConnecting
                  ? 'Connexion en cours...'
                  : 'Mode hors ligne'
            "
          >
            <div
              class="w-2 h-2 rounded-full"
              :class="{
                'bg-green-500 animate-pulse': isConnected,
                'bg-yellow-500 animate-pulse': isConnecting,
                'bg-red-500': !isConnected && !isConnecting,
              }"
            />
            <span class="text-xs text-gray-500">
              {{ isConnected ? 'Temps réel' : isConnecting ? 'Connexion...' : 'Hors ligne' }}
            </span>
          </div>

          <p v-if="notificationsStore.unreadCount > 0" class="text-sm text-gray-500">
            {{ notificationsStore.unreadCount }} non lue{{
              notificationsStore.unreadCount > 1 ? 's' : ''
            }}
            <!-- Marquer toutes comme lues -->
            <UButton
              v-if="notificationsStore.unreadCount > 0"
              variant="ghost"
              size="sm"
              @click="markAllAsRead"
            >
              Tout marquer comme lu
            </UButton>
          </p>
        </div>
      </div>
    </template>

    <template #body>
      <div class="space-y-1 max-h-96 overflow-y-auto">
        <!-- Chargement initial -->
        <div
          v-if="notificationsStore.loading && notifications.length === 0"
          class="py-8 text-center"
        >
          <UIcon
            name="i-heroicons-arrow-path"
            class="h-6 w-6 animate-spin mx-auto mb-2 text-gray-400"
          />
          <p class="text-sm text-gray-500">Chargement des notifications...</p>
        </div>

        <!-- Aucune notification -->
        <div v-else-if="notifications.length === 0" class="py-8 text-center">
          <UIcon name="i-heroicons-bell-slash" class="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p class="text-sm text-gray-500">Aucune notification</p>
        </div>

        <!-- Liste des notifications -->
        <div v-else class="space-y-1">
          <div
            v-for="notification in notifications"
            :key="notification.id"
            class="block p-3 rounded-lg transition-colors cursor-pointer"
            :class="{
              'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800':
                !notification.isRead,
              'hover:bg-gray-50 dark:hover:bg-gray-800': notification.isRead,
              'hover:bg-blue-100 dark:hover:bg-blue-900/30': !notification.isRead,
            }"
            @click="handleNotificationClick(notification)"
          >
            <div class="flex items-start gap-3">
              <!-- Icône selon le type -->
              <div class="flex-shrink-0 mt-0.5">
                <UIcon
                  :name="getNotificationIcon(notification.type)"
                  :class="getNotificationIconColor(notification.type)"
                  class="h-5 w-5"
                />
              </div>

              <!-- Contenu -->
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between">
                  <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {{ notification.title }}
                  </h4>
                  <div class="flex items-center gap-1 ml-2">
                    <!-- Indicateur non lu -->
                    <div
                      v-if="!notification.isRead"
                      class="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"
                    />
                    <!-- Bouton supprimer -->
                    <UButton
                      icon="i-heroicons-x-mark"
                      variant="ghost"
                      size="xs"
                      color="neutral"
                      @click.stop="deleteNotification(notification.id)"
                    />
                  </div>
                </div>

                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-line">
                  {{ notification.message }}
                </p>

                <div class="flex items-center justify-between mt-2">
                  <span class="text-xs text-gray-500">
                    {{ formatRelativeTime(notification.createdAt) }}
                  </span>

                  <!-- Bouton d'action si présent -->
                  <UButton
                    v-if="notification.actionText && notification.actionUrl"
                    variant="ghost"
                    size="xs"
                    :to="notification.actionUrl"
                    @click.stop
                  >
                    {{ notification.actionText }}
                  </UButton>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bouton "Charger plus" -->
        <div v-if="notificationsStore.hasMore && notifications.length > 0" class="pt-4">
          <UButton variant="ghost" block :loading="notificationsStore.loading" @click="loadMore">
            Charger plus
          </UButton>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-center">
        <NuxtLink to="/notifications" @click="isOpen = false">
          <UButton variant="ghost"> Voir toutes les notifications </UButton>
        </NuxtLink>
      </div>
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
        @confirm="confirmDeleteNotification"
        @cancel="showDeleteModal = false"
      />
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { useNotificationStream } from '~/composables/useNotificationStream'
import { useAuthStore } from '~/stores/auth'
import { useNotificationsStore } from '~/stores/notifications'
import type { Notification } from '~/stores/notifications'

const notificationsStore = useNotificationsStore()
const authStore = useAuthStore()
const toast = useToast()

// SSE Stream management
const { isConnected, isConnecting, connect, disconnect, cleanup, handleVisibilityChange } =
  useNotificationStream()

// État local
const isOpen = ref(false)

// Computed
const notifications = computed(() => notificationsStore.recentNotifications)

// Indicateur de temps réel basé sur la connexion SSE
// Afficher toujours l'indicateur pour donner une visibilité sur l'état de la connexion
const showRealTimeIndicator = computed(() => {
  return authStore.isAuthenticated
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
const refreshNotifications = async () => {
  try {
    await notificationsStore.refresh(true)
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

const handleNotificationClick = async (notification: Notification) => {
  // Marquer comme lue si pas encore lue
  if (!notification.isRead) {
    try {
      await notificationsStore.markAsRead(notification.id)
    } catch (error) {
      console.error('Erreur lors du marquage comme lu:', error)
    }
  }

  // Rediriger si URL d'action
  if (notification.actionUrl) {
    await navigateTo(notification.actionUrl)
    isOpen.value = false
  }
}

// Modal de confirmation pour suppression
const showDeleteModal = ref(false)
const notificationToDelete = ref<string | null>(null)

const deleteNotification = (notificationId: string) => {
  notificationToDelete.value = notificationId
  showDeleteModal.value = true
}

const confirmDeleteNotification = async () => {
  if (!notificationToDelete.value) return

  try {
    await notificationsStore.deleteNotification(notificationToDelete.value)
    toast.add({
      color: 'success',
      title: 'Supprimé',
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

// Gestion hybride : SSE + Polling fallback
let pollingInterval: NodeJS.Timeout | null = null

const startPolling = () => {
  if (pollingInterval) return

  // Arrêter complètement le polling si SSE est connecté (peu importe les push notifications)
  if (isConnected.value) return

  // Polling uniquement comme fallback quand SSE n'est pas disponible
  const interval = 5000 // Toujours 5 secondes pour le fallback
  console.log('[NotificationCenter] Démarrage polling fallback (SSE non disponible)')

  pollingInterval = setInterval(async () => {
    // Double vérification : arrêter si SSE se reconnecte
    if (isConnected.value) {
      stopPolling()
      return
    }

    if (authStore.user && document.visibilityState === 'visible') {
      await notificationsStore.refresh()
    }
  }, interval)
}

const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

const initializeNotifications = async () => {
  if (!authStore.user) return

  // 1. Charger les notifications initiales
  await notificationsStore.refresh()

  // 2. Tenter de connecter SSE (la connexion se fait en arrière-plan)
  connect()

  // Note: Le watchEffect ci-dessous gérera automatiquement le polling
  // si SSE ne se connecte pas dans les premières secondes
}

onMounted(() => {
  initializeNotifications()

  // Gérer la visibilité de la page
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // Écouter les événements de notifications push
  window.addEventListener('push-notifications-enabled', handlePushNotificationsEnabled)
  window.addEventListener('push-notifications-disabled', handlePushNotificationsDisabled)
})

onUnmounted(() => {
  stopPolling()
  cleanup()
  document.removeEventListener('visibilitychange', handleVisibilityChange)

  // Nettoyer les listeners d'événements push
  window.removeEventListener('push-notifications-enabled', handlePushNotificationsEnabled)
  window.removeEventListener('push-notifications-disabled', handlePushNotificationsDisabled)
})

// Watcher pour gérer la connexion/déconnexion utilisateur
watch(
  () => authStore.user,
  async (user) => {
    if (user) {
      await initializeNotifications()
    } else {
      notificationsStore.reset()
      stopPolling()
      disconnect()
    }
  }
)

// Ce watcher est maintenant géré par le watchEffect ci-dessous
// watch(isConnected, ...) supprimé car redondant

// Gestionnaire d'événements pour les notifications push
const handlePushNotificationsEnabled = () => {}
const handlePushNotificationsDisabled = () => {}

// Effet pour synchroniser l'état realTimeEnabled avec la connexion SSE
watch(isConnected, (connected) => {
  if (connected) {
    console.log('[NotificationCenter] SSE connecté, activation du mode temps réel')
    notificationsStore.setRealTimeEnabled(true)
    stopPolling()
  } else if (authStore.user) {
    console.log('[NotificationCenter] SSE déconnecté, désactivation du mode temps réel')
    notificationsStore.setRealTimeEnabled(false)
  }
})

// Effet pour démarrer le polling si SSE n'est pas connecté
watchEffect(() => {
  // Attendre un peu pour laisser SSE se connecter
  if (!isConnected.value && !isConnecting.value && authStore.user) {
    startPolling()
  }
})
</script>
