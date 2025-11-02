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
      <EditionHeader :edition="edition" current-page="gestion" />

      <!-- Contenu de la page -->
      <div class="space-y-6">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-cake" class="text-orange-500" />
                <h2 class="text-lg font-semibold">{{ $t('edition.meals.list_title') }}</h2>
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

          <!-- Filtres -->
          <div class="mb-6 space-y-4">
            <!-- Recherche par nom/prénom/email -->
            <UInput
              v-model="searchQuery"
              icon="i-heroicons-magnifying-glass"
              :placeholder="$t('edition.meals.search_placeholder')"
              @input="debouncedSearch"
            />

            <!-- Autres filtres -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <!-- Filtre par phase -->
              <USelect
                v-model="selectedPhase"
                :items="phaseOptions"
                value-key="value"
                :placeholder="$t('edition.meals.filter_phase')"
              />

              <!-- Filtre par type de participant -->
              <USelect
                v-model="selectedType"
                :items="typeOptions"
                value-key="value"
                :placeholder="$t('edition.meals.filter_type')"
              />

              <!-- Filtre par type de repas -->
              <USelect
                v-model="selectedMealType"
                :items="mealTypeOptions"
                value-key="value"
                :placeholder="$t('edition.meals.filter_meal_type')"
              />

              <!-- Filtre par date -->
              <USelect
                v-model="selectedDate"
                :items="dateOptions"
                value-key="value"
                :placeholder="$t('edition.meals.filter_date')"
              />
            </div>
          </div>

          <!-- Statistiques -->
          <div v-if="stats" class="mb-6 space-y-4">
            <!-- Statistiques principales -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <UCard>
                <div class="text-center">
                  <div class="text-2xl font-bold text-primary-500">{{ stats.total }}</div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('edition.meals.stats.total') }}
                  </div>
                </div>
              </UCard>
              <UCard v-if="stats.ticketingParticipants > 0">
                <div class="text-center">
                  <div class="text-2xl font-bold text-green-500">
                    {{ stats.ticketingParticipants }}
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('edition.meals.stats.participants') }}
                  </div>
                </div>
              </UCard>
              <UCard v-if="stats.volunteers > 0">
                <div class="text-center">
                  <div class="text-2xl font-bold text-blue-500">{{ stats.volunteers }}</div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('edition.meals.stats.volunteers') }}
                  </div>
                </div>
              </UCard>
              <UCard v-if="stats.artists > 0">
                <div class="text-center">
                  <div class="text-2xl font-bold text-purple-500">{{ stats.artists }}</div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('edition.meals.stats.artists') }}
                  </div>
                </div>
              </UCard>
            </div>

            <!-- Statistiques détaillées -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <!-- Par type de repas -->
              <UCard v-if="stats.byMealType">
                <template #header>
                  <div class="text-sm font-medium">
                    {{ $t('edition.meals.stats.by_meal_type') }}
                  </div>
                </template>
                <div class="space-y-2 text-sm">
                  <div v-if="stats.byMealType.BREAKFAST > 0" class="flex justify-between">
                    <span>{{ $t('common.breakfast') }}</span>
                    <span class="font-medium">{{ stats.byMealType.BREAKFAST }}</span>
                  </div>
                  <div v-if="stats.byMealType.LUNCH > 0" class="flex justify-between">
                    <span>{{ $t('common.lunch') }}</span>
                    <span class="font-medium">{{ stats.byMealType.LUNCH }}</span>
                  </div>
                  <div v-if="stats.byMealType.DINNER > 0" class="flex justify-between">
                    <span>{{ $t('common.dinner') }}</span>
                    <span class="font-medium">{{ stats.byMealType.DINNER }}</span>
                  </div>
                </div>
              </UCard>

              <!-- Par régime alimentaire -->
              <UCard v-if="stats.byDiet">
                <template #header>
                  <div class="text-sm font-medium">{{ $t('edition.meals.stats.by_diet') }}</div>
                </template>
                <div class="space-y-2 text-sm">
                  <div v-if="stats.byDiet.standard > 0" class="flex justify-between">
                    <span>{{ $t('edition.meals.stats.standard') }}</span>
                    <span class="font-medium">{{ stats.byDiet.standard }}</span>
                  </div>
                  <div v-if="stats.byDiet.VEGETARIAN > 0" class="flex justify-between">
                    <span>{{ $t('common.vegetarian') }}</span>
                    <span class="font-medium">{{ stats.byDiet.VEGETARIAN }}</span>
                  </div>
                  <div v-if="stats.byDiet.VEGAN > 0" class="flex justify-between">
                    <span>{{ $t('common.vegan') }}</span>
                    <span class="font-medium">{{ stats.byDiet.VEGAN }}</span>
                  </div>
                </div>
              </UCard>

              <!-- Allergies -->
              <UCard v-if="stats.withAllergies > 0">
                <div class="text-center">
                  <div class="text-2xl font-bold text-orange-500">{{ stats.withAllergies }}</div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('edition.meals.stats.with_allergies') }}
                  </div>
                </div>
              </UCard>

              <!-- Après spectacle -->
              <UCard v-if="stats.afterShow > 0">
                <div class="text-center">
                  <div class="text-2xl font-bold text-green-500">{{ stats.afterShow }}</div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('edition.meals.stats.after_show') }}
                  </div>
                </div>
              </UCard>
            </div>
          </div>

          <!-- Tableau -->
          <div v-if="loading" class="flex items-center justify-center py-8">
            <UIcon name="i-heroicons-arrow-path" class="animate-spin h-6 w-6 text-primary-500" />
          </div>

          <div v-else-if="formattedParticipants.length === 0" class="text-center py-8">
            <p class="text-gray-500 dark:text-gray-400">
              {{ $t('edition.meals.no_participants') }}
            </p>
          </div>

          <UTable v-else :data="formattedParticipants" :columns="columns" class="w-full" />

          <!-- Pagination -->
          <div v-if="pagination.totalPages > 1" class="flex justify-center mt-6">
            <UPagination
              :default-page="pagination.page"
              :total="pagination.total"
              :items-per-page="pagination.pageSize"
              @update:page="onPageChange"
            />
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const { t } = useI18n()

