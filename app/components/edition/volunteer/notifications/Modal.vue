<template>
  <UModal v-model:open="isOpen" :ui="{ width: 'sm:max-w-lg' }">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-bell" class="text-primary-500" />
        <span class="font-semibold">{{ t('editions.volunteers.send_notification') }}</span>
      </div>
    </template>

    <template #body>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <!-- Titre (non modifiable) -->
        <div>
          <UFormField :label="t('common.title')" class="w-full">
            <UInput
              :value="notificationTitle"
              readonly
              disabled
              class="w-full bg-gray-50 dark:bg-gray-800 text-gray-600"
            />
          </UFormField>
          <p class="text-xs text-gray-500 mt-1">
            {{ t('editions.volunteers.notification_title_info') }}
          </p>
        </div>

        <!-- Destinataires -->
        <div>
          <UFormField :label="t('editions.volunteers.notification_recipients')" class="w-full">
            <URadioGroup
              v-model="formData.targetType"
              :items="recipientOptions"
              :ui="{ fieldset: 'flex flex-col gap-2' }"
            />
          </UFormField>
        </div>

        <!-- Sélection d'équipes (si applicable) -->
        <div v-if="formData.targetType === 'teams' && teamsOptions.length > 0">
          <UFormField :label="t('editions.volunteers.select_teams')" class="w-full">
            <div class="space-y-2 overflow-y-auto">
              <UCheckbox
                v-for="(team, index) in teamsOptions"
                :id="`team-checkbox-${index}`"
                :key="`team-${index}-${team.value}`"
                :model-value="formData.selectedTeams.includes(team.value)"
                :label="team.label"
                @update:model-value="(checked: boolean) => handleTeamChange(team.value, checked)"
              />
            </div>
          </UFormField>
        </div>

        <!-- Message -->
        <div>
          <UFormField :label="t('common.message')" :error="messageError" class="w-full">
            <UTextarea
              v-model="formData.message"
              :rows="4"
              :placeholder="t('editions.volunteers.notification_message_placeholder')"
              :maxlength="messageMaxLength"
              class="w-full"
              @blur="markFieldTouched('message')"
            />
            <div class="text-xs text-gray-500 mt-1 flex justify-between">
              <span>{{ t('editions.volunteers.notification_message_help') }}</span>
              <span>{{ formData.message.length }}/{{ messageMaxLength }}</span>
            </div>
          </UFormField>
        </div>

        <!-- Aperçu du nombre de destinataires -->
        <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg space-y-2">
          <div class="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <UIcon name="i-heroicons-users" size="16" />
            <span class="text-sm font-medium">
              {{
                t('editions.volunteers.notification_recipients_count', { count: recipientCount })
              }}
            </span>
          </div>

          <!-- Liste des destinataires -->
          <div v-if="selectedRecipients.length > 0" class="text-blue-600 dark:text-blue-300">
            <div class="max-h-32 overflow-y-auto space-y-1">
              <div
                v-for="recipient in selectedRecipients"
                :key="recipient.id"
                class="flex items-center justify-between bg-white dark:bg-blue-800/30 px-2 py-1 rounded text-xs"
              >
                <span class="font-medium">
                  {{ recipient.user.pseudo }}
                  <span
                    v-if="recipient.user.prenom || recipient.user.nom"
                    class="font-normal text-gray-600 dark:text-gray-400"
                  >
                    ({{ [recipient.user.prenom, recipient.user.nom].filter(Boolean).join(' ') }})
                  </span>
                </span>
                <span
                  v-if="formData.targetType === 'teams' && recipient.assignedTeams?.length"
                  class="text-blue-500 dark:text-blue-400"
                >
                  {{
                    recipient.assignedTeams
                      .filter((team) => formData.selectedTeams.includes(team))
                      .join(', ')
                  }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3 pt-4">
          <UButton type="button" color="neutral" variant="ghost" @click="isOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            type="submit"
            :loading="sending"
            :disabled="!canSend"
            icon="i-heroicons-paper-airplane"
          >
            {{ t('editions.volunteers.send_notification') }}
          </UButton>
        </div>
      </form>
    </template>
  </UModal>

  <!-- Modal de confirmation avec teleport -->
  <Teleport to="body">
    <UiConfirmModal
      v-model="showConfirmation"
      :title="t('editions.volunteers.confirm_send_notification_title')"
      :description="
        t('editions.volunteers.confirm_send_notification_description', {
          count: recipientCount,
          targetType:
            formData.targetType === 'all'
              ? t('editions.volunteers.all_accepted_volunteers').toLowerCase()
              : t('editions.volunteers.selected_teams').toLowerCase(),
        })
      "
      :confirm-label="t('editions.volunteers.send_notification')"
      :cancel-label="t('common.cancel')"
      confirm-icon="i-heroicons-paper-airplane"
      :loading="sending"
      @confirm="confirmSend"
      @cancel="showConfirmation = false"
    />
  </Teleport>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
  edition: any
  volunteersInfo: any
  volunteerApplications?: any[]
  isTeamLeader?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
  (
    e: 'sent',
    data: { targetType: string; selectedTeams?: string[]; message: string; recipientCount: number }
  ): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const toast = useToast()

// Utiliser le nouveau système VolunteerTeam avec filtrage pour les team leaders
const { teams: volunteerTeams, fetchTeams } = useVolunteerTeams(props.edition.id, {
  leaderOnly: props.isTeamLeader || false,
})

const messageMaxLength = 500

// Gestion de l'état open/close de la modal
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => {
    emit('update:modelValue', value)
    if (!value) {
      emit('close')
    }
  },
})

