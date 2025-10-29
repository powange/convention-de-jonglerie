<template>
  <div v-if="mealsByDay.length > 0" class="space-y-4">
    <div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
      <UIcon name="i-heroicons-cake" class="text-orange-600 dark:text-orange-400" />
      <h4 class="font-semibold text-gray-900 dark:text-white">Repas</h4>
    </div>

    <div class="space-y-4">
      <div v-for="dayGroup in mealsByDay" :key="dayGroup.date" class="space-y-2">
        <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
          {{
            new Date(dayGroup.date).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })
          }}
        </h5>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div
            v-for="meal in dayGroup.meals"
            :key="meal.id"
            class="p-3 rounded-lg bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/10 border border-orange-200 dark:border-orange-800/30"
          >
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <UIcon
                  :name="
                    meal.mealType === 'BREAKFAST'
                      ? 'i-heroicons-sun'
                      : meal.mealType === 'LUNCH'
                        ? 'i-heroicons-sun-solid'
                        : 'i-heroicons-moon'
                  "
                  class="h-4 w-4 text-orange-600 dark:text-orange-400"
                />
                <span class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ getMealTypeLabel(meal.mealType) }}
                </span>
              </div>
              <UBadge
                :color="meal.phases && meal.phases.includes('EVENT') ? 'primary' : 'neutral'"
                variant="subtle"
                size="xs"
              >
                {{ getPhasesLabel(meal.phases) }}
              </UBadge>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Meal {
  id: number
  date: Date | string
  mealType: string
  phases?: string[]
}

const props = defineProps<{
  meals?: Meal[]
}>()

// Utiliser les utilitaires meals (import explicite)
const { getMealTypeLabel } = useMealTypeLabel()
const { getPhasesLabel } = useMealPhaseLabel()

// Grouper les repas par jour
const mealsByDay = computed(() => {
  if (!props.meals) {
    return []
  }

  const grouped: Record<string, Meal[]> = {}
  props.meals.forEach((meal) => {
    const dateKey = new Date(meal.date).toISOString().split('T')[0]
    if (!dateKey) return

    if (!grouped[dateKey]) {
      grouped[dateKey] = []
    }
    const dayMeals = grouped[dateKey]
    if (dayMeals) {
      dayMeals.push(meal)
    }
  })

  // Trier les repas de chaque jour par type (BREAKFAST, LUNCH, DINNER)
  const mealOrder: Record<string, number> = { BREAKFAST: 1, LUNCH: 2, DINNER: 3 }
  Object.keys(grouped).forEach((dateKey) => {
    const dayMeals = grouped[dateKey]
    if (dayMeals) {
      dayMeals.sort((a, b) => (mealOrder[a.mealType] || 999) - (mealOrder[b.mealType] || 999))
    }
  })

  // Convertir en tableau et trier par date
  return Object.entries(grouped)
    .map(([date, meals]) => ({ date, meals }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
})
</script>
