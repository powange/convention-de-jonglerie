<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('push_notifications.promo_modal.title')"
    size="md"
    :close="false"
    :dismissible="false"
  >
    <template #body>
      <div class="space-y-6">
        <!-- Icône principale -->
        <div class="flex justify-center">
          <div
            class="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center"
          >
            <UIcon name="i-heroicons-bell" class="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <!-- Description -->
        <div class="text-center space-y-3">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ $t('push_notifications.promo_modal.title') }}
          </h3>
          <p class="text-gray-600 dark:text-gray-300">
            {{ $t('push_notifications.promo_modal.description') }}
          </p>
        </div>

        <!-- Liste des avantages -->
        <div class="space-y-3">
          <div v-for="benefit in benefits" :key="benefit" class="flex items-start gap-3">
            <div
              class="flex-shrink-0 w-5 h-5 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mt-0.5"
            >
              <UIcon name="i-heroicons-check" class="w-3 h-3 text-green-600 dark:text-green-400" />
            </div>
            <p class="text-sm text-gray-700 dark:text-gray-300">
              {{ $t(`push_notifications.promo_modal.benefits.${benefit}`) }}
            </p>
          </div>
        </div>

        <!-- Note sur la confidentialité -->
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <UIcon
              name="i-heroicons-shield-check"
              class="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5"
            />
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ $t('push_notifications.promo_modal.privacy.title') }}
              </p>
              <p class="text-xs text-gray-600 dark:text-gray-300 mt-1">
                {{ $t('push_notifications.promo_modal.privacy.description') }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex gap-3 justify-end">
        <UButton variant="ghost" color="neutral" @click="onNotNow">
          {{ $t('push_notifications.promo_modal.not_now') }}
        </UButton>
        <UButton :loading="loading" @click="onEnable">
          {{ $t('push_notifications.promo_modal.enable') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { useFirebaseMessaging } from '~/composables/useFirebaseMessaging'
import { usePushNotificationPromo } from '~/composables/usePushNotificationPromo'
import { usePushNotifications } from '~/composables/usePushNotifications'

const { subscribe: subscribeVapid } = usePushNotifications()
const { requestPermissionAndGetToken, isAvailable: isFirebaseAvailable } = useFirebaseMessaging()
const { shouldShow, markAsEnabled, dismiss: dismissPromo } = usePushNotificationPromo()

// Créer une référence locale qui suit shouldShow
const isOpen = computed({
  get: () => shouldShow.value,
  set: () => {
    // Ne rien faire lors de la fermeture, les handlers s'en occupent
  },
})

const loading = ref(false)

// Liste des avantages des notifications push
const benefits = ['carpool', 'volunteer', 'reminders', 'important']

const onEnable = async () => {
  loading.value = true
  try {
    // Activer les deux systèmes en parallèle
    const results = await Promise.allSettled([
      subscribeVapid(),
      isFirebaseAvailable.value ? requestPermissionAndGetToken() : Promise.resolve(null),
    ])

    // Vérifier les résultats
    const vapidSuccess = results[0].status === 'fulfilled' && results[0].value === true
    const fcmSuccess = results[1].status === 'fulfilled' && results[1].value !== null

    // Succès si au moins un système fonctionne
    if (vapidSuccess || fcmSuccess) {
      markAsEnabled()
    }
  } finally {
    loading.value = false
  }
}

const onNotNow = () => {
  dismissPromo()
}
</script>
