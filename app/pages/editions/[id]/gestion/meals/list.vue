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
          <div class="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- Recherche par nom/prénom/email -->
            <UInput
              v-model="searchQuery"
              icon="i-heroicons-magnifying-glass"
              :placeholder="$t('edition.meals.search_placeholder')"
              @input="debouncedSearch"
            />

            <!-- Filtre par phase -->
            <USelectMenu
              v-model="selectedPhase"
              :items="phaseOptions"
              :placeholder="$t('edition.meals.filter_phase')"
            />

            <!-- Filtre par type -->
            <USelectMenu
              v-model="selectedType"
              :items="typeOptions"
              :placeholder="$t('edition.meals.filter_type')"
            />
          </div>

          <!-- Statistiques -->
          <div class="mb-4 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <span class="font-medium">{{ $t('edition.meals.total_participants') }}:</span>
              {{ pagination.total }}
            </div>
            <div v-if="stats.volunteers > 0">
              <span class="font-medium">{{ $t('edition.meals.volunteers') }}:</span>
              {{ stats.volunteers }}
            </div>
            <div v-if="stats.artists > 0">
              <span class="font-medium">{{ $t('edition.meals.artists') }}:</span>
              {{ stats.artists }}
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

          <UTable v-else :data="formattedParticipants" :columns="columns" />

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
const selectedPhase = ref<any>(null)
const selectedType = ref<any>(null)

// Options de filtres
const phaseOptions = computed(() => [
  { value: null, label: t('edition.meals.all_phases') },
  { value: 'SETUP', label: t('common.setup') },
  { value: 'EVENT', label: t('common.event') },
  { value: 'TEARDOWN', label: t('common.teardown') },
])

const typeOptions = computed(() => [
  { value: null, label: t('edition.meals.all_types') },
  { value: 'volunteer', label: t('common.volunteer') },
  { value: 'artist', label: t('common.artist') },
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
  return participants.value.map((p) => ({
    nom: p.nom,
    prenom: p.prenom,
    email: p.email,
    type: p.type === 'volunteer' ? t('common.volunteer') : t('common.artist'),
    mealDate: formatDate(p.mealDate),
    mealType: getMealTypeLabel(p.mealType),
    mealPhase: getPhasesLabel(p.mealPhases),
    dietaryPreference: p.dietaryPreference ? getDietLabel(p.dietaryPreference) : '-',
    afterShow: p.type === 'artist' && p.afterShow ? '✓' : '-',
  }))
})

// Statistiques (calculées côté serveur via le total)
const stats = computed(() => {
  // Ces stats sont approximatives car on ne compte que la page courante
  const volunteers = participants.value.filter((p) => p.type === 'volunteer').length
  const artists = participants.value.filter((p) => p.type === 'artist').length
  return { volunteers, artists }
})

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

    if (selectedPhase.value?.value) {
      params.phase = selectedPhase.value.value
    }

    if (selectedType.value?.value) {
      params.type = selectedType.value.value
    }

    const response = await $fetch(`/api/editions/${editionId.value}/meals/participants`, {
      params,
    })

    if (response.success) {
      participants.value = response.participants
      pagination.value = response.pagination
    }
  } catch (error: any) {
    console.error('Failed to fetch participants:', error)
  } finally {
    loading.value = false
  }
}

// Réinitialiser la page lors du changement de filtres
watch([selectedPhase, selectedType], () => {
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