// Form data - Pour les team leaders, forcer le mode "teams"
const formData = ref({
  targetType: (props.isTeamLeader ? 'teams' : 'all') as 'all' | 'teams',
  selectedTeams: [] as string[],
  message: '',
})

const sending = ref(false)
const touchedFields = ref(new Set<string>())

// Computed properties
const notificationTitle = computed(() => {
  // Utiliser le nom de l'édition si disponible, sinon le nom de la convention
  const displayName = props.edition?.name || props.edition?.convention?.name || ''
  return `${t('editions.volunteers.notification_title_prefix')} - ${displayName}`
})

const recipientOptions = computed(() => {
  // Pour les team leaders, ne montrer que l'option "équipes spécifiques"
  if (props.isTeamLeader) {
    return [
      {
        value: 'teams',
        label: t('editions.volunteers.specific_teams'),
        disabled: !teamsOptions.value.length,
      },
    ]
  }

  // Pour les managers, montrer toutes les options
  return [
    {
      value: 'all',
      label: t('editions.volunteers.all_accepted_volunteers'),
    },
    {
      value: 'teams',
      label: t('editions.volunteers.specific_teams'),
      disabled: !teamsOptions.value.length,
    },
  ]
})

const teamsOptions = computed(() => {
  if (!volunteerTeams.value || volunteerTeams.value.length === 0) return []

  return volunteerTeams.value.map((team: any) => ({
    value: team.name, // Garder le nom comme valeur pour la compatibilité avec les assignedTeams
    label: `${team.name} ${team.assignedVolunteersCount ? `(${team.assignedVolunteersCount})` : ''}`,
  }))
})

const selectedRecipients = computed(() => {
  const applications = props.volunteerApplications

  if (!applications || applications.length === 0) {
    return []
  }

  if (formData.value.targetType === 'all') {
    return applications.filter((app: any) => app.status === 'ACCEPTED')
  } else if (formData.value.targetType === 'teams' && formData.value.selectedTeams.length > 0) {
    return applications.filter(
      (app: any) =>
        app.status === 'ACCEPTED' &&
        app.assignedTeams?.some((team: string) => formData.value.selectedTeams.includes(team))
    )
  }

  return []
})

const recipientCount = computed(() => {
  // Si on a les applications détaillées, utiliser la liste filtrée
  if (props.volunteerApplications && props.volunteerApplications.length > 0) {
    return selectedRecipients.value.length
  }

  // Fallback: utiliser les counts de volunteersInfo
  if (formData.value.targetType === 'all') {
    return props.volunteersInfo?.counts?.ACCEPTED || 0
  }

  // Pour les équipes spécifiques sans données détaillées, on ne peut pas calculer
  return 0
})

const messageError = computed(() => {
  if (!touchedFields.value.has('message')) return undefined
  if (!formData.value.message.trim()) {
    return t('validation.message_required')
  }
  if (formData.value.message.length > messageMaxLength) {
    return t('validation.message_too_long', { max: messageMaxLength })
  }
  return undefined
})

const canSend = computed(() => {
  return (
    formData.value.message.trim() &&
    formData.value.message.length <= messageMaxLength &&
    recipientCount.value > 0 &&
    (formData.value.targetType === 'all' || formData.value.selectedTeams.length > 0) &&
    !sending.value
  )
})

// Methods
const markFieldTouched = (field: string) => {
  touchedFields.value.add(field)
}

const handleTeamChange = (teamName: string, checked: boolean) => {
  if (checked) {
    // Ajouter l'équipe si elle n'est pas déjà présente
    if (!formData.value.selectedTeams.includes(teamName)) {
      formData.value.selectedTeams = [...formData.value.selectedTeams, teamName]
    }
  } else {
    // Retirer l'équipe
    formData.value.selectedTeams = formData.value.selectedTeams.filter((t) => t !== teamName)
  }
}

const resetForm = () => {
  formData.value = {
    targetType: (props.isTeamLeader ? 'teams' : 'all') as 'all' | 'teams',
    selectedTeams: [],
    message: '',
  }
  touchedFields.value.clear()
  sending.value = false
}

const showConfirmation = ref(false)

const handleSubmit = async () => {
  // Valider tous les champs
  touchedFields.value.add('message')

  if (!canSend.value) {
    return
  }

  // Afficher la modal de confirmation
  showConfirmation.value = true
}

const confirmSend = async () => {
  showConfirmation.value = false

  sending.value = true

  try {
    await $fetch(`/api/editions/${props.edition.id}/volunteers/notifications`, {
      method: 'POST',
      body: {
        targetType: formData.value.targetType,
        selectedTeams:
          formData.value.targetType === 'teams' ? formData.value.selectedTeams : undefined,
        message: formData.value.message.trim(),
      },
    })

    emit('sent', {
      targetType: formData.value.targetType,
      selectedTeams:
        formData.value.targetType === 'teams' ? formData.value.selectedTeams : undefined,
      message: formData.value.message.trim(),
      recipientCount: recipientCount.value,
    })

    toast.add({
      title: t('editions.volunteers.notification_sent_success'),
      description: t('editions.volunteers.notification_sent_count', {
        count: recipientCount.value,
      }),
      color: 'success',
    })

    resetForm()
    isOpen.value = false
  } catch (error: any) {
    toast.add({
      title: t('editions.volunteers.notification_send_error'),
      description: error?.data?.message || t('common.error'),
      color: 'error',
    })
  } finally {
    sending.value = false
  }
}

// Watch for modal changes to reset form and reload teams
watch(
  () => props.modelValue,
  async (newValue) => {
    if (newValue) {
      resetForm()
      // Recharger les équipes pour s'assurer d'avoir les bonnes données
      await fetchTeams()
    }
  }
)
</script>
