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
                        <UCheckbox
                          v-model="meal.enabled"
                          :disabled="savingMeals"
                          @update:model-value="handleMealChange(meal)"
                        />
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-medium text-gray-900 dark:text-white">
                            {{ getMealTypeLabel(meal.mealType) }}
                          </p>
                          <USelectMenu
                            v-model="meal.phases"
                            :items="mealPhaseOptions"
                            value-key="value"
                            multiple
                            :disabled="savingMeals"
                            :search-input="false"
                            size="xs"
                            class="mt-1 w-full"
                            @update:model-value="handleMealChange(meal)"
                          />
                        </div>
                      </div>

                      <!-- Sélection des articles à restituer -->
                      <div
                        v-if="returnableItems.length > 0"
                        class="border-t border-gray-200 dark:border-gray-700 pt-3"
                      >
                        <div class="flex items-center justify-between mb-1.5">
                          <label class="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {{ $t('gestion.meals.returnable_items_label') }}
                          </label>
                          <span class="text-xs text-gray-500 dark:text-gray-400">
                            {{
                              $t('gestion.meals.selected_count', {
                                count: getSelectedReturnableItemIds(meal).length,
                              })
                            }}
                          </span>
                        </div>

                        <!-- Liste des articles sélectionnés -->
                        <div
                          v-if="getSelectedReturnableItemIds(meal).length > 0"
                          class="mb-2 flex flex-wrap gap-1"
                        >
                          <span
                            v-for="itemId in getSelectedReturnableItemIds(meal)"
                            :key="itemId"
                            class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                          >
                            {{ returnableItems.find((item) => item.id === itemId)?.name }}
                          </span>
                        </div>

                        <USelectMenu
                          :model-value="getSelectedReturnableItems(meal)"
                          :items="returnableItemsForSelect"
                          multiple
                          :placeholder="$t('gestion.meals.select_returnable_items')"
                          :disabled="savingMeals || loadingReturnableItems"
                          :search-input="{ placeholder: $t('common.search') }"
                          size="xs"
                          class="w-full"
                          @update:model-value="(items) => handleReturnableItemsChange(meal, items)"
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

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

definePageMeta({
  layout: 'edition-dashboard',
})

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// Gestion des repas
const volunteerMeals = ref<any[]>([])
const loadingMeals = ref(false)
const savingMeals = ref(false)

// Gestion des articles à restituer
const returnableItems = ref<any[]>([])
const loadingReturnableItems = ref(false)

// Préparer les items pour SelectMenu
const returnableItemsForSelect = computed(() => {
  return returnableItems.value.map((item) => ({
    label: item.name,
    value: item.id,
  }))
})

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
    if (response.success && response.meals) {
      volunteerMeals.value = response.meals
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

// Charger les articles à restituer
const fetchReturnableItems = async () => {
  if (!editionId) return

  loadingReturnableItems.value = true
  try {
    const response = await $fetch(`/api/editions/${editionId}/ticketing/returnable-items`)
    if (response.success && response.returnableItems) {
      returnableItems.value = response.returnableItems
    }
  } catch (error) {
    console.error('Failed to fetch returnable items:', error)
    toast.add({
      title: 'Erreur',
      description: 'Impossible de charger les articles à restituer',
      color: 'error',
    })
  } finally {
    loadingReturnableItems.value = false
  }
}

// Gérer le changement d'un repas (enabled, phase ou articles)
const handleMealChange = async (meal: any) => {
  savingMeals.value = true
  try {
    // Extraire les IDs des articles sélectionnés
    const returnableItemIds = meal.returnableItems?.map((item: any) => item.returnableItemId) || []

    const response = await $fetch(`/api/editions/${editionId}/volunteers/meals`, {
      method: 'PUT',
      body: {
        meals: [
          {
            id: meal.id,
            enabled: meal.enabled,
            phases: meal.phases,
            returnableItemIds,
          },
        ],
      },
    })

    if (response.success && response.meals) {
      volunteerMeals.value = response.meals
      toast.add({
        title: 'Sauvegardé',
        description: 'Le repas a été synchronisé avec les bénévoles et artistes',
        color: 'success',
        icon: 'i-heroicons-check-circle',
      })
    }
  } catch (error) {
    console.error('Failed to update volunteer meal:', error)
    toast.add({
      title: 'Erreur',
      description: 'Impossible de sauvegarder le repas',
      color: 'error',
    })
    // Recharger les repas pour revenir à l'état précédent
    await fetchVolunteerMeals()
  } finally {
    savingMeals.value = false
  }
}

// Obtenir les IDs des articles sélectionnés pour un repas
const getSelectedReturnableItemIds = (meal: any) => {
  return meal.returnableItems?.map((item: any) => item.returnableItemId) || []
}

// Obtenir les objets complets des articles sélectionnés pour SelectMenu
const getSelectedReturnableItems = (meal: any) => {
  const selectedIds = getSelectedReturnableItemIds(meal)
  return returnableItemsForSelect.value.filter((item) => selectedIds.includes(item.value))
}

// Gérer le changement de sélection des articles pour un repas
const handleReturnableItemsChange = async (meal: any, selectedItems: any[]) => {
  // Mettre à jour temporairement l'état local avec les IDs
  meal.returnableItems = selectedItems.map((item) => ({
    returnableItemId: item.value,
  }))

  await handleMealChange(meal)
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
  await Promise.all([fetchVolunteerMeals(), fetchReturnableItems()])
})

// Métadonnées de la page
useSeoMeta({
  title: 'Configuration des repas - ' + (edition.value?.name || 'Édition'),
  description: 'Configurer les repas pour les bénévoles et artistes',
  ogTitle: () => edition.value?.name || edition.value?.convention?.name || 'Convention',
})
</script>
