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
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
          <div class="flex-1">
            <h6 class="font-medium text-gray-900 dark:text-gray-100 text-base">
              {{ notification.title }}
            </h6>
            <div class="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-sm text-gray-500">
              <span class="flex items-center gap-2">
                <UiUserAvatar :user="notification.sender" size="xs" />
                {{ notification.senderName }}
                <span
                  v-if="notification.sender.prenom || notification.sender.nom"
                  class="text-gray-400"
                >
                  ({{
                    [notification.sender.prenom, notification.sender.nom].filter(Boolean).join(' ')
                  }})
                </span>
              </span>
              <span class="flex items-center gap-1">
                <UIcon name="i-heroicons-calendar" size="14" />
                {{ formatDate(notification.sentAt) }}
              </span>
            </div>
          </div>

          <!-- Badge du type de destinataires -->
          <UBadge color="info" variant="soft" size="sm" class="self-start">
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
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
          <div class="flex flex-wrap items-center gap-3 sm:gap-4 text-gray-500">
            <span class="flex items-center gap-1">
              <UIcon name="i-heroicons-users" size="14" />
              <span class="hidden sm:inline">
                {{
                  t('editions.volunteers.recipients_count', { count: notification.recipientCount })
                }}
              </span>
              <span class="sm:hidden">{{ notification.recipientCount }}</span>
            </span>
            <span class="flex items-center gap-1">
              <UIcon name="i-heroicons-check-circle" size="14" />
              <span class="hidden sm:inline">
                {{
                  t('editions.volunteers.confirmations_count', {
                    count: notification.confirmationsCount,
                  })
                }}
              </span>
              <span class="sm:hidden">{{ notification.confirmationsCount }}</span>
            </span>
            <UBadge
              :color="getConfirmationRateColor(notification.confirmationRate)"
              variant="soft"
              size="sm"
              class="sm:hidden"
            >
              {{ notification.confirmationRate }}%
            </UBadge>
          </div>

          <!-- Taux de confirmation et bouton détails -->
          <div class="flex items-center gap-2">
            <UBadge
              :color="getConfirmationRateColor(notification.confirmationRate)"
              variant="soft"
              size="sm"
              class="hidden sm:inline-flex"
            >
              {{ notification.confirmationRate }}% {{ t('editions.volunteers.confirmed') }}
            </UBadge>
            <UButton
              size="md"
              color="primary"
              variant="soft"
              icon="i-heroicons-eye"
              class="sm:!text-xs sm:!py-1 sm:!px-2.5 sm:!gap-1.5"
              @click="openConfirmationsModal(notification)"
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
      :notification-data="selectedNotificationData"
      :edition-id="editionId"
    />
  </div>
</template>

<script setup lang="ts">
interface Props {
  editionId: number
  isTeamLeader?: boolean
}

interface Volunteer {
  user: {
    id: number
    pseudo: string
    prenom?: string
    nom?: string
    email: string
    phone?: string
    profilePicture?: string | null
    emailHash?: string
    updatedAt?: string
  }
  confirmedAt?: string
}

interface Notification {
  id: string
  title: string
  message: string
  targetType: string // Peut être 'all' | 'teams' mais vient de l'API comme string
  selectedTeams?: any // JsonValue from Prisma
  recipientCount: number
  sentAt: string | Date
  senderName: string
  sender: {
    id: number
    pseudo: string
    email: string
    prenom?: string
    nom?: string
    profilePicture?: string | null
    emailHash?: string
    updatedAt?: string
  }
  confirmationsCount: number
  confirmationRate: number
  volunteers: {
    confirmed: Volunteer[]
    pending: Volunteer[]
  }
  stats: {
    totalRecipients: number
    confirmationsCount: number
    confirmationRate: number
    pendingCount: number
  }
}

const props = defineProps<Props>()

const { t } = useI18n()

const notifications = ref<Notification[]>([])
const loading = ref(true)
const showConfirmationsModal = ref(false)
const selectedNotificationData = ref<Notification | null>(null)

// Fonctions utilitaires
const formatDate = (dateInput: string | Date) => {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
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

const openConfirmationsModal = (notification: Notification) => {
  selectedNotificationData.value = notification
  showConfirmationsModal.value = true
}

// Charger les notifications
const loadNotifications = async () => {
  try {
    loading.value = true

    // Ajouter le paramètre leaderOnly si l'utilisateur est team leader
    const queryParams = props.isTeamLeader ? '?leaderOnly=true' : ''
    const data = await $fetch(
      `/api/editions/${props.editionId}/volunteers/notifications${queryParams}`
    )
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
