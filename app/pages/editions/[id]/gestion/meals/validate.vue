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
          <div
            class="mb-6 bg-gray-50 dark:bg-gray-800/50 p-4 sm:p-6 rounded-lg border-2 border-gray-200 dark:border-gray-700"
          >
            <label
              class="block text-base sm:text-lg font-semibold mb-3 text-gray-900 dark:text-white"
            >
              {{ $t('gestion.meals.select_meal') }}
            </label>
            <USelectMenu
              v-model="selectedMealId"
              :items="mealsOptions"
              :loading="loadingMeals"
              :placeholder="$t('gestion.meals.select_meal_placeholder')"
              size="xl"
              value-key="id"
              :popper="{ placement: 'bottom-start' }"
              :ui="{
                width: 'w-full',
                height: 'max-h-96',
                content: 'min-w-fit',
                base: 'text-base sm:text-lg',
              }"
            >
              <template #label>
                <span v-if="selectedMeal" class="text-base sm:text-lg font-medium">
                  {{ formatMealLabel(selectedMeal) }}
                </span>
              </template>
            </USelectMenu>
          </div>

          <!-- Statistiques du repas sélectionné -->
          <div v-if="selectedMeal && mealStats" class="mb-6">
            <div
              class="bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-primary-200 dark:border-primary-800"
            >
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <UIcon
                    name="i-heroicons-chart-bar"
                    class="text-primary-600 dark:text-primary-400 h-5 w-5"
                  />
                  <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                    {{ $t('gestion.meals.progress') }}
                  </h3>
                </div>
                <div class="text-right">
                  <div class="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {{ mealStats.validated }} / {{ mealStats.total }}
                  </div>
                  <div class="text-xs text-gray-600 dark:text-gray-400">
                    {{ mealStats.percentage }}% {{ $t('gestion.meals.validated_lowercase') }}
                  </div>
                </div>
              </div>

              <!-- Barre de progression -->
              <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  class="h-full bg-gradient-to-r from-primary-500 to-blue-500 transition-all duration-500 ease-out rounded-full flex items-center justify-end pr-2"
                  :style="{ width: `${mealStats.percentage}%` }"
                >
                  <span v-if="mealStats.percentage > 15" class="text-white text-xs font-semibold">
                    {{ mealStats.percentage }}%
                  </span>
                </div>
              </div>

              <!-- Détails par catégorie -->
              <div class="grid grid-cols-3 gap-4 mt-4">
                <button
                  class="text-center p-2 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors cursor-pointer group"
                  :disabled="
                    mealStats.breakdown.volunteers.total ===
                    mealStats.breakdown.volunteers.validated
                  "
                  @click="openPendingModal('volunteer')"
                >
                  <div
                    class="text-xs text-gray-600 dark:text-gray-400 mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400"
                  >
                    {{ $t('gestion.meals.volunteers') }}
                  </div>
                  <div
                    class="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400"
                  >
                    {{ mealStats.breakdown.volunteers.validated }} /
                    {{ mealStats.breakdown.volunteers.total }}
                  </div>
                  <div
                    v-if="
                      mealStats.breakdown.volunteers.total >
                      mealStats.breakdown.volunteers.validated
                    "
                    class="text-xs text-primary-600 dark:text-primary-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {{
                      mealStats.breakdown.volunteers.total -
                      mealStats.breakdown.volunteers.validated
                    }}
                    restant{{
                      mealStats.breakdown.volunteers.total -
                        mealStats.breakdown.volunteers.validated >
                      1
                        ? 's'
                        : ''
                    }}
                  </div>
                </button>
                <button
                  class="text-center p-2 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors cursor-pointer border-x border-primary-200 dark:border-primary-800 group"
                  :disabled="
                    mealStats.breakdown.artists.total === mealStats.breakdown.artists.validated
                  "
                  @click="openPendingModal('artist')"
                >
                  <div
                    class="text-xs text-gray-600 dark:text-gray-400 mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400"
                  >
                    {{ $t('gestion.meals.artists') }}
                  </div>
                  <div
                    class="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400"
                  >
                    {{ mealStats.breakdown.artists.validated }} /
                    {{ mealStats.breakdown.artists.total }}
                  </div>
                  <div
                    v-if="mealStats.breakdown.artists.total > mealStats.breakdown.artists.validated"
                    class="text-xs text-primary-600 dark:text-primary-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {{ mealStats.breakdown.artists.total - mealStats.breakdown.artists.validated }}
                    restant{{
                      mealStats.breakdown.artists.total - mealStats.breakdown.artists.validated > 1
                        ? 's'
                        : ''
                    }}
                  </div>
                </button>
                <button
                  class="text-center p-2 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors cursor-pointer group"
                  :disabled="
                    mealStats.breakdown.participants.total ===
                    mealStats.breakdown.participants.validated
                  "
                  @click="openPendingModal('participant')"
                >
                  <div
                    class="text-xs text-gray-600 dark:text-gray-400 mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400"
                  >
                    {{ $t('gestion.meals.participants') }}
                  </div>
                  <div
                    class="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400"
                  >
                    {{ mealStats.breakdown.participants.validated }} /
                    {{ mealStats.breakdown.participants.total }}
                  </div>
                  <div
                    v-if="
                      mealStats.breakdown.participants.total >
                      mealStats.breakdown.participants.validated
                    "
                    class="text-xs text-primary-600 dark:text-primary-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {{
                      mealStats.breakdown.participants.total -
                      mealStats.breakdown.participants.validated
                    }}
                    restant{{
                      mealStats.breakdown.participants.total -
                        mealStats.breakdown.participants.validated >
                      1
                        ? 's'
                        : ''
                    }}
                  </div>
                </button>
              </div>
            </div>
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

            <!-- Affichage en cartes (mobile-friendly) -->
            <div v-else-if="searchResults.length > 0" class="space-y-3">
              <div
                v-for="person in searchResults"
                :key="person.uniqueId"
                class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
              >
                <div class="flex items-start justify-between gap-3 mb-3">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-2">
                      <UBadge :color="getPersonTypeBadgeColor(person.type)" variant="soft">
                        {{ $t(`gestion.meals.person_type_${person.type}`) }}
                      </UBadge>
                      <UBadge
                        v-if="person.consumedAt"
                        color="success"
                        variant="soft"
                        class="flex items-center gap-1"
                      >
                        <UIcon name="i-heroicons-check-circle" class="h-4 w-4" />
                        {{ $t('gestion.meals.consumed') }}
                      </UBadge>
                    </div>
                    <h3 class="font-semibold text-gray-900 dark:text-white text-lg">
                      {{ person.lastName }} {{ person.firstName }}
                    </h3>
                    <p v-if="person.pseudo" class="text-sm text-gray-600 dark:text-gray-400">
                      @{{ person.pseudo }}
                    </p>
                  </div>
                  <UButton
                    v-if="!person.consumedAt"
                    color="success"
                    icon="i-heroicons-check"
                    :loading="validatingIds.includes(person.uniqueId)"
                    @click="validateMeal(person)"
                  >
                    {{ $t('gestion.meals.validate') }}
                  </UButton>
                  <UButton
                    v-else
                    color="error"
                    variant="soft"
                    icon="i-heroicons-x-mark"
                    :loading="validatingIds.includes(person.uniqueId)"
                    @click="cancelMeal(person)"
                  >
                    {{ $t('gestion.meals.cancel') }}
                  </UButton>
                </div>

                <!-- Informations détaillées -->
                <div
                  class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mt-3 pt-3 border-t border-gray-200 dark:border-gray-700"
                >
                  <div>
                    <span class="text-gray-500 dark:text-gray-400">{{ $t('common.email') }}:</span>
                    <span class="ml-2 text-gray-900 dark:text-white">{{
                      person.email || '-'
                    }}</span>
                  </div>
                  <div v-if="person.phone">
                    <span class="text-gray-500 dark:text-gray-400">{{ $t('common.phone') }}:</span>
                    <span class="ml-2 text-gray-900 dark:text-white">{{ person.phone }}</span>
                  </div>
                  <div v-if="person.consumedAt" class="sm:col-span-2">
                    <span class="text-gray-500 dark:text-gray-400"
                      >{{ $t('gestion.meals.consumed_at') }}:</span
                    >
                    <span class="ml-2 text-success-600 dark:text-success-400 font-medium">
                      {{ formatDateTime(person.consumedAt) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Modal des personnes non validées -->
      <UModal v-model:open="pendingModalOpen" :ui="{ content: 'sm:max-w-4xl' }">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-users" class="text-primary-500" />
            <span>
              {{ $t('gestion.meals.pending_validations') }}
              <span v-if="pendingType === 'volunteer'">- {{ $t('gestion.meals.volunteers') }}</span>
              <span v-else-if="pendingType === 'artist'">- {{ $t('gestion.meals.artists') }}</span>
              <span v-else-if="pendingType === 'participant'"
                >- {{ $t('gestion.meals.participants') }}</span
              >
            </span>
          </div>
        </template>

        <template #body>
          <div v-if="loadingPending" class="flex items-center justify-center py-8">
            <UIcon name="i-heroicons-arrow-path" class="animate-spin h-6 w-6 text-primary-500" />
          </div>

          <div v-else-if="pendingList.length === 0" class="text-center py-8 text-gray-500">
            {{ $t('gestion.meals.all_validated') }}
          </div>

          <!-- Affichage en cartes (mobile-friendly) -->
          <div v-else class="space-y-3">
            <div
              v-for="person in pendingList"
              :key="person.uniqueId"
              class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <h3 class="font-semibold text-gray-900 dark:text-white text-lg mb-1">
                    {{ person.lastName }} {{ person.firstName }}
                  </h3>
                  <p
                    v-if="person.pseudo && pendingType !== 'participant'"
                    class="text-sm text-gray-600 dark:text-gray-400"
                  >
                    @{{ person.pseudo }}
                  </p>
                  <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {{ person.email || '-' }}
                  </p>
                </div>
                <UButton
                  color="success"
                  icon="i-heroicons-check"
                  :loading="validatingIds.includes(person.uniqueId)"
                  @click="validateMealFromModal(person)"
                >
                  {{ $t('gestion.meals.validate') }}
                </UButton>
              </div>
            </div>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end">
            <UButton color="neutral" variant="soft" @click="pendingModalOpen = false">
              {{ $t('common.close') }}
            </UButton>
          </div>
        </template>
      </UModal>
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
const selectedMealId = ref<number | null>(null) // Stocker l'ID au lieu de l'objet
const searchQuery = ref('')
const searching = ref(false)
const searchResults = ref<any[]>([])
const validatingIds = ref<string[]>([])
const mealStats = ref<any>(null)
const loadingStats = ref(false)
const pendingModalOpen = ref(false)
const pendingType = ref<'volunteer' | 'artist' | 'participant'>('volunteer')
const pendingList = ref<any[]>([])
const loadingPending = ref(false)

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

// Computed pour récupérer l'objet meal complet à partir de l'ID
const selectedMeal = computed(() => {
  if (!selectedMealId.value) return null
  return meals.value.find((meal) => meal.id === selectedMealId.value) || null
})

// État pour les permissions de validation des repas
const canAccessMealValidation = ref(false)

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false

  // Super Admin en mode admin
  if (authStore.isAdminModeActive) return true

  // Créateur de l'édition
  if (authStore.user.id === edition.value.creatorId) return true

  // Organisateurs de la convention
  if (edition.value.convention?.organizers) {
    const isOrganizer = edition.value.convention.organizers.some(
      (collab) => collab.user.id === authStore.user?.id
    )
    if (isOrganizer) return true
  }

  // Bénévoles avec accès à la validation des repas (leader ou créneau actif)
  if (canAccessMealValidation.value) return true

  return false
})