const editionId = computed(() => parseInt(route.params.id as string))

const edition = computed(() => editionStore.getEditionById(editionId.value))

const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false

  // Créateur de l'édition
  if (authStore.user.id === edition.value.creatorId) return true

  // Utilisateurs avec droits d'édition
  if (editionStore.canEditEdition(edition.value, authStore.user.id)) return true

  // Tous les collaborateurs de la convention
  if (edition.value.convention?.collaborators) {
    return edition.value.convention.collaborators.some(
      (collab) => collab.user.id === authStore.user?.id
    )
  }

  return false
})

// État
const loading = ref(false)
const participants = ref<any[]>([])
const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0,
})
const searchQuery = ref('')
const selectedPhase = ref<string | null>(null)
const selectedType = ref<string | null>(null)
const selectedMealType = ref<string | null>(null)
const selectedDate = ref<string | null>(null)
const availableDates = ref<string[]>([])

// Options de filtres
const phaseOptions = computed(() => [
  { value: null, label: t('edition.meals.all_phases') },
  { value: 'SETUP', label: t('common.setup') },
  { value: 'EVENT', label: t('common.event') },
  { value: 'TEARDOWN', label: t('common.teardown') },
])

const typeOptions = computed(() => [
  { value: null, label: t('edition.meals.all_types') },
  { value: 'participant', label: t('common.participant') },
  { value: 'volunteer', label: t('common.volunteer') },
  { value: 'artist', label: t('common.artist') },
])

const mealTypeOptions = computed(() => [
  { value: null, label: t('edition.meals.all_meal_types') },
  { value: 'BREAKFAST', label: t('common.breakfast') },
  { value: 'LUNCH', label: t('common.lunch') },
  { value: 'DINNER', label: t('common.dinner') },
])

