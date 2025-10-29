<template>
  <UCard variant="soft">
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold flex items-center gap-2">
          <UIcon name="i-heroicons-cake" class="text-primary-500" />
          Mes repas
        </h3>
      </div>
    </template>

    <div v-if="loadingMeals" class="flex items-center justify-center py-8">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin h-6 w-6 text-primary-500" />
    </div>

    <div
      v-else-if="meals.length === 0"
      class="text-sm text-gray-500 italic p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center"
    >
      Aucun repas disponible pour votre période de bénévolat.
    </div>

    <div v-else class="space-y-6">
      <div class="text-sm text-gray-600 dark:text-gray-400">
        Indiquez les repas que vous souhaitez prendre pendant votre période de bénévolat.
      </div>

      <div class="space-y-4">
        <div v-for="(dayMeals, date) in groupedMeals" :key="date" class="space-y-2">
          <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ formatDate(date) }}
          </h5>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div
              v-for="meal in dayMeals"
              :key="meal.id"
              :class="[
                'flex items-center gap-3 p-3 border rounded-lg transition-opacity',
                meal.accepted
                  ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                  : 'border-gray-200/50 dark:border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 opacity-60',
              ]"
            >
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
          </div>
        </div>
      </div>

      <div
        class="flex items-center justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700"
      >
        <div v-if="hasUnsavedChanges" class="text-xs text-gray-500">
          <UIcon name="i-heroicons-exclamation-circle" class="inline" />
          Modifications non sauvegardées
        </div>
        <UButton
          color="primary"
          :disabled="!hasUnsavedChanges || savingMeals"
          :loading="savingMeals"
          @click="saveMealSelections"
        >
          Sauvegarder
        </UButton>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

const toast = useToast()

// Utiliser les utilitaires meals
const { getMealTypeLabel } = useMealTypeLabel()
const { getPhasesLabel } = useMealPhaseLabel()

const props = defineProps<{
  editionId: number
}>()

// État
const meals = ref<any[]>([])
const initialMeals = ref<any[]>([])
const loadingMeals = ref(false)
const savingMeals = ref(false)

// Grouper les repas par date
const groupedMeals = computed(() => groupMealsByDate(meals.value))

// Formater la date pour l'affichage
const formatDate = (dateStr: string) => formatMealDate(dateStr)

// Détection des modifications non sauvegardées
const hasUnsavedChanges = computed(() => {
  if (meals.value.length !== initialMeals.value.length) return true

  return meals.value.some((meal, index) => {
    const initialMeal = initialMeals.value[index]
    return meal.accepted !== initialMeal?.accepted
  })
})

// Charger les repas
const fetchMeals = async () => {
  loadingMeals.value = true
  try {
    const response = await $fetch(`/api/editions/${props.editionId}/volunteers/my-meals`)
    if (response.success && response.meals) {
      meals.value = response.meals
      // Sauvegarder l'état initial pour la détection de changements
      initialMeals.value = JSON.parse(JSON.stringify(response.meals))
    }
  } catch (error: any) {
    console.error('Failed to fetch meals:', error)
    toast.add({
      title: 'Erreur',
      description: error?.data?.message || 'Impossible de charger vos repas',
      color: 'error',
    })
  } finally {
    loadingMeals.value = false
  }
}

// Sauvegarder les sélections
const saveMealSelections = async () => {
  savingMeals.value = true
  try {
    const selections = meals.value.map((meal) => ({
      selectionId: meal.selectionId,
      accepted: meal.accepted,
    }))

    const response = await $fetch(`/api/editions/${props.editionId}/volunteers/my-meals`, {
      method: 'PUT',
      body: { selections },
    })

    if (response.success && response.meals) {
      meals.value = response.meals
      // Mettre à jour l'état initial après sauvegarde
      initialMeals.value = JSON.parse(JSON.stringify(response.meals))

      toast.add({
        title: 'Sauvegardé',
        description: 'Vos préférences de repas ont été enregistrées',
        color: 'success',
        icon: 'i-heroicons-check-circle',
      })
    }
  } catch (error: any) {
    console.error('Failed to save meal selections:', error)
    toast.add({
      title: 'Erreur',
      description: error?.data?.message || 'Impossible de sauvegarder vos repas',
      color: 'error',
    })
  } finally {
    savingMeals.value = false
  }
}

onMounted(() => {
  fetchMeals()
})
</script>
