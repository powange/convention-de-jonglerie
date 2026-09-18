<template>
  <UModal v-model:open="isOpen" size="md">
    <template #header>
      <div class="flex items-center gap-3">
        <UIcon name="i-heroicons-clock" class="w-5 h-5 text-primary-600" />
        <h3 class="text-lg font-semibold">{{ t('volunteers.manage_delay') }}</h3>
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
            {{ formatDateTime(timeSlot?.startDateTime) }} -
            {{ formatDateTime(timeSlot?.endDateTime) }}
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
              {{ t('volunteers.current_delay') }}:
            </span>
          </div>
          <span class="text-sm font-semibold text-orange-600 dark:text-orange-400">
            {{ formatDelay(currentDelay) }}
          </span>
        </div>

        <!-- Boutons de retard rapide -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ t('volunteers.quick_delays') }}
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
        <UFormField :label="t('volunteers.custom_delay')" name="delayMinutes">
          <UInput
            v-model.number="delayMinutes"
            type="number"
            :placeholder="t('volunteers.delay_placeholder')"
            icon="i-heroicons-clock"
          >
            <template #trailing>
              <span class="text-xs text-gray-500">{{ t('volunteers.minutes') }}</span>
            </template>
          </UInput>
          <template #hint>
            <span class="text-xs text-gray-500">
              {{ t('volunteers.delay_hint') }}
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
              {{ t('volunteers.preview') }}
            </span>
            <span class="text-sm font-medium text-blue-600 dark:text-blue-400">
              ({{ formatDelay(delayMinutes) }})
            </span>
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-sm text-blue-700 dark:text-blue-300">
                {{ t('volunteers.new_start_time') }}:
              </span>
              <span class="text-base font-bold text-blue-900 dark:text-blue-100">
                {{ newStartTime }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-blue-700 dark:text-blue-300">
                {{ t('volunteers.new_end_time') }}:
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
          {{ t('volunteers.remove_delay') }}
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

import type { VolunteerTimeSlot } from '#imports'

import { decalageTraduisible, horairesEffectifs } from '../../../../utils/retard-creneau'

import { formaterDateHeure } from '~~/shared/utils/fuseau-edition'

// Props
interface Props {
  modelValue: boolean
  editionId: number
  timeSlot: VolunteerTimeSlot | null
  /** Fuseau de l'édition : l'heure d'un créneau est celle du LIEU, comme sur le planning. */
  fuseau?: string | null
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  refresh: []
}>()

// i18n et utilitaires
const { t, locale } = useI18n()

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

/**
 * La date et l'heure dans le fuseau de l'ÉDITION.
 *
 * Ce `formatDateTime` était recopié à l'identique dans trois modales du planning, et les trois
 * retombaient sur le fuseau du navigateur : la frise annonçait l'heure du lieu, les modales
 * qu'on ouvrait depuis elle en annonçaient une autre.
 */
const formatDateTime = (dateTime: string | Date | undefined) => {
  if (!dateTime) return '-'
  return formaterDateHeure(dateTime, props.fuseau, locale.value) || '-'
}

// Formatage du retard
/**
 * Le décalage mis en mots. La règle — retard ou avance, minutes ou heures — vit dans
 * `retard-creneau`, partagée avec les écrans qui annoncent un créneau déplacé.
 */
const formatDelay = (minutes: number) => {
  const decalage = decalageTraduisible(minutes)
  return decalage ? t(decalage.cle, decalage.valeurs) : t('volunteers.no_delay')
}

// Nouvelles heures avec le retard appliqué
/**
 * L'aperçu du créneau déplacé, par la même règle que les six surfaces qui l'affichent ensuite.
 *
 * Elle était recopiée ici, et c'est ce qui a permis à cette modale d'accepter une avance que
 * personne n'appliquait : l'aperçu la montrait, l'affichage l'ignorait.
 */
const horairesApercus = computed(() =>
  horairesEffectifs(props.timeSlot?.startDateTime, props.timeSlot?.endDateTime, delayMinutes.value)
)

const newStartTime = computed(() =>
  horairesApercus.value?.decale ? formatDateTime(horairesApercus.value.debut) : '-'
)

const newEndTime = computed(() =>
  horairesApercus.value?.decale ? formatDateTime(horairesApercus.value.fin) : '-'
)

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
    successMessage: { title: t('volunteers.delay_saved') },
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
    successMessage: { title: t('volunteers.delay_removed') },
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
