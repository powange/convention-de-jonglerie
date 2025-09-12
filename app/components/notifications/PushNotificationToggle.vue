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
            <Icon name="i-heroicons-check-circle" class="w-4 h-4" />
            <span>{{ $t('notifications.push.enabled') }}</span>
          </div>
          <div
            v-else-if="permission === 'denied'"
            class="flex items-center gap-2 text-sm text-red-600 dark:text-red-400"
          >
            <Icon name="i-heroicons-x-circle" class="w-4 h-4" />
            <span>{{ $t('notifications.push.blocked') }}</span>
          </div>
          <div v-else class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Icon name="i-heroicons-bell-slash" class="w-4 h-4" />
            <span>{{ $t('notifications.push.disabled') }}</span>
          </div>
        </div>

        <!-- Message de non-support -->
        <div
          v-else
          class="mt-2 flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400"
        >
          <Icon name="i-heroicons-exclamation-triangle" class="w-4 h-4" />
          <span>{{ $t('notifications.push.not_supported') }}</span>
        </div>
      </div>

      <!-- Toggle switch -->
      <div class="ml-4">
        <UToggle
          v-model="isSubscribed"
          :disabled="!isSupported || isLoading || permission === 'denied'"
          :loading="isLoading"
          @change="handleToggle"
        />
      </div>
    </div>

    <!-- Bouton de test (admin uniquement) -->
    <div
      v-if="isSubscribed && authStore.user?.isGlobalAdmin"
      class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
    >
      <UButton
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
      color="red"
      variant="subtle"
      class="mt-3"
      :title="error"
      icon="i-heroicons-exclamation-triangle"
    />
  </div>
</template>

<script setup lang="ts">
import { usePushNotifications } from '~/composables/usePushNotifications'
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()

// Utiliser le composable de push notifications
const {
  isSupported,
  isSubscribed,
  isLoading,
  error,
  permission,
  subscribe,
  unsubscribe,
  testNotification: testPushNotification,
} = usePushNotifications()

const isTesting = ref(false)

// Gérer le changement du toggle
const handleToggle = async (value: boolean) => {
  if (value) {
    await subscribe()
  } else {
    await unsubscribe()
  }
}

// Tester une notification
const testNotification = async () => {
  isTesting.value = true

  try {
    // Tester localement d'abord
    testPushNotification()

    // Puis tester depuis le serveur (pour les admins)
    if (authStore.user?.isGlobalAdmin) {
      await $fetch('/api/admin/notifications/push-test', {
        method: 'POST',
        body: {
          title: '🎯 Test depuis le serveur',
          message: 'Cette notification a été envoyée depuis le serveur !',
        },
      })
    }
  } catch (err) {
    console.error('Erreur lors du test:', err)
  } finally {
    isTesting.value = false
  }
}
</script>
