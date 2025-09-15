<template>
  <div>
    <!-- Titre historique -->
    <div class="flex items-center gap-2 mb-4">
      <UIcon name="i-heroicons-clock" class="text-gray-600 dark:text-gray-400" />
      <h4 class="text-base font-medium text-gray-900 dark:text-white">
        {{ t('editions.volunteers.notifications_history') }}
      </h4>
    </div>

    <!-- État de chargement -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin text-gray-400" size="20" />
      <span class="ml-2 text-base text-gray-500">{{ t('common.loading') }}</span>
    </div>

    <!-- Liste vide -->
    <div v-else-if="notifications.length === 0" class="text-center py-8">
      <UIcon name="i-heroicons-bell-slash" class="mx-auto text-gray-400" size="32" />
      <p class="mt-2 text-base text-gray-500">
        {{ t('editions.volunteers.no_notifications_sent') }}
      </p>
    </div>

    <!-- Tableau des notifications -->
    <div v-else class="space-y-3">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
      >
        <!-- Header -->
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1">
            <h6 class="font-medium text-gray-900 dark:text-gray-100 text-base">
              {{ notification.title }}
            </h6>
            <div class="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span class="flex items-center gap-1">
                <UIcon name="i-heroicons-user" size="14" />
                {{ notification.senderName }}
              </span>
              <span class="flex items-center gap-1">
                <UIcon name="i-heroicons-calendar" size="14" />
                {{ formatDate(notification.sentAt) }}
              </span>
            </div>
          </div>

          <!-- Badge du type de destinataires -->
          <UBadge
            :color="notification.targetType === 'all' ? 'info' : 'purple'"
            variant="soft"
            size="sm"
          >
            {{
              notification.targetType === 'all'
                ? t('editions.volunteers.all_accepted_volunteers')
                : t('editions.volunteers.specific_teams')
            }}
          </UBadge>
        </div>

        <!-- Message -->
        <div class="bg-white dark:bg-gray-700 rounded p-3 mb-3">
          <p class="text-base text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {{ notification.message }}
          </p>
        </div>

        <!-- Équipes sélectionnées (si applicable) -->
        <div
          v-if="notification.targetType === 'teams' && notification.selectedTeams?.length"
          class="mb-3"
        >
          <p class="text-sm text-gray-500 mb-1">{{ t('editions.volunteers.targeted_teams') }}:</p>
          <div class="flex flex-wrap gap-1">
            <UBadge
              v-for="team in notification.selectedTeams"
              :key="team"
              color="neutral"
              variant="soft"
            >
              {{ team }}
            </UBadge>
          </div>
        </div>

        <!-- Statistiques -->
        <div class="flex items-center justify-between text-sm">
          <div class="flex items-center gap-4 text-gray-500">
            <span class="flex items-center gap-1">
              <UIcon name="i-heroicons-users" size="14" />
              {{
                t('editions.volunteers.recipients_count', { count: notification.recipientCount })
              }}
            </span>
            <span class="flex items-center gap-1">
              <UIcon name="i-heroicons-check-circle" size="14" />
              {{
                t('editions.volunteers.confirmations_count', {
                  count: notification.confirmationsCount,
                })
              }}
            </span>
          </div>

          <!-- Taux de confirmation et bouton détails -->
          <div class="flex items-center gap-2">
            <UBadge
              :color="getConfirmationRateColor(notification.confirmationRate)"
              variant="soft"
              size="sm"
            >
              {{ notification.confirmationRate }}% {{ t('editions.volunteers.confirmed') }}
            </UBadge>
            <UButton
              size="xs"
              color="primary"
              variant="soft"
              icon="i-heroicons-eye"
              @click="openConfirmationsModal(notification.id)"
            >
              {{ t('editions.volunteers.view_details') }}
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal des détails de confirmations -->
    <EditionVolunteerNotificationsConfirmationsModal
      v-model="showConfirmationsModal"
      :notification-id="selectedNotificationId"
      :edition-id="editionId"
    />
  </div>
</template>

<script setup lang="ts">
interface Props {
  editionId: number
}

interface Notification {
  id: string
  title: string
  message: string
  targetType: 'all' | 'teams'
  selectedTeams?: string[]
  recipientCount: number
  sentAt: string
  senderName: string
  confirmationsCount: number
  confirmationRate: number
}

const props = defineProps<Props>()

const { t } = useI18n()

const notifications = ref<Notification[]>([])
const loading = ref(true)
const showConfirmationsModal = ref(false)
const selectedNotificationId = ref<string | null>(null)

// Fonctions utilitaires
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getConfirmationRateColor = (rate: number) => {
  if (rate >= 80) return 'success'
  if (rate >= 50) return 'warning'
  return 'error'
}

const openConfirmationsModal = (notificationId: string) => {
  selectedNotificationId.value = notificationId
  showConfirmationsModal.value = true
}

// Charger les notifications
const loadNotifications = async () => {
  try {
    loading.value = true
    const data = await $fetch(`/api/editions/${props.editionId}/volunteers/notifications`)
    notifications.value = data
  } catch (error) {
    console.error('Erreur lors du chargement des notifications:', error)
  } finally {
    loading.value = false
  }
}

// Méthode pour rafraîchir depuis le parent
const refresh = () => {
  loadNotifications()
}

// Charger au montage
onMounted(() => {
  loadNotifications()
})

// Exposer la méthode refresh pour le parent
defineExpose({
  refresh,
})
</script>
