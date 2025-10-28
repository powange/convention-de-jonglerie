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
        {{ $t('artists.meals.no_meals') }}
      </div>

      <div v-else class="space-y-6">
        <div class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t('artists.meals.description') }}
        </div>

        <div class="space-y-4">
          <div v-for="(dayMeals, date) in groupedMeals" :key="date" class="space-y-2">
            <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ formatMealDate(date) }}
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
                  <UCheckbox v-model="meal.accepted" :disabled="savingMeals" />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ getMealTypeLabel(meal.mealType) }}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      {{ getPhasesLabel(meal.phases) }}
                    </p>
                  </div>
                </div>
                <div v-if="meal.accepted" class="flex items-center gap-2 pl-7">
                  <USwitch
                    v-model="meal.afterShow"
                    :disabled="savingMeals"
                    size="xs"
                    :label="$t('artists.meals.after_show')"
                  />
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
            {{ $t('artists.meals.unsaved_changes') }}
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
const props = defineProps<{
  modelValue: boolean
  artist: any
  editionId: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'meals-saved': []
}>()

const { t } = useI18n()
const toast = useToast()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const title = computed(() => {
  if (!props.artist) return ''
  return t('artists.meals.title', {
    name: `${props.artist.user.prenom} ${props.artist.user.nom}`,
  })
})

// État pour les repas
const meals = ref<any[]>([])
const initialMeals = ref<any[]>([])
const loadingMeals = ref(false)
const savingMeals = ref(false)

// Labels pour les repas
const mealTypeLabels: Record<string, string> = {
  BREAKFAST: 'Petit déjeuner',
  LUNCH: 'Déjeuner',
  DINNER: 'Dîner',
}

const phaseLabels: Record<string, string> = {
  SETUP: 'Montage',
  EVENT: 'Édition',
  TEARDOWN: 'Démontage',
}

const getMealTypeLabel = (mealType: string) => mealTypeLabels[mealType] || mealType
const getPhasesLabel = (phases: string[]) => {
  if (!phases || phases.length === 0) return ''
  return phases.map((phase) => phaseLabels[phase] || phase).join(' + ')
}

// Grouper les repas par date
const groupedMeals = computed(() => {
  const grouped: Record<string, any[]> = {}
  meals.value.forEach((meal) => {
    const dateKey = meal.date.split('T')[0]
    if (!grouped[dateKey]) {
      grouped[dateKey] = []
    }
    grouped[dateKey].push(meal)
  })
  return grouped
})

// Formater la date pour l'affichage
const formatMealDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Détection des modifications non sauvegardées pour les repas
const hasUnsavedMealChanges = computed(() => {
  if (meals.value.length !== initialMeals.value.length) return true

  return meals.value.some((meal, index) => {
    const initialMeal = initialMeals.value[index]
    return meal.accepted !== initialMeal?.accepted || meal.afterShow !== initialMeal?.afterShow
  })
})

// Charger les repas
const fetchMeals = async () => {
  if (!props.artist) return

  loadingMeals.value = true
  try {
    const response = await $fetch(
      `/api/editions/${props.editionId}/artists/${props.artist.id}/meals`
    )
    if (response.success && response.meals) {
      meals.value = response.meals
      // Sauvegarder l'état initial pour la détection de changements
      initialMeals.value = JSON.parse(JSON.stringify(response.meals))
    }
  } catch (error: any) {
    console.error('Failed to fetch meals:', error)
    toast.add({
      title: t('common.error'),
      description: error?.data?.message || t('artists.meals.error_loading'),
      color: 'error',
    })
  } finally {
    loadingMeals.value = false
  }
}

// Sauvegarder les sélections de repas
const saveMealSelections = async () => {
  if (!props.artist) return

  savingMeals.value = true
  try {
    const selections = meals.value.map((meal) => ({
      selectionId: meal.selectionId,
      accepted: meal.accepted,
      afterShow: meal.afterShow || false,
    }))

    const response = await $fetch(
      `/api/editions/${props.editionId}/artists/${props.artist.id}/meals`,
      {
        method: 'PUT',
        body: { selections },
      }
    )

    if (response.success && response.meals) {
      meals.value = response.meals
      // Mettre à jour l'état initial après sauvegarde
      initialMeals.value = JSON.parse(JSON.stringify(response.meals))

      toast.add({
        title: t('common.saved'),
        description: t('artists.meals.saved_success'),
        color: 'success',
        icon: 'i-heroicons-check-circle',
      })

      emit('meals-saved')
    }
  } catch (error: any) {
    console.error('Failed to save meal selections:', error)
    toast.add({
      title: t('common.error'),
      description: error?.data?.message || t('artists.meals.error_saving'),
      color: 'error',
    })
  } finally {
    savingMeals.value = false
  }
}

const closeModal = () => {
  if (hasUnsavedMealChanges.value) {
    const confirmed = confirm(t('artists.meals.confirm_close_unsaved'))
    if (!confirmed) return
  }
  isOpen.value = false
}

// Charger les repas quand la modal s'ouvre
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen && props.artist) {
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
