<template>
  <UModal v-model:open="isOpen" :ui="{ width: 'sm:max-w-2xl' }">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-pencil" class="text-primary-500" />
        <span class="font-semibold">{{ t('editions.volunteers.edit_application') }}</span>
      </div>
    </template>

    <template #body>
      <div v-if="application" class="space-y-6">
        <!-- Informations du candidat (lecture seule) -->
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 class="font-medium text-gray-900 dark:text-gray-100 mb-3">
            {{ t('editions.volunteers.applicant_info') }}
          </h4>
          <div class="flex items-center gap-3 mb-3">
            <UiUserAvatar :user="application.user" size="sm" />
            <div>
              <div class="font-medium">{{ application.user.pseudo }}</div>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                {{ application.user.prenom }} {{ application.user.nom }}
              </div>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                {{ application.user.email }}
              </div>
            </div>
          </div>
          <UBadge
            :color="getStatusColor(application.status)"
            variant="soft"
            size="sm"
          >
            {{ t(`editions.volunteers.status.${application.status.toLowerCase()}`) }}
          </UBadge>
        </div>

        <!-- Formulaire d'édition -->
        <form @submit.prevent="handleSubmit">
          <!-- Équipes préférées -->
          <div v-if="teamOptions.length > 0" class="space-y-3">
            <UFormField
              :label="t('editions.volunteers.team_preferences_label')"
              :help="t('editions.volunteers.team_preferences_hint')"
            >
              <div class="space-y-2 max-h-48 overflow-y-auto">
                <div
                  v-for="team in teamOptions"
                  :key="team.value"
                  class="flex items-center"
                >
                  <UCheckbox
                    :id="`team-${team.value}`"
                    :model-value="formData.teamPreferences.includes(team.value)"
                    :label="team.label"
                    class="text-sm"
                    @update:model-value="(checked) => handleTeamToggle(team.value, checked)"
                  />
                </div>
              </div>
            </UFormField>
          </div>

          <!-- Note de modification (facultatif) -->
          <UFormField
            :label="t('editions.volunteers.modification_note')"
            :help="t('editions.volunteers.modification_note_help')"
          >
            <UTextarea
              v-model="formData.modificationNote"
              :rows="3"
              :placeholder="t('editions.volunteers.modification_note_placeholder')"
              :maxlength="500"
            />
            <div class="text-xs text-gray-500 mt-1 text-right">
              {{ formData.modificationNote.length }}/500
            </div>
          </UFormField>
        </form>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton
          color="neutral"
          variant="ghost"
          @click="isOpen = false"
        >
          {{ t('common.cancel') }}
        </UButton>
        <UButton
          color="primary"
          :loading="saving"
          :disabled="!hasChanges"
          @click="handleSubmit"
        >
          {{ t('common.save') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import UiUserAvatar from '~/components/ui/UserAvatar.vue'

interface Props {
  modelValue: boolean
  application: any | null
  teamOptions: Array<{ value: string; label: string }>
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', data: { application: any; changes: any }): void
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

const saving = ref(false)

// Données du formulaire
const formData = ref({
  teamPreferences: [] as string[],
  modificationNote: '',
})

// Données initiales pour détecter les changements
const initialData = ref({
  teamPreferences: [] as string[],
})

// Calculer s'il y a des changements
const hasChanges = computed(() => {
  return JSON.stringify(formData.value.teamPreferences) !== JSON.stringify(initialData.value.teamPreferences)
})

// Initialiser le formulaire quand l'application change
watch(
  () => props.application,
  (newApplication) => {
    if (newApplication) {
      const teamPrefs = newApplication.teamPreferences || []
      formData.value.teamPreferences = [...teamPrefs]
      formData.value.modificationNote = ''

      // Sauvegarder les données initiales
      initialData.value.teamPreferences = [...teamPrefs]
    }
  },
  { immediate: true }
)

// Réinitialiser le formulaire quand la modal se ferme
watch(isOpen, (newValue) => {
  if (!newValue) {
    formData.value.modificationNote = ''
    saving.value = false
  }
})

// Gestion des équipes
const handleTeamToggle = (teamValue: string, checked: boolean) => {
  if (checked && !formData.value.teamPreferences.includes(teamValue)) {
    formData.value.teamPreferences.push(teamValue)
  } else if (!checked) {
    const index = formData.value.teamPreferences.indexOf(teamValue)
    if (index > -1) {
      formData.value.teamPreferences.splice(index, 1)
    }
  }
}

// Couleur du statut
const getStatusColor = (status: string) => {
  switch (status) {
    case 'PENDING': return 'orange'
    case 'ACCEPTED': return 'green'
    case 'REJECTED': return 'red'
    default: return 'gray'
  }
}

// Soumission du formulaire
const handleSubmit = async () => {
  if (!props.application || !hasChanges.value) return

  saving.value = true

  try {
    // Préparer les changements
    const changes = {
      teamPreferences: formData.value.teamPreferences,
      modificationNote: formData.value.modificationNote.trim(),
    }

    // Émettre l'événement de sauvegarde
    emit('save', {
      application: props.application,
      changes,
    })

    toast.add({
      title: t('editions.volunteers.application_updated'),
      description: t('editions.volunteers.notification_sent_to_volunteer'),
      color: 'success',
    })

    isOpen.value = false
  } catch {
    toast.add({
      title: t('common.error'),
      description: t('editions.volunteers.update_error'),
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}
</script>