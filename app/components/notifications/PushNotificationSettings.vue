<template>
  <div class="space-y-6">
    <!-- Titre -->
    <div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
        {{ $t('notifications.push.title') }}
      </h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
        {{ $t('notifications.push.description') }}
      </p>
    </div>

    <!-- Support non disponible -->
    <UAlert
      v-if="!isSupported"
      icon="i-heroicons-exclamation-triangle"
      color="yellow"
      variant="soft"
      :title="$t('notifications.push.unsupported.title')"
      :description="$t('notifications.push.unsupported.description')"
    />

    <!-- Interface principale -->
    <div v-else class="space-y-4">
      <!-- Statut actuel -->
      <div class="flex items-center justify-between p-4 border rounded-lg dark:border-gray-700">
        <div class="flex items-center space-x-3">
          <div class="flex-shrink-0">
            <UIcon
              :name="isSubscribed ? 'i-heroicons-bell' : 'i-heroicons-bell-slash'"
              :class="[
                'w-6 h-6',
                isSubscribed ? 'text-green-500' : 'text-gray-400'
              ]"
            />
          </div>
          <div>
            <h4 class="text-sm font-medium text-gray-900 dark:text-white">
              {{ $t('notifications.push.status') }}
            </h4>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ isSubscribed 
                ? $t('notifications.push.enabled') 
                : $t('notifications.push.disabled') 
              }}
            </p>
          </div>
        </div>
        
        <!-- Bouton principal -->
        <UButton
          v-if="!isSubscribed"
          :loading="isLoading"
          :disabled="permission === 'denied'"
          color="primary"
          @click="handleSubscribe"
        >
          {{ $t('notifications.push.enable') }}
        </UButton>
        
        <UButton
          v-else
          :loading="isLoading"
          color="red"
          variant="soft"
          @click="handleUnsubscribe"
        >
          {{ $t('notifications.push.disable') }}
        </UButton>
      </div>

      <!-- Permission refusée -->
      <UAlert
        v-if="permission === 'denied'"
        icon="i-heroicons-x-circle"
        color="red"
        variant="soft"
        :title="$t('notifications.push.permission_denied.title')"
        :description="$t('notifications.push.permission_denied.description')"
      />

      <!-- Test -->
      <div v-if="isSubscribed" class="flex items-center justify-between p-4 border rounded-lg dark:border-gray-700">
        <div>
          <h4 class="text-sm font-medium text-gray-900 dark:text-white">
            {{ $t('notifications.push.test.title') }}
          </h4>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ $t('notifications.push.test.description') }}
          </p>
        </div>
        <UButton
          variant="outline"
          @click="handleSendTest"
        >
          {{ $t('notifications.push.test.button') }}
        </UButton>
      </div>

      <!-- Liste des appareils -->
      <div v-if="subscriptions.length > 0" class="space-y-3">
        <h4 class="text-sm font-medium text-gray-900 dark:text-white">
          {{ $t('notifications.push.devices.title') }}
        </h4>
        
        <div class="space-y-2">
          <div
            v-for="sub in subscriptions"
            :key="sub.id"
            class="flex items-center justify-between p-3 border rounded-lg dark:border-gray-700"
          >
            <div class="flex-1">
              <div class="flex items-center space-x-2">
                <UIcon name="i-heroicons-device-phone-mobile" class="w-4 h-4 text-gray-500" />
                <span class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ sub.service }}
                </span>
              </div>
              <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {{ $t('notifications.push.devices.registered_on') }} 
                {{ formatDate(sub.createdAt) }}
              </p>
              <p v-if="sub.userAgent" class="text-xs text-gray-500 dark:text-gray-500 truncate max-w-md">
                {{ sub.userAgent }}
              </p>
            </div>
            
            <UButton
              size="xs"
              color="red"
              variant="ghost"
              icon="i-heroicons-trash"
              @click="handleUnsubscribe(sub.id)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { $t } = useI18n()
const toast = useToast()

const {
  isSupported,
  isSubscribed,
  isLoading,
  permission,
  subscriptions,
  subscribe,
  unsubscribe,
  sendTest,
} = usePushNotifications()

const handleSubscribe = async () => {
  const success = await subscribe()
  if (success) {
    toast.add({
      title: $t('notifications.push.enabled_success'),
      color: 'green',
    })
  } else {
    toast.add({
      title: $t('notifications.push.enable_error'),
      color: 'red',
    })
  }
}

const handleUnsubscribe = async (subscriptionId?: string) => {
  const success = await unsubscribe(subscriptionId)
  if (success) {
    toast.add({
      title: $t('notifications.push.disabled_success'),
      color: 'green',
    })
  } else {
    toast.add({
      title: $t('notifications.push.disable_error'),
      color: 'red',
    })
  }
}

const handleSendTest = async () => {
  const success = await sendTest()
  if (success) {
    toast.add({
      title: $t('notifications.push.test.success'),
      description: $t('notifications.push.test.success_message'),
      color: 'green',
    })
  } else {
    toast.add({
      title: $t('notifications.push.test.error'),
      color: 'red',
    })
  }
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString()
}
</script>