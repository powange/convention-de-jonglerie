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

      <!-- Graphique avec filtres -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-chart-bar" class="text-primary-600" />
            <h2 class="text-lg font-semibold">
              {{ $t('gestion.ticketing.stats_chart_title') }}
            </h2>
          </div>
        </template>

        <!-- Totaux -->
        <div
          v-if="validationsData"
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
        >
          <UCard v-if="filters.showParticipants">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('gestion.ticketing.stats_participants') }}
                </p>
                <p class="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {{ validationsData.totals.participants }}
                </p>
              </div>
              <UIcon name="i-heroicons-ticket" class="h-8 w-8 text-orange-500" />
            </div>
          </UCard>
          <UCard v-if="filters.showVolunteers">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('gestion.ticketing.stats_volunteers') }}
                </p>
                <p class="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {{ validationsData.totals.volunteers }}
                </p>
              </div>
              <UIcon name="i-heroicons-user-group" class="h-8 w-8 text-purple-500" />
            </div>
          </UCard>
          <UCard v-if="filters.showArtists">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('gestion.ticketing.stats_artists') }}
                </p>
                <p class="text-2xl font-bold text-green-600 dark:text-green-400">
                  {{ validationsData.totals.artists }}
                </p>
              </div>
              <UIcon name="i-heroicons-star" class="h-8 w-8 text-green-500" />
            </div>
          </UCard>
          <UCard v-if="filters.showOthers">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('gestion.ticketing.stats_others') }}
                </p>
                <p class="text-2xl font-bold text-gray-600 dark:text-gray-400">
                  {{ validationsData.totals.others }}
                </p>
              </div>
              <UIcon name="i-heroicons-user" class="h-8 w-8 text-gray-500" />
            </div>
          </UCard>
        </div>

        <!-- Filtres -->
        <div class="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Filtres de type -->
          <UFormField :label="$t('gestion.ticketing.stats_filter_type')">
            <USelect v-model="selectedTypes" :items="typeItems" multiple value-key="value" />
          </UFormField>

          <!-- Filtres de période -->
          <UFormField :label="$t('gestion.ticketing.stats_filter_period')">
            <USelect v-model="selectedPeriods" :items="periodItems" multiple value-key="value" />
          </UFormField>
        </div>

        <!-- Graphique -->
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
            :show-others="filters.showOthers"
          />
        </div>
        <div v-else class="text-center py-12">
          <UIcon name="i-heroicons-chart-bar" class="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p class="text-gray-600 dark:text-gray-400">
            {{ $t('gestion.ticketing.stats_no_data') }}
          </p>
        </div>
      </UCard>

      <!-- Statistiques des sources de commandes -->
      <UCard class="mt-6">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-arrow-path" class="text-primary-600" />
            <h2 class="text-lg font-semibold">
              {{ $t('gestion.ticketing.stats_order_sources_title') }}
            </h2>
          </div>
        </template>

        <div v-if="loadingOrderSources" class="text-center py-12">
          <UIcon
            name="i-heroicons-arrow-path"
            class="h-8 w-8 text-gray-400 mx-auto mb-2 animate-spin"
          />
          <p class="text-gray-600 dark:text-gray-400">
            {{ $t('gestion.ticketing.stats_loading') }}
          </p>
        </div>
        <div v-else-if="orderSourcesError" class="text-center py-12">
          <UIcon
            name="i-heroicons-exclamation-triangle"
            class="h-8 w-8 text-red-500 mx-auto mb-2"
          />
          <p class="text-red-600 dark:text-red-400">
            {{ $t('gestion.ticketing.stats_error') }}
          </p>
        </div>
        <div v-else-if="orderSourcesData">
          <!-- Toggle entre Items et Commandes -->
          <div class="mb-6 flex justify-center">
            <UFieldGroup>
              <UButton
                :variant="viewMode === 'items' ? 'solid' : 'outline'"
                @click="viewMode = 'items'"
              >
                {{ $t('gestion.ticketing.stats_view_items') }}
              </UButton>
              <UButton
                :variant="viewMode === 'orders' ? 'solid' : 'outline'"
                @click="viewMode = 'orders'"
              >
                {{ $t('gestion.ticketing.stats_view_orders') }}
              </UButton>
            </UFieldGroup>
          </div>

          <!-- Filtre par tarifs (uniquement en mode items) -->
          <div v-if="viewMode === 'items' && tiers.length > 0" class="mb-6">
            <UFormField :label="$t('gestion.ticketing.stats_filter_tiers')">
              <USelect
                v-model="selectedTierIds"
                :items="tierItems"
                multiple
                value-key="value"
                :placeholder="$t('gestion.ticketing.stats_filter_tiers_placeholder')"
                :ui="{ content: 'min-w-fit' }"
              />
            </UFormField>
          </div>

          <!-- Statistiques numériques -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <UCard>
              <div class="text-center">
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('gestion.ticketing.stats_source_manual') }}
                </p>
                <p class="text-3xl font-bold text-blue-600">
                  {{
                    viewMode === 'items'
                      ? orderSourcesData.items.manual
                      : orderSourcesData.orders.manual
                  }}
                </p>
              </div>
            </UCard>
            <UCard>
              <div class="text-center">
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('gestion.ticketing.stats_source_external') }}
                </p>
                <p class="text-3xl font-bold text-green-600">
                  {{
                    viewMode === 'items'
                      ? orderSourcesData.items.external
                      : orderSourcesData.orders.external
                  }}
                </p>
              </div>
            </UCard>
            <UCard>
              <div class="text-center">
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('gestion.ticketing.stats_total') }}
                </p>
                <p class="text-3xl font-bold text-gray-900 dark:text-white">
                  {{
                    viewMode === 'items'
                      ? orderSourcesData.items.total
                      : orderSourcesData.orders.total
                  }}
                </p>
              </div>
            </UCard>
          </div>

          <!-- Graphique en donut -->
          <OrderSourceChart
            :data="viewMode === 'items' ? orderSourcesData.items : orderSourcesData.orders"
            :show-orders="viewMode === 'orders'"
          />
        </div>
        <div v-else class="text-center py-12">
          <UIcon name="i-heroicons-chart-pie" class="h-16 w-16 text-gray-400 mx-auto mb-4" />
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

