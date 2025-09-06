<template>
  <div>
    <!-- Bouton de déclenchement avec badge de nombre -->
    <UButton
      icon="i-heroicons-bell"
      variant="ghost"
      :color="notificationsStore.unreadCount > 0 ? 'primary' : 'gray'"
      :class="['relative', notificationsStore.unreadCount > 0 ? 'animate-pulse' : '']"
      @click="isOpen = !isOpen"
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

    <!-- Panel de notifications -->
    <UModal
      v-model:open="isOpen"
      :ui="{ width: 'w-full max-w-md' }"
      :title="$t('navigation.notifications')"
    >
      <template #content>
        <UCard>
          <template #body>
            <div class="flex justify-between items-center">
              <div>
                <h3 class="text-lg font-semibold">{{ $t('navigation.notifications') }}</h3>
                <p v-if="notificationsStore.unreadCount > 0" class="text-sm text-gray-500">
                  {{ notificationsStore.unreadCount }} non lue{{
                    notificationsStore.unreadCount > 1 ? 's' : ''
                  }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <!-- Bouton actualiser -->
                <UButton
                  icon="i-heroicons-arrow-path"
                  variant="ghost"
                  size="sm"
                  :loading="notificationsStore.loading"
                  @click="refreshNotifications"
                />

                <!-- Marquer toutes comme lues -->
                <UButton
                  v-if="notificationsStore.unreadCount > 0"
                  variant="ghost"
                  size="sm"
                  @click="markAllAsRead"
                >
                  Tout marquer comme lu
                </UButton>

                <!-- Fermer -->
                <UButton
                  icon="i-heroicons-x-mark"
                  variant="ghost"
                  size="sm"
                  @click="isOpen = false"
                />
              </div>
            </div>
          </template>

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
                          size="2xs"
                          color="neutral"
                          @click.stop="deleteNotification(notification.id)"
                        />
                      </div>
                    </div>

                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
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
                        size="2xs"
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
              <UButton
                variant="ghost"
                block
                :loading="notificationsStore.loading"
                @click="loadMore"
              >
                Charger plus
              </UButton>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-center">
              <NuxtLink to="/notifications" @click="isOpen = false">
                <UButton variant="ghost"> Voir toutes les notifications </UButton>
              </NuxtLink>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useNotificationsStore } from '~/stores/notifications'
import type { Notification } from '~/stores/notifications'

const notificationsStore = useNotificationsStore()
const toast = useToast()

// État local
const isOpen = ref(false)

// Computed
const notifications = computed(() => notificationsStore.recentNotifications)

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

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 1) return "À l'instant"
  if (minutes < 60) return `${minutes} min`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}j`

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
}

// Actions
const refreshNotifications = async () => {
  try {
    await notificationsStore.refresh(true)
  } catch {
    toast.add({
      color: 'red',
      title: 'Erreur',
      description: 'Impossible de charger les notifications',
    })
  }
}

const markAllAsRead = async () => {
  try {
    await notificationsStore.markAllAsRead()
    toast.add({
      color: 'green',
      title: 'Succès',
      description: 'Toutes les notifications ont été marquées comme lues',
    })
  } catch {
    toast.add({
      color: 'red',
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

const deleteNotification = async (notificationId: string) => {
  try {
    await notificationsStore.deleteNotification(notificationId)
    toast.add({
      color: 'green',
      title: 'Supprimé',
      description: 'Notification supprimée',
    })
  } catch {
    toast.add({
      color: 'red',
      title: 'Erreur',
      description: 'Impossible de supprimer la notification',
    })
  }
}

const loadMore = async () => {
  try {
    await notificationsStore.loadMore()
  } catch {
    toast.add({
      color: 'red',
      title: 'Erreur',
      description: 'Impossible de charger plus de notifications',
    })
  }
}

// Charger les notifications au montage si authentifié
const authStore = useAuthStore()

// Polling automatique pour les notifications
let pollingInterval: NodeJS.Timeout | null = null

const startPolling = () => {
  if (pollingInterval) return

  console.log('🔄 Démarrage du polling notifications (5s)')

  // Rafraîchir toutes les 5 secondes
  pollingInterval = setInterval(async () => {
    console.log(
      '⏰ Tentative de rafraîchissement - Utilisateur:',
      !!authStore.user,
      'Visible:',
      document.visibilityState === 'visible'
    )
    if (authStore.user && document.visibilityState === 'visible') {
      console.log('✅ Rafraîchissement des notifications')
      await notificationsStore.refresh()
    }
  }, 5000)
}

const stopPolling = () => {
  if (pollingInterval) {
    console.log('⏹️ Arrêt du polling notifications')
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

onMounted(() => {
  if (authStore.user) {
    notificationsStore.refresh()
    startPolling()
  }

  // Gérer la visibilité de la page
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (authStore.user) {
        notificationsStore.refresh()
      }
      startPolling()
    } else {
      stopPolling()
    }
  })
})

onUnmounted(() => {
  stopPolling()
})

// Watcher pour charger les notifications quand l'utilisateur se connecte
watch(
  () => authStore.user,
  (user) => {
    if (user) {
      notificationsStore.refresh()
      startPolling()
    } else {
      notificationsStore.reset()
      stopPolling()
    }
  }
)
</script>
