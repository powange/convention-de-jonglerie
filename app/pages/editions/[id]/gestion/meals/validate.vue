<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('editions.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('editions.not_found') }}</p>
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
      <EditionHeader :edition="edition" current-page="gestion" />

      <!-- Contenu de la page -->
      <div class="space-y-6">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-check-badge" class="text-green-500" />
                <h2 class="text-lg font-semibold">{{ $t('gestion.meals.validation_title') }}</h2>
              </div>
              <UButton
                icon="i-heroicons-arrow-left"
                color="neutral"
                variant="soft"
                :to="`/editions/${edition.id}/gestion`"
              >
                {{ $t('common.back') }}
              </UButton>
            </div>
          </template>

          <!-- Étape 1: Sélection du repas -->
          <div class="mb-6">
            <label class="block text-sm font-medium mb-2">
              {{ $t('gestion.meals.select_meal') }}
            </label>
            <USelectMenu
              v-model="selectedMeal"
              :items="mealsOptions"
              :loading="loadingMeals"
              :placeholder="$t('gestion.meals.select_meal_placeholder')"
              size="lg"
              :popper="{ placement: 'bottom-start' }"
              :ui="{ width: 'w-full', height: 'max-h-96', content: 'min-w-fit' }"
            >
              <template #label>
                <span v-if="selectedMeal">
                  {{ formatMealLabel(selectedMeal) }}
                </span>
              </template>
            </USelectMenu>
          </div>

          <!-- Étape 2: Recherche de personne (si un repas est sélectionné) -->
          <div v-if="selectedMeal" class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2">
                {{ $t('gestion.meals.search_person') }}
              </label>
              <UInput
                v-model="searchQuery"
                icon="i-heroicons-magnifying-glass"
                :placeholder="$t('gestion.meals.search_person_placeholder')"
                size="lg"
                class="w-full"
              />
            </div>

            <!-- Résultats de recherche -->
            <div v-if="searching" class="flex items-center justify-center py-8">
              <UIcon name="i-heroicons-arrow-path" class="animate-spin h-6 w-6 text-primary-500" />
            </div>

            <div
              v-else-if="searchQuery && searchResults.length === 0"
              class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <UIcon
                name="i-heroicons-magnifying-glass"
                class="mx-auto h-8 w-8 text-gray-400 mb-2"
              />
              <p class="text-gray-500 dark:text-gray-400">
                {{ $t('gestion.meals.no_results') }}
              </p>
            </div>

            <div v-else-if="searchResults.length > 0" class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {{ $t('gestion.meals.person_type') }}
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {{ $t('common.name') }}
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {{ $t('common.firstname') }}
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {{ $t('common.pseudo') }}
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {{ $t('common.email') }}
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {{ $t('common.phone') }}
                    </th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {{ $t('gestion.meals.meal_status') }}
                    </th>
                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      {{ $t('common.actions') }}
                    </th>
                  </tr>
                </thead>
                <tbody
                  class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700"
                >
                  <tr v-for="person in searchResults" :key="person.uniqueId">
                    <td class="px-4 py-3 text-sm">
                      <UBadge :color="getPersonTypeBadgeColor(person.type)" variant="soft">
                        {{ $t(`gestion.meals.person_type_${person.type}`) }}
                      </UBadge>
                    </td>
                    <td class="px-4 py-3 text-sm">{{ person.lastName || '-' }}</td>
                    <td class="px-4 py-3 text-sm">{{ person.firstName || '-' }}</td>
                    <td class="px-4 py-3 text-sm">{{ person.pseudo || '-' }}</td>
                    <td class="px-4 py-3 text-sm">{{ person.email || '-' }}</td>
                    <td class="px-4 py-3 text-sm">{{ person.phone || '-' }}</td>
                    <td class="px-4 py-3 text-sm">
                      <UBadge
                        v-if="person.consumedAt"
                        color="success"
                        variant="soft"
                        class="flex items-center gap-1 w-fit"
                      >
                        <UIcon name="i-heroicons-check-circle" class="h-4 w-4" />
                        {{ $t('gestion.meals.consumed_at') }}
                        {{ formatDateTime(person.consumedAt) }}
                      </UBadge>
                      <UBadge v-else color="neutral" variant="soft">
                        {{ $t('gestion.meals.not_consumed') }}
                      </UBadge>
                    </td>
                    <td class="px-4 py-3 text-sm text-center">
                      <UButton
                        v-if="!person.consumedAt"
                        size="xs"
                        color="success"
                        icon="i-heroicons-check"
                        :loading="validatingIds.includes(person.uniqueId)"
                        @click="validateMeal(person)"
                      >
                        {{ $t('gestion.meals.validate') }}
                      </UButton>
                      <UButton
                        v-else
                        size="xs"
                        color="error"
                        variant="soft"
                        icon="i-heroicons-x-mark"
                        :loading="validatingIds.includes(person.uniqueId)"
                        @click="cancelMeal(person)"
                      >
                        {{ $t('gestion.meals.cancel') }}
                      </UButton>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useDebounce } from '~/composables/useDebounce'
