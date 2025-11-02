<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
    <div class="max-w-md w-full">
      <UCard>
        <template #header>
          <div class="flex items-center gap-3">
            <div class="p-2 bg-primary-100 dark:bg-primary-900 rounded-full">
              <UIcon
                name="i-heroicons-check-circle"
                class="text-primary-600 dark:text-primary-400"
                size="24"
              />
            </div>
            <div>
              <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
                {{ t('edition.volunteers.confirm_notification_title') }}
              </h1>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ notification?.title }}
              </p>
            </div>
          </div>
        </template>

        <div v-if="notification" class="space-y-4">
          <!-- Message de notification -->
          <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
              {{ notification.message }}
            </p>
          </div>

          <!-- Informations sur l'envoyeur -->
          <div class="text-xs text-gray-500 dark:text-gray-400">
            {{ t('edition.volunteers.notification_sent_by', { sender: notification.senderName }) }}
            • {{ formatDate(notification.sentAt) }}
          </div>

          <!-- Statut de confirmation -->
          <div
            v-if="confirmationStatus === 'confirmed'"
            class="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg"
          >
            <div class="flex items-center gap-2 text-green-700 dark:text-green-400">
              <UIcon name="i-heroicons-check" size="16" />
              <span class="text-sm font-medium">
                {{ t('edition.volunteers.notification_already_confirmed') }}
              </span>
            </div>
            <p v-if="confirmationDate" class="text-xs text-green-600 dark:text-green-500 mt-1">
              {{ t('edition.volunteers.confirmed_at', { date: formatDate(confirmationDate) }) }}
            </p>
          </div>

          <!-- Bouton de confirmation -->
          <div v-else class="pt-2">
            <UButton
              :loading="confirming"
              size="lg"
              block
              icon="i-heroicons-check-circle"
              @click="confirmReading"
            >
              {{ t('edition.volunteers.confirm_reading') }}
            </UButton>
          </div>
        </div>

        <!-- État de chargement -->
        <div v-else-if="loading" class="flex justify-center py-8">
          <UIcon name="i-heroicons-arrow-path" class="animate-spin text-2xl text-gray-400" />
        </div>

        <!-- Erreur -->
        <div v-else-if="error" class="text-center py-8">
          <UIcon
            name="i-heroicons-exclamation-triangle"
            class="text-red-500 text-4xl mx-auto mb-4"
          />
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {{ t('common.error') }}
          </h3>
          <p class="text-gray-600 dark:text-gray-400 text-sm">
            {{ error }}
          </p>
        </div>

        <template v-if="notification" #footer>
          <div class="flex justify-between items-center text-xs text-gray-500">
            <span>{{ notification.editionName }}</span>
            <NuxtLink
              to="/my-volunteer-applications"
              class="text-primary-600 hover:text-primary-700"
            >
              {{ t('edition.volunteers.back_to_my_applications') }}
            </NuxtLink>
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
interface NotificationData {
  id: string
  title: string
  message: string
  sentAt: string
  senderName: string
  editionName: string
}

const { t } = useI18n()
const route = useRoute()
const toast = useToast()

const editionId = route.params.id as string
const groupId = route.params.groupId as string

// État réactif
const loading = ref(true)
const confirming = ref(false)
const error = ref<string>('')
const notification = ref<NotificationData | null>(null)
const confirmationStatus = ref<'pending' | 'confirmed'>('pending')
const confirmationDate = ref<string>('')

// Charger les données de notification
const loadNotification = async () => {
  try {
    loading.value = true
    const response = await $fetch(`/api/editions/${editionId}/volunteers/notification/${groupId}`)

    notification.value = response.notification
    confirmationStatus.value = response.isConfirmed ? 'confirmed' : 'pending'
    if (response.isConfirmed && response.confirmedAt) {
      confirmationDate.value = response.confirmedAt
    }
  } catch (err: any) {
    error.value = err?.data?.message || t('edition.volunteers.notification_load_error')
  } finally {
    loading.value = false
  }
}

// Confirmer la lecture
const confirmReading = async () => {
  if (confirming.value) return

  confirming.value = true

  try {
    const response = await $fetch(
      `/api/editions/${editionId}/volunteers/notification/${groupId}/confirm`,
      {
        method: 'POST',
      }
    )

    confirmationStatus.value = 'confirmed'
    if (response.confirmedAt) {
      confirmationDate.value = response.confirmedAt
    }

    toast.add({
      title: t('edition.volunteers.confirmation_success'),
      description: t('edition.volunteers.confirmation_success_desc'),
      color: 'success',
    })
  } catch (err: any) {
    toast.add({
      title: t('edition.volunteers.confirmation_error'),
      description: err?.data?.message || t('common.error'),
      color: 'error',
    })
  } finally {
    confirming.value = false
  }
}

// Formatage de date
const formatDate = (dateString: string) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Meta données de la page
useSeoMeta({
  title: () => t('edition.volunteers.confirm_notification_title'),
  description: () => t('edition.volunteers.confirm_notification_desc'),
  ogTitle: () => edition.value?.name || edition.value?.convention?.name || 'Convention',
})

// Charger les données au montage
onMounted(() => {
  loadNotification()
})
</script>
