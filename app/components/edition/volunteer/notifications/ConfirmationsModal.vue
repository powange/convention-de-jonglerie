<template>
  <UModal v-model:open="isOpen" :ui="{ width: 'sm:max-w-4xl' }">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-users" class="text-primary-500" />
        <span class="font-semibold">{{ t('editions.volunteers.notification_confirmations') }}</span>
      </div>
    </template>

    <template #body>
      <div v-if="loading" class="flex items-center justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin text-gray-400" size="20" />
        <span class="ml-2 text-base text-gray-500">{{ t('common.loading') }}</span>
      </div>

      <div v-else-if="data" class="space-y-6">
        <!-- Informations de la notification -->
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 class="font-medium text-gray-900 dark:text-gray-100 mb-2">
            {{ data.notification.title }}
          </h4>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {{ data.notification.message }}
          </p>
          <div class="flex items-center gap-4 text-sm text-gray-500">
            <span>{{ t('editions.volunteers.sent_by') }}: {{ data.notification.senderName }}</span>
            <span>{{ formatDate(data.notification.sentAt) }}</span>
          </div>
        </div>

        <!-- Statistiques -->
        <div class="grid grid-cols-3 gap-4">
          <div class="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {{ data.stats.totalRecipients }}
            </div>
            <div class="text-sm text-blue-600 dark:text-blue-400">
              {{ t('editions.volunteers.total_recipients') }}
            </div>
          </div>
          <div class="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div class="text-2xl font-bold text-green-600 dark:text-green-400">
              {{ data.stats.confirmationsCount }}
            </div>
            <div class="text-sm text-green-600 dark:text-green-400">
              {{ t('editions.volunteers.confirmed') }}
            </div>
          </div>
          <div class="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div class="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {{ data.stats.pendingCount }}
            </div>
            <div class="text-sm text-orange-600 dark:text-orange-400">
              {{ t('editions.volunteers.pending') }}
            </div>
          </div>
        </div>

        <!-- Onglets -->
        <UTabs v-model="selectedTab" :items="tabs">
          <template #confirmed>
            <div class="max-h-96 overflow-y-auto">
              <div v-if="data.confirmed.length === 0" class="text-center py-8 text-gray-500">
                {{ t('editions.volunteers.no_confirmations_yet') }}
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="volunteer in data.confirmed"
                  :key="volunteer.user.id"
                  class="flex items-start justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                >
                  <div class="flex items-start gap-3 flex-1 min-w-0">
                    <UserAvatar :user="volunteer.user" size="sm" />
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-green-800 dark:text-green-200 mb-1">
                        {{ volunteer.user.pseudo }}
                        <span
                          v-if="volunteer.user.prenom || volunteer.user.nom"
                          class="font-normal text-green-600 dark:text-green-400"
                        >
                          ({{
                            [volunteer.user.prenom, volunteer.user.nom].filter(Boolean).join(' ')
                          }})
                        </span>
                      </div>
                      <div class="text-sm text-green-600 dark:text-green-400">
                        {{ t('editions.volunteers.confirmed_at') }}:
                        {{ volunteer.confirmedAt ? formatDate(volunteer.confirmedAt) : '' }}
                      </div>
                    </div>
                  </div>
                  <div
                    class="text-right text-sm text-green-600 dark:text-green-400 ml-4 flex-shrink-0"
                  >
                    <div class="mb-1">{{ volunteer.user.email }}</div>
                    <div v-if="volunteer.user.phone" class="font-medium">
                      {{ volunteer.user.phone }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template #pending>
            <div>
              <!-- Boutons d'action pour les non-confirmés avec téléphone -->
              <div
                v-if="pendingWithPhone.length > 0"
                class="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800"
              >
                <p class="text-sm text-orange-800 dark:text-orange-200 mb-3">
                  {{
                    t('editions.volunteers.pending_with_phone_count', {
                      count: pendingWithPhone.length,
                    })
                  }}
                </p>
                <div class="flex flex-wrap gap-2">
                  <UButton
                    v-if="isMobile"
                    size="sm"
                    color="warning"
                    variant="solid"
                    icon="i-heroicons-chat-bubble-left-right"
                    @click="sendGroupSMS"
                  >
                    {{ t('editions.volunteers.send_group_sms') }}
                  </UButton>
                  <UButton
                    size="sm"
                    color="warning"
                    variant="outline"
                    icon="i-heroicons-clipboard-document"
                    @click="copyPhoneNumbers"
                  >
                    {{ t('editions.volunteers.copy_phone_numbers') }}
                  </UButton>
                </div>
              </div>

              <div class="max-h-96 overflow-y-auto">
                <div v-if="data.pending.length === 0" class="text-center py-8 text-gray-500">
                  {{ t('editions.volunteers.all_confirmed') }}
                </div>
                <div v-else class="space-y-3">
                  <div
                    v-for="volunteer in data.pending"
                    :key="volunteer.user.id"
                    class="flex items-start justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800"
                  >
                    <div class="flex items-start gap-3 flex-1 min-w-0">
                      <UserAvatar :user="volunteer.user" size="sm" />
                      <div class="flex-1 min-w-0">
                        <div class="font-medium text-orange-800 dark:text-orange-200 mb-1">
                          {{ volunteer.user.pseudo }}
                          <span
                            v-if="volunteer.user.prenom || volunteer.user.nom"
                            class="font-normal text-orange-600 dark:text-orange-400"
                          >
                            ({{
                              [volunteer.user.prenom, volunteer.user.nom].filter(Boolean).join(' ')
                            }})
                          </span>
                        </div>
                        <div class="text-sm text-orange-600 dark:text-orange-400">
                          {{ volunteer.user.email }}
                        </div>
                      </div>
                    </div>
                    <div class="text-right text-sm ml-4 flex-shrink-0">
                      <div
                        v-if="volunteer.user.phone"
                        class="font-medium text-orange-800 dark:text-orange-200"
                      >
                        📞 {{ volunteer.user.phone }}
                      </div>
                      <div v-else class="text-gray-500 italic text-xs">
                        {{ t('editions.volunteers.no_phone') }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </UTabs>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end">
        <UButton color="neutral" variant="ghost" @click="isOpen = false">
          {{ t('common.close') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import UserAvatar from '~/components/ui/UserAvatar.vue'

interface NotificationData {
  id: string
  title: string
  message: string
  targetType: string
  selectedTeams?: any
  recipientCount: number
  sentAt: string | Date
  senderName: string
  confirmationsCount: number
  confirmationRate: number
  volunteers: {
    confirmed: Array<{
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
    }>
    pending: Array<{
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
    }>
  }
  stats: {
    totalRecipients: number
    confirmationsCount: number
    confirmationRate: number
    pendingCount: number
  }
}

interface Props {
  modelValue: boolean
  notificationData: NotificationData | null
  editionId: number
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const toast = useToast()

// État de la modal
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// État du composant
const selectedTab = ref(0)

// Récupérer les données détaillées depuis l'API
const { data, pending: loading } = await useLazyAsyncData(
  `notification-confirmations-${props.notificationData?.id}`,
  () =>
    $fetch(
      `/api/editions/${props.editionId}/volunteers/notification/${props.notificationData?.id}/confirmations`
    ),
  {
    default: () =>
      props.notificationData
        ? {
            notification: {
              id: props.notificationData.id,
              title: props.notificationData.title,
              message: props.notificationData.message,
              targetType: props.notificationData.targetType,
              selectedTeams: props.notificationData.selectedTeams,
              recipientCount: props.notificationData.recipientCount,
              sentAt: props.notificationData.sentAt,
              senderName: props.notificationData.senderName,
              editionName: '',
              conventionName: '',
            },
            confirmed: props.notificationData.volunteers.confirmed,
            pending: props.notificationData.volunteers.pending,
            stats: props.notificationData.stats,
          }
        : null,
  }
)

// Détection mobile
const isMobile = computed(() => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
})

// Bénévoles en attente avec téléphone
const pendingWithPhone = computed(() => {
  if (!data.value?.pending) return []
  return data.value.pending.filter((v: any) => v.user.phone)
})

// Configuration des onglets
const tabs = computed(() => [
  {
    key: 'confirmed',
    slot: 'confirmed',
    label: `${t('editions.volunteers.confirmed')} (${data.value?.stats.confirmationsCount || 0})`,
    icon: 'i-heroicons-check-circle',
  },
  {
    key: 'pending',
    slot: 'pending',
    label: `${t('editions.volunteers.pending')} (${data.value?.stats.pendingCount || 0})`,
    icon: 'i-heroicons-clock',
  },
])

// Utilitaires
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Fonction pour envoyer un SMS groupé
const sendGroupSMS = () => {
  if (pendingWithPhone.value.length === 0) return

  // Récupérer les numéros de téléphone
  const phoneNumbers = pendingWithPhone.value.map((v: any) => v.user.phone).filter(Boolean)

  // Créer le message pré-rempli avec fallback sur le nom de la convention
  const displayName =
    data.value?.notification.editionName ||
    data.value?.notification.conventionName ||
    'la convention'
  const messageContent = data.value?.notification.message || ''
  const confirmationLink = `${window.location.origin}/editions/${props.editionId}/volunteers/notification/${data.value?.notification.id}/confirm`
  const message = encodeURIComponent(
    `Rappel: Merci de confirmer la lecture de la notification bénévole pour ${displayName}.\nMESSAGE : ${messageContent}\n\nConfirmer : ${confirmationLink}`
  )

  // Créer le lien SMS (format peut varier selon l'OS)
  const smsLink = `sms:${phoneNumbers.join(',')}?body=${message}`

  // Ouvrir l'application SMS
  window.location.href = smsLink

  toast.add({
    title: t('editions.volunteers.sms_app_opened'),
    description: t('editions.volunteers.sms_app_opened_desc'),
    color: 'primary',
  })
}

// Fonction pour copier les numéros de téléphone
const copyPhoneNumbers = async () => {
  if (pendingWithPhone.value.length === 0) return

  // Créer la liste des numéros avec les noms
  const phoneList = pendingWithPhone.value
    .map((v: any) => {
      const name = [v.user.pseudo, v.user.prenom, v.user.nom].filter(Boolean).join(' ')
      return `${name}: ${v.user.phone}`
    })
    .join('\n')

  try {
    await navigator.clipboard.writeText(phoneList)
    toast.add({
      title: t('editions.volunteers.phone_numbers_copied'),
      description: t('editions.volunteers.phone_numbers_copied_desc', {
        count: pendingWithPhone.value.length,
      }),
      color: 'success',
    })
  } catch (error) {
    console.error('Erreur lors de la copie:', error)
    toast.add({
      title: t('common.error'),
      description: t('editions.volunteers.copy_error'),
      color: 'error',
    })
  }
}

// Réinitialiser l'onglet quand la modal s'ouvre
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue) {
      selectedTab.value = 0 // Premier onglet (confirmés)
    }
  }
)
</script>