import { useMealTypeLabel } from '~/composables/useMeals'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { formatMealDate } from '~/utils/meals'

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()
const { getMealTypeLabel } = useMealTypeLabel()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// État
const loadingMeals = ref(false)
const meals = ref<any[]>([])
const selectedMeal = ref<any>(null)
const searchQuery = ref('')
const searching = ref(false)
const searchResults = ref<any[]>([])
const validatingIds = ref<string[]>([])

// Debounce pour la recherche
const debouncedSearchQuery = useDebounce(searchQuery, 300)

// Options pour le select de repas
const mealsOptions = computed(() => {
  return meals.value.map((meal) => ({
    label: formatMealLabel(meal),
    value: meal.id,
    ...meal,
  }))
})

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false

  // Créateur de l'édition
  if (authStore.user.id === edition.value.creatorId) return true

  // Collaborateurs de la convention
  if (edition.value.convention?.collaborators) {
    return edition.value.convention.collaborators.some(
      (collab) => collab.user.id === authStore.user?.id
    )
  }

  return false
})

// Formater le label d'un repas
const formatMealLabel = (meal: any) => {
  const date = formatMealDate(meal.date)
  const mealTypeLabel = getMealTypeLabel(meal.mealType)
  return `${date} - ${mealTypeLabel}`
}

// Formater la date/heure
const formatDateTime = (dateTime: string) => {
  return new Date(dateTime).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Couleur du badge selon le type de personne
const getPersonTypeBadgeColor = (type: string) => {
  switch (type) {
    case 'volunteer':
      return 'primary'
    case 'artist':
      return 'warning'
    case 'participant':
      return 'secondary'
    default:
      return 'neutral'
  }
}

// Charger les repas
const fetchMeals = async () => {
  loadingMeals.value = true
  try {
    const data = await $fetch<{ success: boolean; meals: any[] }>(
      `/api/editions/${editionId}/meals`
    )
    meals.value = data.meals || []
  } catch (error) {
    console.error('Error fetching meals:', error)
    toast.add({
      title: t('gestion.meals.error_loading_meals'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    loadingMeals.value = false
  }
}

// Rechercher des personnes ayant accès au repas sélectionné
const searchPeople = async () => {
  if (!selectedMeal.value || !searchQuery.value || searchQuery.value.length < 2) {
    searchResults.value = []
    return
  }

  searching.value = true
  try {
    const data = await $fetch<{ results: any[] }>(
      `/api/editions/${editionId}/meals/${selectedMeal.value.id}/search`,
      {
        params: { q: searchQuery.value },
      }
    )
    searchResults.value = data.results || []
  } catch (error) {
    console.error('Error searching people:', error)
    toast.add({
      title: t('gestion.meals.error_searching'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
    searchResults.value = []
  } finally {
    searching.value = false
  }
}

// Valider un repas
const validateMeal = async (person: any) => {
  validatingIds.value.push(person.uniqueId)
  try {
    await $fetch(`/api/editions/${editionId}/meals/${selectedMeal.value.id}/validate`, {
      method: 'post',
      body: {
        type: person.type,
        id: person.id,
      },
    })

    toast.add({
      title: t('gestion.meals.meal_validated'),
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })

    // Rafraîchir la recherche pour mettre à jour le statut
    await searchPeople()
  } catch (error: any) {
    console.error('Error validating meal:', error)
    toast.add({
      title: error?.data?.message || t('gestion.meals.error_validating'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    validatingIds.value = validatingIds.value.filter((id) => id !== person.uniqueId)
  }
}

// Annuler un repas
const cancelMeal = async (person: any) => {
  validatingIds.value.push(person.uniqueId)
  try {
    await $fetch(`/api/editions/${editionId}/meals/${selectedMeal.value.id}/cancel`, {
      method: 'post',
      body: {
        type: person.type,
        id: person.id,
      },
    })

    toast.add({
      title: t('gestion.meals.meal_cancelled'),
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })

    // Rafraîchir la recherche pour mettre à jour le statut
    await searchPeople()
  } catch (error: any) {
    console.error('Error cancelling meal:', error)
    toast.add({
      title: error?.data?.message || t('gestion.meals.error_cancelling'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    validatingIds.value = validatingIds.value.filter((id) => id !== person.uniqueId)
  }
}

// Watchers
watch(debouncedSearchQuery, () => {
  searchPeople()
})

watch(selectedMeal, () => {
  // Réinitialiser la recherche quand on change de repas
  searchQuery.value = ''
  searchResults.value = []
})

// Lifecycle
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }

  await fetchMeals()
})
</script>