// Vérifier les permissions de validation des repas au montage
watch(
  () => authStore.isAuthenticated,
  async (isAuthenticated) => {
    if (isAuthenticated && authStore.user?.id && edition.value?.id) {
      try {
        const response = await $fetch<{ canAccess: boolean }>(
          `/api/editions/${edition.value.id}/permissions/can-access-meal-validation`
        )
        canAccessMealValidation.value = response.canAccess
      } catch {
        canAccessMealValidation.value = false
      }
    } else {
      canAccessMealValidation.value = false
    }
  },
  { immediate: true }
)

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

    // Sélectionner automatiquement le repas en cours ou à venir
    if (meals.value.length > 0 && !selectedMealId.value) {
      const now = new Date()

      // Chercher le repas en cours ou le prochain repas à venir
      const currentOrUpcomingMeal = meals.value.find((meal) => {
        const mealDate = new Date(meal.date)
        // Considérer un repas comme "en cours" s'il est dans les 3 heures avant ou après l'heure actuelle
        const threeHoursBefore = new Date(mealDate.getTime() - 3 * 60 * 60 * 1000)
        const threeHoursAfter = new Date(mealDate.getTime() + 3 * 60 * 60 * 1000)
        return now >= threeHoursBefore && now <= threeHoursAfter
      })

      if (currentOrUpcomingMeal) {
        // Repas en cours trouvé
        selectedMealId.value = currentOrUpcomingMeal.id
      } else {
        // Sinon, chercher le prochain repas à venir
        const upcomingMeals = meals.value.filter((meal) => new Date(meal.date) > now)
        if (upcomingMeals.length > 0) {
          // Trier par date croissante et prendre le premier
          upcomingMeals.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          selectedMealId.value = upcomingMeals[0].id
        } else {
          // Sinon, prendre le dernier repas (le plus récent)
          const sortedMeals = [...meals.value].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          )
          selectedMealId.value = sortedMeals[0].id
        }
      }
    }
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