const OrderSourceChart = defineAsyncComponent(
  () => import('~/components/ticketing/stats/OrderSourceChart.vue')
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

// Items pour les selects
const typeItems = computed(() => [
  {
    label: t('gestion.ticketing.stats_participants'),
    value: 'participants',
    icon: 'i-heroicons-users',
  },
  {
    label: t('gestion.ticketing.stats_volunteers'),
    value: 'volunteers',
    icon: 'i-heroicons-hand-raised',
  },
  {
    label: t('gestion.ticketing.stats_artists'),
    value: 'artists',
    icon: 'i-heroicons-star',
  },
  {
    label: t('gestion.ticketing.stats_others'),
    value: 'others',
    icon: 'i-heroicons-user',
  },
])

const periodItems = computed(() => [
  {
    label: t('gestion.ticketing.stats_period_setup'),
    value: 'setup',
  },
  {
    label: t('gestion.ticketing.stats_period_event'),
    value: 'event',
  },
  {
    label: t('gestion.ticketing.stats_period_teardown'),
    value: 'teardown',
  },
])

const tierItems = computed(() =>
  tiers.value.map((tier) => ({
    label: `${tier.name} (${(tier.price / 100).toFixed(2)} €)`,
    value: tier.id,
  }))
)

// Filtres sélectionnés
const selectedTypes = ref<string[]>(['participants', 'volunteers', 'artists', 'others'])
const selectedPeriods = ref<string[]>(['setup', 'event', 'teardown'])

// Filtres calculés pour compatibilité avec le code existant
const filters = computed(() => ({
  showParticipants: selectedTypes.value.includes('participants'),
  showOthers: selectedTypes.value.includes('others'),
  showVolunteers: selectedTypes.value.includes('volunteers'),
  showArtists: selectedTypes.value.includes('artists'),
  showSetup: selectedPeriods.value.includes('setup'),
  showEvent: selectedPeriods.value.includes('event'),
  showTeardown: selectedPeriods.value.includes('teardown'),
}))

// Données de validations
interface ValidationData {
  labels: string[]
  timestamps: string[]
  participants: number[]
  volunteers: number[]
  artists: number[]
  others: number[]
  periods: {
    setup: { start: string; end: string }
    event: { start: string; end: string }
    teardown: { start: string; end: string }
  }
  totals: {
    participants: number
    volunteers: number
    artists: number
    others: number
  }
}

const validationsData = ref<ValidationData | null>(null)
const loadingValidations = ref(false)
const validationsError = ref(false)

// Données des sources de commandes
interface OrderSourcesData {
  items: {
    manual: number
    external: number
    total: number
  }
  orders: {
    manual: number
    external: number
    total: number
  }
}

const orderSourcesData = ref<OrderSourcesData | null>(null)
const loadingOrderSources = ref(false)
const orderSourcesError = ref(false)
const viewMode = ref<'items' | 'orders'>('items')

// Données des tarifs
interface Tier {
  id: number
  name: string
  price: number
  isActive: boolean
}

const tiers = ref<Tier[]>([])
const selectedTierIds = ref<number[]>([])
const loadingTiers = ref(false)

// Filtrer les données selon les périodes sélectionnées
const filteredData = computed(() => {
  if (!validationsData.value) return null

  const { labels, timestamps, participants, others, volunteers, artists, periods } =
    validationsData.value

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
      (filters.value.showSetup && time >= setupStart && time < setupEnd) ||
      (filters.value.showEvent && time >= eventStart && time < eventEnd) ||
      (filters.value.showTeardown && time >= teardownStart && time <= teardownEnd)
    ) {
      filteredIndices.push(index)
    }
  })

  return {
    labels: filteredIndices.map((i) => labels[i]),
    participants: filteredIndices.map((i) => participants[i]),
    volunteers: filteredIndices.map((i) => volunteers[i]),
    artists: filteredIndices.map((i) => artists[i]),
    others: filteredIndices.map((i) => others[i]),
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

// Charger les données des sources de commandes
async function fetchOrderSources() {
  loadingOrderSources.value = true
  orderSourcesError.value = false

  try {
    const params = new URLSearchParams()
    if (selectedTierIds.value.length > 0 && viewMode.value === 'items') {
      selectedTierIds.value.forEach((id) => params.append('tierIds', id.toString()))
    }

    const url = `/api/editions/${editionId}/ticketing/stats/order-sources${
      params.toString() ? `?${params.toString()}` : ''
    }`

    const data = await $fetch<OrderSourcesData>(url)
    orderSourcesData.value = data
  } catch (error) {
    console.error('Failed to fetch order sources:', error)
    orderSourcesError.value = true
  } finally {
    loadingOrderSources.value = false
  }
}

// Charger la liste des tarifs
async function fetchTiers() {
  loadingTiers.value = true

  try {
    const data = await $fetch<Tier[]>(`/api/editions/${editionId}/ticketing/tiers`)
    tiers.value = data.filter((tier) => tier.isActive)
  } catch (error) {
    console.error('Failed to fetch tiers:', error)
  } finally {
    loadingTiers.value = false
  }
}

// Watcher pour recharger les données quand les filtres changent
watch([selectedTierIds, viewMode], () => {
  fetchOrderSources()
})

// Charger l'édition si nécessaire
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }

  // Charger les données de validations et sources
  if (canAccess.value) {
    await Promise.all([fetchValidations(), fetchTiers(), fetchOrderSources()])
  }
})

// Métadonnées de la page
useSeoMeta({
  title: t('gestion.ticketing.stats_title') + ' - ' + (edition.value?.name || 'Édition'),
  description: t('gestion.ticketing.stats_description'),
})
</script>
