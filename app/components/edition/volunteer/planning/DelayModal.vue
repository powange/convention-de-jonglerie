<template>
  <UModal v-model:open="isOpen" size="md">
    <template #header>
      <div class="flex items-center gap-3">
        <UIcon name="i-heroicons-clock" class="w-5 h-5 text-primary-600" />
        <h3 class="text-lg font-semibold">{{ t('edition.volunteers.manage_delay') }}</h3>
      </div>
    </template>

    <template #body>
      <div class="space-y-4">
        <!-- Info du créneau -->
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div class="flex items-center gap-2 mb-2">
            <UIcon name="i-heroicons-calendar" class="w-4 h-4 text-gray-600" />
            <h4 class="text-sm font-medium text-gray-900 dark:text-white">
              {{ timeSlot?.title || t('edition.volunteers.untitled_slot') }}
            </h4>
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400 pl-6">
            {{ formatDateTime(timeSlot?.start) }} - {{ formatDateTime(timeSlot?.end) }}
          </div>
        </div>

        <!-- Retard actuel -->
        <div
          v-if="currentDelay !== null"
          class="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 flex items-center justify-between"
        >
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 text-orange-600" />
            <span class="text-sm font-medium text-orange-800 dark:text-orange-200">
              {{ t('edition.volunteers.current_delay') }}:
            </span>
          </div>
          <span class="text-sm font-semibold text-orange-600 dark:text-orange-400">
            {{ formatDelay(currentDelay) }}
          </span>
        </div>

        <!-- Boutons de retard rapide -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ t('edition.volunteers.quick_delays') }}
          </label>
          <div class="grid grid-cols-3 gap-2">
            <UButton
              v-for="delay in quickDelays"
              :key="delay.minutes"
              variant="soft"
              color="warning"
              size="sm"
              @click="delayMinutes = delay.minutes"
            >
              {{ delay.label }}
            </UButton>
          </div>
        </div>

        <!-- Champ personnalisé -->
        <UFormField :label="t('edition.volunteers.custom_delay')" name="delayMinutes">
          <UInput
            v-model.number="delayMinutes"
            type="number"
            :placeholder="t('edition.volunteers.delay_placeholder')"
            icon="i-heroicons-clock"
          >
            <template #trailing>
              <span class="text-xs text-gray-500">{{ t('edition.volunteers.minutes') }}</span>
            </template>
          </UInput>
          <template #hint>
            <span class="text-xs text-gray-500">
              {{ t('edition.volunteers.delay_hint') }}
            </span>
          </template>
        </UFormField>

        <!-- Prévisualisation -->
        <div
          v-if="delayMinutes !== null && delayMinutes !== 0"
          class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border-2 border-blue-200 dark:border-blue-800"
        >
          <div class="flex items-center gap-2 mb-3">
            <UIcon name="i-heroicons-information-circle" class="w-5 h-5 text-blue-600" />
            <span class="text-sm font-semibold text-blue-800 dark:text-blue-200">
              {{ t('edition.volunteers.preview') }}
            </span>
            <span class="text-sm font-medium text-blue-600 dark:text-blue-400">
              ({{ formatDelay(delayMinutes) }})
            </span>
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-sm text-blue-700 dark:text-blue-300">
                {{ t('edition.volunteers.new_start_time') }}:
              </span>
              <span class="text-base font-bold text-blue-900 dark:text-blue-100">
                {{ newStartTime }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-blue-700 dark:text-blue-300">
                {{ t('edition.volunteers.new_end_time') }}:
              </span>
              <span class="text-base font-bold text-blue-900 dark:text-blue-100">
                {{ newEndTime }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center justify-between gap-3">
        <UButton
          v-if="currentDelay !== null"
          variant="ghost"
          color="error"
          icon="i-heroicons-trash"
          @click="removeDelay"
        >
          {{ t('edition.volunteers.remove_delay') }}
        </UButton>
        <div v-else></div>
        <div class="flex gap-2">
          <UButton variant="ghost" @click="close">
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            color="primary"
            :disabled="delayMinutes === null || delayMinutes === currentDelay"
            :loading="loading"
            @click="saveDelay"
          >
            {{ t('common.save') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { VolunteerTimeSlot } from '~/composables/useVolunteerSchedule'

// Props
interface Props {
  modelValue: boolean
  editionId: number
  timeSlot: VolunteerTimeSlot | null
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  refresh: []
}>()

// i18n et utilitaires
const { t } = useI18n()
const { formatForDisplay } = useDatetime()

// État
const delayMinutes = ref<number | null>(null)

// Computed
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const currentDelay = computed(() => {
  return props.timeSlot?.delayMinutes ?? null
})

// Boutons de retard rapide
const quickDelays = [
  { label: '+5 min', minutes: 5 },
  { label: '+10 min', minutes: 10 },
  { label: '+15 min', minutes: 15 },
  { label: '+30 min', minutes: 30 },
  { label: '+1h', minutes: 60 },
  { label: '-15 min', minutes: -15 },
]

// Formatage de la date/heure
const formatDateTime = (dateTime: string | undefined) => {
  if (!dateTime) return '-'
  return formatForDisplay(new Date(dateTime))
}

// Formatage du retard
const formatDelay = (minutes: number) => {
  if (minutes === 0) return t('edition.volunteers.no_delay')
  if (minutes > 0) {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      return mins > 0
        ? t('edition.volunteers.delay_hours_minutes', { hours, minutes: mins })
        : t('edition.volunteers.delay_hours', { hours })
    }
    return t('edition.volunteers.delay_minutes', { minutes })
  }
  // Avance (valeur négative)
  const absoluteMinutes = Math.abs(minutes)
  if (absoluteMinutes >= 60) {
    const hours = Math.floor(absoluteMinutes / 60)
    const mins = absoluteMinutes % 60
    return mins > 0
      ? t('edition.volunteers.advance_hours_minutes', { hours, minutes: mins })
      : t('edition.volunteers.advance_hours', { hours })
  }
  return t('edition.volunteers.advance_minutes', { minutes: absoluteMinutes })
}

// Nouvelles heures avec le retard appliqué
const newStartTime = computed(() => {
  if (delayMinutes.value === null || delayMinutes.value === 0 || !props.timeSlot?.start) return '-'

  const originalStart = new Date(props.timeSlot.start)
  const newStart = new Date(originalStart.getTime() + delayMinutes.value * 60000)
  return formatForDisplay(newStart)
})

const newEndTime = computed(() => {
  if (delayMinutes.value === null || delayMinutes.value === 0 || !props.timeSlot?.end) return '-'

  const originalEnd = new Date(props.timeSlot.end)
  const newEnd = new Date(originalEnd.getTime() + delayMinutes.value * 60000)
  return formatForDisplay(newEnd)
})

// Actions
const close = () => {
  isOpen.value = false
}

// Callback commun après succès
const onSuccess = () => {
  emit('refresh')
  close()
}

// Action pour sauvegarder le retard
const { execute: executeSaveDelay, loading: isSaving } = useApiAction(
  () => `/api/editions/${props.editionId}/volunteer-time-slots/${props.timeSlot?.id}`,
  {
    method: 'PUT',
    body: () => ({ delayMinutes: delayMinutes.value }),
    successMessage: { title: t('edition.volunteers.delay_saved') },
    errorMessages: { default: t('errors.error_occurred') },
    onSuccess,
  }
)

// Action pour supprimer le retard
const { execute: executeRemoveDelay, loading: isRemoving } = useApiAction(
  () => `/api/editions/${props.editionId}/volunteer-time-slots/${props.timeSlot?.id}`,
  {
    method: 'PUT',
    body: () => ({ delayMinutes: null }),
    successMessage: { title: t('edition.volunteers.delay_removed') },
    errorMessages: { default: t('errors.error_occurred') },
    onSuccess,
  }
)

// État de chargement combiné
const loading = computed(() => isSaving.value || isRemoving.value)

const saveDelay = () => {
  if (!props.timeSlot?.id || delayMinutes.value === null) return
  executeSaveDelay()
}

const removeDelay = () => {
  if (!props.timeSlot?.id) return
  executeRemoveDelay()
}

// Initialiser le retard lors de l'ouverture
watch(
  [isOpen, () => props.timeSlot?.delayMinutes],
  ([isOpenValue, currentDelayValue]) => {
    if (isOpenValue) {
      delayMinutes.value = currentDelayValue ?? null
    }
  },
  { immediate: true }
)
</script>
