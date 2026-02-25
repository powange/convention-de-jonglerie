<template>
  <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
    <div class="flex items-start justify-between">
      <div class="flex-1">
        <h4 class="text-sm font-medium text-gray-900 dark:text-white">
          {{ $t('notifications.push.title') }}
        </h4>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ $t('notifications.push.description') }}
        </p>

        <!-- État de la subscription -->
        <div v-if="isSupported" class="mt-2">
          <div
            v-if="isSubscribed"
            class="flex items-center gap-2 text-sm text-green-600 dark:text-green-400"
          >
            <UIcon name="i-heroicons-check-circle" class="w-4 h-4" />
            <span>{{ $t('notifications.push.enabled') }}</span>
          </div>
          <div
            v-else-if="permission === 'denied'"
            class="flex items-center gap-2 text-sm text-red-600 dark:text-red-400"
          >
            <UIcon name="i-heroicons-x-circle" class="w-4 h-4" />
            <span>{{ $t('notifications.push.blocked') }}</span>
          </div>
          <div v-else class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <UIcon name="i-heroicons-bell-slash" class="w-4 h-4" />
            <span>{{ $t('notifications.push.disabled') }}</span>
          </div>
        </div>

        <!-- Message de non-support -->
        <div
          v-else
          class="mt-2 flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400"
        >
          <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4" />
          <span>{{ $t('notifications.push.not_supported') }}</span>
        </div>
      </div>

      <!-- Toggle switch -->
      <div class="ml-4">
        <USwitch
          :model-value="isSubscribed"
          :disabled="!isSupported || isLoading || permission === 'denied'"
          :loading="isLoading"
          @update:model-value="handleToggleChange"
        />
      </div>
    </div>

    <!-- Gestion des appareils (toujours visible pour gérer les autres appareils) -->
    <div
      class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between"
    >
      <ClientOnly>
        <NotificationsPushDevicesModal />
      </ClientOnly>

      <!-- Bouton de test (admin uniquement, si subscribed sur cet appareil) -->
      <UButton
        v-if="isSubscribed && authStore.user?.isGlobalAdmin"
        type="button"
        size="sm"
        variant="outline"
        icon="i-heroicons-paper-airplane"
        :loading="isTesting"
        @click="testNotification"
      >
        {{ $t('notifications.push.test_button') }}
      </UButton>
    </div>

    <!-- Message d'erreur -->
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      class="mt-3"
      :title="error"
      icon="i-heroicons-exclamation-triangle"
    />
  </div>
</template>

<script setup lang="ts">
import { useFirebaseMessaging } from '~/composables/useFirebaseMessaging'
import { useAuthStore } from '~/stores/auth'
import { useNotificationsStore } from '~/stores/notifications'

const authStore = useAuthStore()
const notificationStore = useNotificationsStore()
const toast = useToast()
const { getDeviceId } = useDeviceId()

// Utiliser le composable Firebase Cloud Messaging
const { requestPermissionAndGetToken, unsubscribe: unsubscribeFcm } = useFirebaseMessaging()

// État local
const isLoading = ref(false)
const isSubscribed = ref(false)
const error = ref<string | null>(null)
const permission = ref<NotificationPermission | null>(null)
const isSupported = ref(false)

// Vérifier l'état de la subscription au montage
onMounted(async () => {
  // Vérifier le support des notifications côté client
  isSupported.value =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

  if (!isSupported.value) return

  permission.value = Notification.permission

  // Vérifier si cet appareil a un token FCM actif (basé sur le deviceId)
  try {
    const deviceId = getDeviceId()
    const response = await $fetch('/api/notifications/fcm/check', {
      query: { deviceId },
    })
    isSubscribed.value = response.hasActiveToken
    if (isSubscribed.value) {
      notificationStore.setRealTimeEnabled(true)
    }
  } catch (err) {
    console.error('[PushToggle] Erreur vérification FCM:', err)
  }
})

// Gérer les changements du switch
const handleToggleChange = async (newValue: boolean) => {
  if (!authStore.user) {
    toast.add({
      color: 'warning',
      title: 'Connexion requise',
      description: 'Vous devez être connecté pour activer les notifications',
    })
    return
  }

  isLoading.value = true
  error.value = null

  try {
    if (newValue) {
      console.log('[PushToggle] Activation des notifications FCM...')

      const token = await requestPermissionAndGetToken()

      if (token) {
        isSubscribed.value = true
        permission.value = Notification.permission
        notificationStore.setRealTimeEnabled(true)

        toast.add({
          color: 'success',
          title: 'Notifications activées',
          description: 'Vous recevrez désormais des notifications push',
          icon: 'i-heroicons-bell',
        })
      } else {
        permission.value = Notification.permission
        if (Notification.permission === 'denied') {
          error.value = 'Les notifications sont bloquées dans les paramètres du navigateur'
        } else {
          error.value = "Impossible d'activer les notifications"
        }
      }
    } else {
      console.log('[PushToggle] Désactivation des notifications FCM...')

      await unsubscribeFcm()
      isSubscribed.value = false
      notificationStore.setRealTimeEnabled(false)

      toast.add({
        color: 'neutral',
        title: 'Notifications désactivées',
        description: 'Vous ne recevrez plus de notifications push',
        icon: 'i-heroicons-bell-slash',
      })
    }
  } catch (err: any) {
    console.error('[PushToggle] Erreur:', err)
    error.value = err?.message || 'Une erreur est survenue'
  } finally {
    isLoading.value = false
  }
}

// Tester une notification (admin uniquement)
const { execute: testNotification, loading: isTesting } = useApiAction(
  '/api/admin/notifications/push-test',
  {
    method: 'POST',
    body: {
      title: '🎯 Test de notification',
      message: 'Cette notification a été envoyée depuis le serveur !',
    },
    successMessage: { title: 'Test envoyé', description: 'Notification de test envoyée' },
    errorMessages: { default: "Impossible d'envoyer la notification de test" },
  }
)
</script>
