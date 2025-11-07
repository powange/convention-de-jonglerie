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
      <!-- Titre de la page -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-chart-bar" class="text-primary-600" />
          {{ $t('gestion.ticketing.stats_title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('gestion.ticketing.stats_description') }}
        </p>
      </div>

      <!-- Filtres -->
      <div class="mb-6 space-y-4">
        <!-- Filtres de type -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ $t('gestion.ticketing.stats_filter_type') }}
          </label>
          <UFieldGroup>
            <UButton
              :variant="filters.showParticipants ? 'solid' : 'outline'"
              color="blue"
              @click="filters.showParticipants = !filters.showParticipants"
            >
              <UIcon v-if="filters.showParticipants" name="i-heroicons-check" class="mr-1" />
              {{ $t('gestion.ticketing.stats_participants') }}
            </UButton>
            <UButton
              :variant="filters.showVolunteers ? 'solid' : 'outline'"
              color="green"
              @click="filters.showVolunteers = !filters.showVolunteers"
            >
              <UIcon v-if="filters.showVolunteers" name="i-heroicons-check" class="mr-1" />
              {{ $t('gestion.ticketing.stats_volunteers') }}
            </UButton>
            <UButton
              :variant="filters.showArtists ? 'solid' : 'outline'"
              color="amber"
              @click="filters.showArtists = !filters.showArtists"
            >
              <UIcon v-if="filters.showArtists" name="i-heroicons-check" class="mr-1" />
              {{ $t('gestion.ticketing.stats_artists') }}
            </UButton>
          </UFieldGroup>
        </div>

        <!-- Filtres de période -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ $t('gestion.ticketing.stats_filter_period') }}
          </label>
          <UFieldGroup>
            <UButton
              :variant="filters.showSetup ? 'solid' : 'outline'"
              @click="filters.showSetup = !filters.showSetup"
            >
              <UIcon v-if="filters.showSetup" name="i-heroicons-check" class="mr-1" />
              {{ $t('gestion.ticketing.stats_period_setup') }}
            </UButton>
            <UButton
              :variant="filters.showEvent ? 'solid' : 'outline'"
              @click="filters.showEvent = !filters.showEvent"
            >
              <UIcon v-if="filters.showEvent" name="i-heroicons-check" class="mr-1" />
              {{ $t('gestion.ticketing.stats_period_event') }}
            </UButton>
            <UButton
              :variant="filters.showTeardown ? 'solid' : 'outline'"
              @click="filters.showTeardown = !filters.showTeardown"
            >
              <UIcon v-if="filters.showTeardown" name="i-heroicons-check" class="mr-1" />
              {{ $t('gestion.ticketing.stats_period_teardown') }}
            </UButton>
          </UFieldGroup>
        </div>
      </div>

      <!-- Totaux -->
      <div v-if="validationsData" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <UCard v-if="filters.showParticipants">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ $t('gestion.ticketing.stats_participants') }}
              </p>
              <p class="text-2xl font-bold text-blue-600">
                {{ validationsData.totals.participants }}
              </p>
            </div>
            <UIcon name="i-heroicons-users" class="h-8 w-8 text-blue-600" />
          </div>
        </UCard>
        <UCard v-if="filters.showVolunteers">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ $t('gestion.ticketing.stats_volunteers') }}
              </p>
              <p class="text-2xl font-bold text-green-600">
                {{ validationsData.totals.volunteers }}
              </p>
            </div>
            <UIcon name="i-heroicons-hand-raised" class="h-8 w-8 text-green-600" />
          </div>
        </UCard>
        <UCard v-if="filters.showArtists">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ $t('gestion.ticketing.stats_artists') }}
              </p>
              <p class="text-2xl font-bold text-amber-600">
                {{ validationsData.totals.artists }}
              </p>
            </div>
            <UIcon name="i-heroicons-star" class="h-8 w-8 text-amber-600" />
          </div>
        </UCard>
      </div>

      <!-- Graphique -->
      <UCard>
        <div v-if="loadingValidations" class="text-center py-12">
          <UIcon
            name="i-heroicons-arrow-path"
            class="h-8 w-8 text-gray-400 mx-auto mb-2 animate-spin"
          />
          <p class="text-gray-600 dark:text-gray-400">
            {{ $t('gestion.ticketing.stats_loading') }}
          </p>
        </div>
        <div v-else-if="validationsError" class="text-center py-12">
          <UIcon
            name="i-heroicons-exclamation-triangle"
            class="h-8 w-8 text-red-500 mx-auto mb-2"
          />
          <p class="text-red-600 dark:text-red-400">
            {{ $t('gestion.ticketing.stats_error') }}
          </p>
        </div>
        <div v-else-if="filteredData && filteredData.labels.length > 0">
          <AccessValidationChart
            :data="filteredData"
            :show-participants="filters.showParticipants"
            :show-volunteers="filters.showVolunteers"
            :show-artists="filters.showArtists"
          />
        </div>
        <div v-else class="text-center py-12">
          <UIcon name="i-heroicons-chart-bar" class="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p class="text-gray-600 dark:text-gray-400">
            {{ $t('gestion.ticketing.stats_no_data') }}
          </p>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