// Charger les statistiques du repas sélectionné
const fetchMealStats = async () => {
  if (!selectedMeal.value) {
    mealStats.value = null
    return
  }

  loadingStats.value = true
  try {
    const data = await $fetch<{ success: boolean; stats: any }>(
      `/api/editions/${editionId}/meals/${selectedMeal.value.id}/stats`
    )
    mealStats.value = data.stats || null
  } catch (error) {
    console.error('Error fetching meal stats:', error)
    mealStats.value = null
  } finally {
    loadingStats.value = false
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

    // Rafraîchir la recherche et les stats pour mettre à jour le statut
    await Promise.all([searchPeople(), fetchMealStats()])
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

// Ouvrir la modal des personnes non validées
const openPendingModal = async (type: 'volunteer' | 'artist' | 'participant') => {
  pendingType.value = type
  pendingModalOpen.value = true
  await fetchPendingList(type)
}

// Récupérer la liste des personnes non validées
const fetchPendingList = async (type: 'volunteer' | 'artist' | 'participant') => {
  if (!selectedMeal.value) return

  loadingPending.value = true
  try {
    const data = await $fetch<{ success: boolean; pending: any[] }>(
      `/api/editions/${editionId}/meals/${selectedMeal.value.id}/pending`,
      {
        params: { type },
      }
    )
    // Trier par nom de famille, puis prénom
    const pending = data.pending || []
    pendingList.value = pending.sort((a, b) => {
      const lastNameCompare = (a.lastName || '').localeCompare(b.lastName || '', 'fr')
      if (lastNameCompare !== 0) return lastNameCompare
      return (a.firstName || '').localeCompare(b.firstName || '', 'fr')
    })
  } catch (error) {
    console.error('Error fetching pending list:', error)
    toast.add({
      title: t('gestion.meals.error_loading_pending'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
    pendingList.value = []
  } finally {
    loadingPending.value = false
  }
}

// Valider un repas depuis la modal
const validateMealFromModal = async (person: any) => {
  await validateMeal(person)
  // Rafraîchir la liste des personnes non validées
  await fetchPendingList(pendingType.value)
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

    // Rafraîchir la recherche et les stats pour mettre à jour le statut
    await Promise.all([searchPeople(), fetchMealStats()])
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
  // Charger les statistiques du nouveau repas
  fetchMealStats()
})

// Recharger la liste des personnes non validées à chaque ouverture de la modal
watch(pendingModalOpen, (isOpen) => {
  if (isOpen && selectedMeal.value) {
    fetchPendingList(pendingType.value)
  }
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
