<template>
  <UModal v-model:open="isOpen" :title="title">
    <template #body>
      <div v-if="loadingMeals" class="flex items-center justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin h-6 w-6 text-primary-500" />
      </div>

      <div
        v-else-if="meals.length === 0"
        class="text-sm text-gray-500 italic p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center"
      >
        {{ $t('edition.volunteers.meals.no_meals') }}
      </div>

      <div v-else class="space-y-6">
        <div class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t('edition.volunteers.meals.description') }}
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
                  'flex items-center gap-3 p-3 border rounded-lg transition-opacity',
                  !meal.eligible
                    ? 'border-gray-200/30 dark:border-gray-700/30 bg-gray-100/30 dark:bg-gray-900/30 opacity-40'
                    : meal.accepted
                      ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                      : 'border-gray-200/50 dark:border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 opacity-60',
                ]"
              >
                <UCheckbox
                  v-model="meal.accepted"
                  :disabled="savingMeals || !meal.eligible"
                  :title="!meal.eligible ? $t('edition.volunteers.meals.not_eligible') : ''"
                />
                <div class="flex-1 min-w-0">
                  <p
                    :class="[
                      'text-sm font-medium',
                      meal.eligible
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-400 dark:text-gray-600',
                    ]"
                  >
                    {{ getMealTypeLabel(meal.mealType) }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    {{ getPhasesLabel(meal.phases) }}
                  </p>
                  <p
                    v-if="!meal.eligible"
                    class="text-xs text-orange-600 dark:text-orange-400 mt-1"
                  >
                    {{ $t('edition.volunteers.meals.not_eligible_reason') }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="hasUnsavedMealChanges"
          class="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg"
        >
          <UIcon
            name="i-heroicons-exclamation-circle"
            class="text-yellow-600 dark:text-yellow-400"
          />
          <span class="text-sm text-yellow-800 dark:text-yellow-200">
            {{ $t('edition.volunteers.meals.unsaved_changes') }}
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
          :disabled="!hasUnsavedMealChanges || savingMeals"
          :loading="savingMeals"
          @click="saveMealSelections"
        >
          {{ $t('common.save') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface VolunteerProp {
  id: number
  user: { prenom: string; nom: string }
}

const props = defineProps<{
  modelValue: boolean
  volunteer: VolunteerProp | null
  editionId: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'meals-saved': []
}>()

const { t } = useI18n()
const toast = useToast()

// Utiliser les utilitaires meals
const { getMealTypeLabel } = useMealTypeLabel()
const { getPhasesLabel } = useMealPhaseLabel()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const title = computed(() => {
  if (!props.volunteer) return ''
  return t('edition.volunteers.meals.title', {
    name: `${props.volunteer.user.prenom} ${props.volunteer.user.nom}`,
  })
})

// État pour les repas
const meals = ref<Meal[]>([])
const initialMeals = ref<Meal[]>([])
const loadingMeals = ref(false)

// Grouper les repas par date
const groupedMeals = computed(() => groupMealsByDate(meals.value))

// Détection des modifications non sauvegardées pour les repas
const hasUnsavedMealChanges = computed(() => {
  if (meals.value.length !== initialMeals.value.length) return true

  return meals.value.some((meal, index) => {
    const initialMeal = initialMeals.value[index]
    return meal.accepted !== initialMeal?.accepted
  })
})

// Charger les repas
const fetchMeals = async () => {
  if (!props.volunteer) return

  loadingMeals.value = true
  try {
    const response = await $fetch(
      `/api/editions/${props.editionId}/volunteers/${props.volunteer.id}/meals`
    )
    if (response.success && response.meals) {
      // Sauvegarder l'état initial AVANT de décocher (pour détecter les changements)
      initialMeals.value = JSON.parse(JSON.stringify(response.meals))

      // Décocher automatiquement les repas non éligibles
      meals.value = response.meals.map((meal: Meal) => ({
        ...meal,
        accepted: meal.eligible ? meal.accepted : false,
      }))
    }
  } catch {
    toast.add({
      title: t('common.error'),
      description: t('edition.volunteers.meals.error_loading'),
      color: 'error',
    })
  } finally {
    loadingMeals.value = false
  }
}

// Sauvegarder les sélections de repas
const { execute: executeSaveMeals, loading: savingMeals } = useApiAction(
  () => `/api/editions/${props.editionId}/volunteers/${props.volunteer?.id}/meals`,
  {
    method: 'PUT',
    body: () => ({
      selections: meals.value.map((meal) => ({
        mealId: meal.id,
        selectionId: meal.selectionId,
        accepted: meal.accepted,
      })),
    }),
    successMessage: {
      title: t('common.saved'),
      description: t('edition.volunteers.meals.saved_success'),
    },
    errorMessages: { default: t('edition.volunteers.meals.error_saving') },
    onSuccess: (result: { meals?: Meal[] }) => {
      if (result.meals) {
        meals.value = result.meals
        initialMeals.value = JSON.parse(JSON.stringify(result.meals))
      }
      emit('meals-saved')
    },
  }
)

const saveMealSelections = () => {
  if (!props.volunteer) return
  executeSaveMeals()
}

const closeModal = () => {
  if (hasUnsavedMealChanges.value) {
    const confirmed = confirm(t('edition.volunteers.meals.confirm_close_unsaved'))
    if (!confirmed) return
  }
  isOpen.value = false
}

// Charger les repas quand la modal s'ouvre
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen && props.volunteer) {
      fetchMeals()
    } else {
      // Réinitialiser quand la modal se ferme
      meals.value = []
      initialMeals.value = []
    }
  },
  { immediate: true }
)
</script>