const dateOptions = computed(() => [
  { value: null, label: t('edition.meals.all_dates') },
  ...availableDates.value.map((date) => ({
    value: date,
    label: new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
  })),
])

// Colonnes du tableau
const columns = [
  { accessorKey: 'nom', header: 'Nom' },
  { accessorKey: 'prenom', header: 'Prénom' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'type', header: 'Type' },
  { accessorKey: 'mealDate', header: 'Date' },
  { accessorKey: 'mealType', header: 'Type de repas' },
  { accessorKey: 'mealPhase', header: 'Phase' },
  { accessorKey: 'dietaryPreference', header: 'Régime' },
  { accessorKey: 'afterShow', header: 'Après spectacle' },
]

// Utiliser les utilitaires meals
const { getMealTypeLabel } = useMealTypeLabel()
const { getPhasesLabel } = useMealPhaseLabel()

// Labels pour les régimes alimentaires
const dietLabels: Record<string, string> = {
  VEGETARIAN: t('common.vegetarian'),
  VEGAN: t('common.vegan'),
}

const getDietLabel = (diet: string) => dietLabels[diet] || diet

// Formatage de date
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

// Données formatées pour le tableau
const formattedParticipants = computed(() => {
  return participants.value.map((p) => {
    let typeLabel = ''
    if (p.type === 'volunteer') typeLabel = t('common.volunteer')
    else if (p.type === 'artist') typeLabel = t('common.artist')
    else if (p.type === 'participant') typeLabel = t('common.participant')

    return {
      nom: p.nom,
      prenom: p.prenom,
      email: p.email,
      type: typeLabel,
      mealDate: formatDate(p.mealDate),
      mealType: getMealTypeLabel(p.mealType),
      mealPhase: getPhasesLabel(p.mealPhases),
      dietaryPreference: p.dietaryPreference ? getDietLabel(p.dietaryPreference) : '-',
      afterShow: p.type === 'artist' && p.afterShow ? '✓' : '-',
    }
  })
})

// Statistiques (reçues de l'API)
const stats = ref<{
  total: number
  volunteers: number
  artists: number
  ticketingParticipants: number
  byMealType: {
    BREAKFAST: number
    LUNCH: number
    DINNER: number
  }
  byDiet: {
    VEGETARIAN: number
    VEGAN: number
    standard: number
  }
  withAllergies: number
  afterShow: number
} | null>(null)

// Recherche avec debounce
const debouncedSearch = useDebounceFn(() => {
  pagination.value.page = 1
  fetchParticipants()
}, 300)

// Gestion du changement de page
const onPageChange = (page: number) => {
  pagination.value.page = page
  fetchParticipants()
}

// Charger les données
const fetchParticipants = async () => {
  loading.value = true
  try {
    const params: Record<string, string> = {
      page: pagination.value.page.toString(),
      pageSize: pagination.value.pageSize.toString(),
    }

    if (searchQuery.value.trim()) {
      params.search = searchQuery.value.trim()
    }

    if (selectedPhase.value) {
      params.phase = selectedPhase.value
    }

    if (selectedType.value) {
      params.type = selectedType.value
    }

    if (selectedMealType.value) {
      params.mealType = selectedMealType.value
    }

    if (selectedDate.value) {
      params.date = selectedDate.value
    }

    const response = await $fetch(`/api/editions/${editionId.value}/meals/participants`, {
      params,
    })

    if (response.success) {
      participants.value = response.participants
      pagination.value = response.pagination
      availableDates.value = response.availableDates || []
      stats.value = response.stats || null
    }
  } catch (error: any) {
    console.error('Failed to fetch participants:', error)
  } finally {
    loading.value = false
  }
}

// Réinitialiser la page lors du changement de filtres
watch([selectedPhase, selectedType, selectedMealType, selectedDate], () => {
  pagination.value.page = 1
  fetchParticipants()
})

onMounted(async () => {
  // Charger l'édition si nécessaire
  if (!edition.value) {
    await editionStore.fetchEditionById(editionId.value)
  }

  // Charger les participants
  await fetchParticipants()
})
</script>
