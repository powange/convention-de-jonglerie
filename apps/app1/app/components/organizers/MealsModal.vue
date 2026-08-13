<template>
  <UModal v-model:open="isOpen" :title="title">
    <template #body>
      <div v-if="loadingMeals" class="flex items-center justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin h-6 w-6 text-primary-500" />
      </div>

      <div v-else class="space-y-6">
        <div
          v-if="meals.length === 0"
          class="text-sm text-gray-500 italic p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center"
        >
          {{ $t('gestion.organizers.meals.no_meals') }}
        </div>

        <template v-else>
          <div class="flex items-start justify-between gap-3">
            <div class="text-sm text-gray-600 dark:text-gray-400">
              {{ $t('gestion.organizers.meals.description') }}
            </div>
            <UButton
              color="neutral"
              variant="soft"
              size="xs"
              class="shrink-0"
              :icon="allMealsAccepted ? 'i-heroicons-x-mark' : 'i-heroicons-check'"
              :disabled="savingMeals"
              @click="toggleAllMeals"
            >
              {{
                allMealsAccepted
                  ? $t('gestion.organizers.meals.uncheck_all')
                  : $t('gestion.organizers.meals.check_all')
              }}
            </UButton>
          </div>

          <div class="space-y-4">
            <div v-for="(dayMeals, date) in groupedMeals" :key="date" class="space-y-2">
              <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ formatMealDate(date as string) }}
              </h5>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div
                  v-for="meal in dayMeals"
                  :key="meal.id"
                  :class="[
                    'flex flex-col gap-2 p-3 border rounded-lg transition-opacity',
                    meal.accepted
                      ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                      : 'border-gray-200/50 dark:border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 opacity-60',
                  ]"
                >
                  <div class="flex items-center gap-3">
                    <UCheckbox
                      v-model="meal.accepted"
                      :disabled="savingMeals || !!meal.consumedAt"
                    />
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ getMealTypeLabel(meal.mealType) }}
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">
                        {{ getPhasesLabel(meal.phases) }}
                      </p>
                    </div>
                  </div>
                  <!-- Un repas déjà validé ne peut plus être décoché : il a été consommé. -->
                  <UBadge v-if="meal.consumedAt" color="success" variant="soft" size="sm">
                    {{ $t('gestion.organizers.meals.already_validated') }}
                  </UBadge>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- Alimentation -->
        <div class="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 space-y-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-utensils" class="size-4 text-orange-600 dark:text-orange-400" />
            <h3 class="text-sm font-medium text-orange-800 dark:text-orange-200">
              {{ $t('gestion.organizers.meals.dietary_section') }}
            </h3>
          </div>

          <UFormField :label="$t('gestion.organizers.meals.dietary_preference')">
            <USelect
              v-model="dietaryPreference"
              :items="dietaryOptions"
              value-key="value"
              :disabled="savingMeals"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="$t('gestion.organizers.meals.allergies')">
            <UTextarea
              v-model="allergies"
              :placeholder="$t('gestion.organizers.meals.allergies_placeholder')"
              rows="2"
              :disabled="savingMeals"
              class="w-full"
            />
          </UFormField>

          <UFormField v-if="allergies" :label="$t('gestion.organizers.meals.allergy_severity')">
            <USelect
              v-model="allergySeverity"
              :items="allergySeverityOptions"
              value-key="value"
              :disabled="savingMeals"
              class="w-full"
            />
          </UFormField>
        </div>

        <div
          v-if="hasUnsavedChanges"
          class="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg"
        >
          <UIcon
            name="i-heroicons-exclamation-circle"
            class="text-yellow-600 dark:text-yellow-400"
          />
          <span class="text-sm text-yellow-800 dark:text-yellow-200">
            {{ $t('gestion.organizers.meals.unsaved_changes') }}
          </span>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="soft" @click="closeModal">
          {{ $t('common.close') }}
        </UButton>
        <UButton
          color="primary"
          :disabled="!hasUnsavedChanges || savingMeals"
          :loading="savingMeals"
          @click="saveMeals"
        >
          {{ $t('common.save') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface OrganizerProp {
  id: number
  user: { prenom?: string | null; nom?: string | null; pseudo?: string | null }
}

interface OrganizerMeal extends Meal {
  accepted: boolean
  consumedAt: string | null
}

const props = defineProps<{
  modelValue: boolean
  organizer: OrganizerProp | null
  editionId: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'meals-saved': []
}>()

const { t } = useI18n()

const { getMealTypeLabel } = useMealTypeLabel()
const { getPhasesLabel } = useMealPhaseLabel()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const title = computed(() => {
  if (!props.organizer) return ''
  return t('gestion.organizers.meals.title', {
    name: formatUserFullName(props.organizer.user, t),
  })
})

const meals = ref<OrganizerMeal[]>([])
const dietaryPreference = ref('NONE')
const allergies = ref('')
const allergySeverity = ref<string | null>(null)

// Instantané de l'état chargé, pour détecter les modifications non sauvegardées
const initialState = ref('')

const dietaryOptions = computed(() => [
  { label: t('diet.none'), value: 'NONE' },
  { label: t('diet.vegetarian'), value: 'VEGETARIAN' },
  { label: t('diet.vegan'), value: 'VEGAN' },
])

const allergySeverityOptions = computed(() =>
  getAllergySeveritySelectOptions().map((option) => ({
    value: option.value,
    label: t(option.label),
  }))
)

const groupedMeals = computed(() => groupMealsByDate(meals.value))

const currentState = computed(() =>
  JSON.stringify({
    meals: meals.value.map((meal) => ({ id: meal.id, accepted: meal.accepted })),
    dietaryPreference: dietaryPreference.value,
    allergies: allergies.value,
    allergySeverity: allergySeverity.value,
  })
)

const hasUnsavedChanges = computed(() => currentState.value !== initialState.value)

// Tout cocher / décocher : le bouton bascule selon l'état courant. Les repas déjà validés
// restent cochés, on ne peut pas retirer un repas consommé.
const allMealsAccepted = computed(
  () => meals.value.length > 0 && meals.value.every((meal) => meal.accepted)
)

const toggleAllMeals = () => {
  const next = !allMealsAccepted.value
  for (const meal of meals.value) {
    if (meal.consumedAt) continue
    meal.accepted = next
  }
}

const applyResponse = (response: {
  meals?: OrganizerMeal[]
  dietaryPreference?: string
  allergies?: string | null
  allergySeverity?: string | null
}) => {
  meals.value = response.meals ?? []
  dietaryPreference.value = response.dietaryPreference ?? 'NONE'
  allergies.value = response.allergies ?? ''
  allergySeverity.value = response.allergySeverity ?? null
  initialState.value = currentState.value
}

const mealsUrl = () =>
  `/api/editions/${props.editionId}/organizers/edition-organizers/${props.organizer?.id}/meals`

const { execute: executeFetchMeals, loading: loadingMeals } = useApiAction(mealsUrl, {
  method: 'GET',
  errorMessages: { default: t('gestion.organizers.meals.error_loading') },
  onSuccess: applyResponse,
})

const { execute: executeSaveMeals, loading: savingMeals } = useApiAction(mealsUrl, {
  method: 'PUT',
  body: () => ({
    selections: meals.value.map((meal) => ({ mealId: meal.id, accepted: meal.accepted })),
    dietaryPreference: dietaryPreference.value,
    allergies: allergies.value || null,
    allergySeverity: allergies.value ? allergySeverity.value : null,
  }),
  successMessage: {
    title: t('common.saved'),
    description: t('gestion.organizers.meals.saved_success'),
  },
  errorMessages: { default: t('gestion.organizers.meals.error_saving') },
  onSuccess: (response: any) => {
    applyResponse(response)
    emit('meals-saved')
  },
})

const saveMeals = () => {
  if (!props.organizer) return
  executeSaveMeals()
}

const closeModal = () => {
  if (hasUnsavedChanges.value && !confirm(t('gestion.organizers.meals.confirm_close_unsaved'))) {
    return
  }
  isOpen.value = false
}

watch(
  () => props.modelValue,
  (opened) => {
    if (opened && props.organizer) {
      executeFetchMeals()
    } else {
      meals.value = []
      dietaryPreference.value = 'NONE'
      allergies.value = ''
      allergySeverity.value = null
      initialState.value = ''
    }
  },
  { immediate: true }
)
</script>