const AccessValidationChart = defineAsyncComponent(
  () => import('~/components/ticketing/stats/AccessValidationChart.vue')
)

definePageMeta({
  layout: 'edition-dashboard',
})

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// Vérifier l'accès à cette page (organisateurs seulement)
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.isOrganizer(edition.value, authStore.user.id)
})

// Filtres
const filters = reactive({
  showParticipants: true,
  showVolunteers: true,
  showArtists: true,
  showSetup: true,
  showEvent: true,
  showTeardown: true,
})

// Données de validations
interface ValidationData {
  labels: string[]
  timestamps: string[]
  participants: number[]
  volunteers: number[]
  artists: number[]
  periods: {
    setup: { start: string; end: string }
    event: { start: string; end: string }
    teardown: { start: string; end: string }
  }
  totals: {
    participants: number
    volunteers: number
    artists: number
  }
}

const validationsData = ref<ValidationData | null>(null)
const loadingValidations = ref(false)
const validationsError = ref(false)

// Filtrer les données selon les périodes sélectionnées
const filteredData = computed(() => {
  if (!validationsData.value) return null

  const { labels, timestamps, participants, volunteers, artists, periods } = validationsData.value

  // Filtrer par période
  const filteredIndices: number[] = []
  timestamps.forEach((timestamp, index) => {
    const time = new Date(timestamp).getTime()

    const setupStart = new Date(periods.setup.start).getTime()
    const setupEnd = new Date(periods.setup.end).getTime()
    const eventStart = new Date(periods.event.start).getTime()
    const eventEnd = new Date(periods.event.end).getTime()
    const teardownStart = new Date(periods.teardown.start).getTime()
    const teardownEnd = new Date(periods.teardown.end).getTime()

    if (
      (filters.showSetup && time >= setupStart && time < setupEnd) ||
      (filters.showEvent && time >= eventStart && time < eventEnd) ||
      (filters.showTeardown && time >= teardownStart && time <= teardownEnd)
    ) {
      filteredIndices.push(index)
    }
  })

  return {
    labels: filteredIndices.map((i) => labels[i]),
    participants: filteredIndices.map((i) => participants[i]),
    volunteers: filteredIndices.map((i) => volunteers[i]),
    artists: filteredIndices.map((i) => artists[i]),
  }
})

// Charger les données de validations
async function fetchValidations() {
  loadingValidations.value = true
  validationsError.value = false

  try {
    const data = await $fetch<ValidationData>(
      `/api/editions/${editionId}/ticketing/stats/validations`
    )
    validationsData.value = data
  } catch (error) {
    console.error('Failed to fetch validations:', error)
    validationsError.value = true
  } finally {
    loadingValidations.value = false
  }
}

// Charger l'édition si nécessaire
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }

  // Charger les données de validations
  if (canAccess.value) {
    await fetchValidations()
  }
})

// Métadonnées de la page
useSeoMeta({
  title: t('gestion.ticketing.stats_title') + ' - ' + (edition.value?.name || 'Édition'),
  description: t('gestion.ticketing.stats_description'),
})
</script>
