<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('edition.not_found') }}</p>
    </div>
    <div v-else-if="!canAccess">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="$t('pages.access_denied.description')"
      />
    </div>
    <div v-else>
      <!-- En-tête avec navigation -->

      <!-- Titre de la page -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="cbi:mealie" class="text-orange-600 dark:text-orange-400" />
          {{ $t('gestion.meals.configuration_title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('gestion.meals.configuration_description') }}
        </p>
      </div>

      <!-- Contenu de la configuration des repas -->
      <div class="space-y-6">
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="cbi:mealie" class="text-orange-500" />
              <h2 class="text-lg font-semibold">{{ $t('gestion.meals.configuration_title') }}</h2>
            </div>

            <UAlert
              icon="i-heroicons-information-circle"
              color="info"
              variant="soft"
              :description="$t('gestion.meals.configuration_info')"
            />

            <!-- Repas bénévoles -->
            <div class="mt-6 space-y-4">
              <div v-if="loadingMeals" class="flex items-center justify-center py-8">
                <UIcon
                  name="i-heroicons-arrow-path"
                  class="animate-spin h-6 w-6 text-primary-500"
                />
              </div>

              <div
                v-else-if="volunteerMeals.length === 0"
                class="text-sm text-gray-500 italic p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center"
              >
                {{ $t('gestion.meals.no_meals_configured') }}
              </div>

              <div v-else class="space-y-6">
                <div v-for="(dayMeals, date) in groupedMeals" :key="date" class="space-y-3">
                  <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {{ formatDate(date) }}
                  </h5>
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div
                      v-for="meal in dayMeals"
                      :key="meal.id"
                      :class="[
                        'flex flex-col gap-3 p-3 border rounded-lg transition-opacity',
                        meal.enabled
                          ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                          : 'border-gray-200/50 dark:border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 opacity-60',
                      ]"
                    >
                      <div class="flex items-center gap-3">
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-medium text-gray-900 dark:text-white">
                            {{ getMealTypeLabel(meal.mealType) }}
                          </p>
                          <UCheckboxGroup
                            v-model="meal.phases"
                            :items="mealPhaseOptions"
                            value-key="value"
                            orientation="horizontal"
                            indicator="hidden"
                            variant="table"
                            size="xs"
                            color="secondary"
                            :disabled="savingMeals"
                            class="mt-1"
                            @update:model-value="handleMealChange(meal)"
                          />
                        </div>
                        <USwitch
                          v-model="meal.enabled"
                          :disabled="savingMeals"
                          class="shrink-0"
                          @update:model-value="handleMealChange(meal)"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Indicateur de sauvegarde -->
            <div v-if="savingMeals" class="flex gap-2 text-xs text-gray-500 items-center">
              <UIcon name="i-heroicons-arrow-path" class="animate-spin" />
              {{ $t('common.saving') || 'Enregistrement...' }}
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

// Layer meals : imports cœur via #imports (résolution cross-layer) plutôt que ~/ (qui pointe le layer).
import { useAuthStore, useEditionStore } from '#imports'

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// Gestion des repas
const volunteerMeals = ref<any[]>([])
const loadingMeals = ref(false)
const pendingMeal = ref<any>(null)

// Options pour le select de phase
const mealPhaseOptions = [
  { value: 'SETUP', label: 'Montage' },
  { value: 'EVENT', label: 'Édition' },
  { value: 'TEARDOWN', label: 'Démontage' },
]

// Grouper les repas par date
const groupedMeals = computed(() => {
  const grouped: Record<string, any[]> = {}
  volunteerMeals.value.forEach((meal) => {
    const dateKey = meal.date.split('T')[0]
    if (!grouped[dateKey]) {
      grouped[dateKey] = []
    }
    grouped[dateKey].push(meal)
  })
  return grouped
})

// Formater la date pour l'affichage
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Utiliser les utilitaires meals
const { getMealTypeLabel } = useMealTypeLabel()

// Charger les repas
const fetchVolunteerMeals = async () => {
  if (!editionId) return

  loadingMeals.value = true
  try {
    const response = await $fetch(`/api/editions/${editionId}/volunteers/meals`)
    if (response.data?.meals) {
      volunteerMeals.value = response.data.meals
    }
  } catch (error) {
    console.error('Failed to fetch volunteer meals:', error)
    toast.add({
      title: 'Erreur',
      description: 'Impossible de charger les repas',
      color: 'error',
    })
  } finally {
    loadingMeals.value = false
  }
}

// Gérer le changement d'un repas (enabled ou phases)
const { execute: executeSaveMeal, loading: savingMeals } = useApiAction<
  unknown,
  { success: boolean; meals: any[] }
>(() => `/api/editions/${editionId}/volunteers/meals`, {
  method: 'PUT',
  body: () => {
    const meal = pendingMeal.value
    return {
      meals: [
        {
          id: meal?.id,
          enabled: meal?.enabled,
          phases: meal?.phases,
        },
      ],
    }
  },
  successMessage: {
    title: 'Sauvegardé',
    description: 'Le repas a été synchronisé avec les bénévoles et artistes',
  },
  errorMessages: { default: 'Impossible de sauvegarder le repas' },
  onSuccess: (result) => {
    if (result?.success && result.meals) {
      volunteerMeals.value = result.meals
    }
  },
  onError: () => {
    fetchVolunteerMeals()
  },
})

const handleMealChange = async (meal: any) => {
  pendingMeal.value = meal
  await executeSaveMeal()
}

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return (
    canEdit.value || canManageVolunteers.value || authStore.user?.id === edition.value?.creatorId
  )
})

// Permissions calculées
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const canManageVolunteers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageVolunteers(edition.value, authStore.user.id)
})

// Charger l'édition, les repas et les articles
onMounted(async () => {
  // Charger l'édition si nécessaire
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }

  // Charger les repas et les articles en parallèle
  await fetchVolunteerMeals()
})

// Métadonnées de la page
useSeoMeta({
  title: 'Configuration des repas - ' + (edition.value?.name || 'Édition'),
  description: 'Configurer les repas pour les bénévoles et artistes',
  ogTitle: () => edition.value?.name || edition.value?.convention?.name || 'Convention',
})
</script>
