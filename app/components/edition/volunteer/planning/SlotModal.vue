<template>
  <UModal v-model:open="isOpen" :title="modalTitle" size="lg">
    <template #body>
      <UForm :schema="slotSchema" :state="formState" class="space-y-4" @submit="onSubmit">
        <!-- Titre du créneau -->
        <UFormField name="title" :label="t('editions.volunteers.slot_title')">
          <UInput
            v-model="formState.title"
            :placeholder="$t('editions.volunteers.slot_title_placeholder')"
          />
        </UFormField>

        <!-- Description -->
        <UFormField name="description" :label="t('common.description')">
          <UTextarea
            v-model="formState.description"
            :placeholder="t('editions.volunteers.slot_description_placeholder')"
            :rows="3"
          />
        </UFormField>

        <!-- Équipe assignée -->
        <UFormField name="teamId" :label="t('editions.volunteers.assigned_team')">
          <USelect
            v-if="teamOptions.length > 2"
            v-model="formState.teamId"
            :items="teamOptions"
            :placeholder="t('editions.volunteers.select_team')"
          />
          <div
            v-else-if="teamOptions.length === 2"
            class="text-sm text-gray-600 dark:text-gray-300"
          >
            {{
              teamOptions.find((option) => option.value !== '')?.label ||
              t('editions.volunteers.no_team')
            }}
          </div>
          <div v-else class="text-sm text-gray-500 italic">
            {{ t('editions.volunteers.no_teams_available') }}
          </div>
        </UFormField>

        <!-- Dates et heures -->
        <div class="grid grid-cols-2 gap-4">
          <UFormField name="startDateTime" :label="t('common.start_date')">
            <UInput v-model="formState.startDateTime" type="datetime-local" />
          </UFormField>
          <UFormField name="endDateTime" :label="t('common.end_date')">
            <UInput v-model="formState.endDateTime" type="datetime-local" />
          </UFormField>
        </div>

        <!-- Nombre de bénévoles -->
        <UFormField name="maxVolunteers" :label="t('editions.volunteers.max_volunteers')">
          <UInput
            v-model.number="formState.maxVolunteers"
            type="number"
            min="1"
            max="50"
            :placeholder="$t('editions.volunteers.max_volunteers_placeholder')"
          />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <div class="flex justify-between">
        <div>
          <UButton
            v-if="formState.id"
            color="error"
            variant="ghost"
            icon="i-heroicons-trash"
            @click="onDelete"
          >
            {{ t('common.delete') }}
          </UButton>
        </div>
        <div class="flex gap-3">
          <UButton variant="ghost" @click="close">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="primary" :loading="loading" @click="onSubmit">
            {{ formState.id ? t('common.save') : t('common.create') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { z } from 'zod'

import type { VolunteerTimeSlot, VolunteerTeam } from '~/composables/useVolunteerSchedule'

// Props
interface Props {
  modelValue: boolean
  teams: VolunteerTeam[]
  initialSlot?: Partial<VolunteerTimeSlot> & {
    startDateTime?: string
    endDateTime?: string
  }
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: [slot: Omit<VolunteerTimeSlot, 'id'> & { id?: string }]
  delete: [slotId: string]
}>()

// i18n
const { t } = useI18n()

// État
const loading = ref(false)

// Computed
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const modalTitle = computed(() =>
  formState.value.id ? t('editions.volunteers.edit_slot') : t('editions.volunteers.create_slot')
)

const teamOptions = computed(() => [
  { value: '', label: t('editions.volunteers.no_team') },
  ...props.teams.map((team) => ({
    value: team.id,
    label: team.name,
  })),
])

// Schéma de validation
const slotSchema = z.object({
  title: z.string().min(1, t('errors.required_field')),
  description: z.string().optional(),
  teamId: z.string().optional(),
  startDateTime: z.string().min(1, t('errors.required_field')),
  endDateTime: z.string().min(1, t('errors.required_field')),
  maxVolunteers: z.number().min(1).max(50),
})

// État du formulaire
const formState = ref({
  id: '',
  title: '',
  description: '',
  teamId: '',
  startDateTime: '',
  endDateTime: '',
  maxVolunteers: 3,
})

// Watchers
watch(
  () => props.initialSlot,
  (newSlot) => {
    if (newSlot) {
      formState.value = {
        id: newSlot.id || '',
        title: newSlot.title || '',
        description: newSlot.description || '',
        teamId: newSlot.teamId || '',
        startDateTime: newSlot.startDateTime || '',
        endDateTime: newSlot.endDateTime || '',
        maxVolunteers: newSlot.maxVolunteers || 3,
      }
    } else {
      // Réinitialiser le formulaire
      formState.value = {
        id: '',
        title: '',
        description: '',
        teamId: '',
        startDateTime: '',
        endDateTime: '',
        maxVolunteers: 3,
      }
    }

    // Si une seule équipe disponible, la sélectionner automatiquement
    if (teamOptions.value.length === 2 && !formState.value.teamId) {
      const uniqueTeam = teamOptions.value.find((option) => option.value !== '')
      if (uniqueTeam) {
        formState.value.teamId = uniqueTeam.value
      }
    }
  },
  { immediate: true, deep: true }
)

// Watcher pour auto-sélectionner l'équipe unique
watch(
  teamOptions,
  (newOptions) => {
    // Si une seule équipe et pas déjà sélectionnée, l'auto-sélectionner
    if (newOptions.length === 2 && !formState.value.teamId) {
      const uniqueTeam = newOptions.find((option) => option.value !== '')
      if (uniqueTeam) {
        formState.value.teamId = uniqueTeam.value
      }
    }
  },
  { immediate: true }
)

// Actions
const close = () => {
  isOpen.value = false
}

const onSubmit = async () => {
  try {
    loading.value = true

    // Trouver la couleur de l'équipe sélectionnée
    const selectedTeam = props.teams.find((t) => t.id === formState.value.teamId)
    const color = selectedTeam?.color || '#6b7280'

    const slotData = {
      id: formState.value.id || undefined,
      title: formState.value.title,
      description: formState.value.description || '',
      teamId: formState.value.teamId || undefined,
      start: formState.value.startDateTime,
      end: formState.value.endDateTime,
      maxVolunteers: formState.value.maxVolunteers,
      assignedVolunteers: 0,
      color,
    }

    emit('save', slotData)
    close()
  } finally {
    loading.value = false
  }
}

const onDelete = async () => {
  if (!formState.value.id) return

  if (confirm(t('editions.volunteers.confirm_delete_slot'))) {
    try {
      loading.value = true
      emit('delete', formState.value.id)
      close()
    } finally {
      loading.value = false
    }
  }
}
</script>
