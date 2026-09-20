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

        <!-- Comparaison à une édition passée. Absente quand la convention n'a pas d'autre
             édition lisible : un sélecteur à une seule entrée ne propose rien. -->
        <div v-if="editionsComparables.length > 0" class="mt-4 flex flex-wrap items-center gap-3">
          <UFormField :label="$t('gestion.ticketing.stats_compare_label')" class="min-w-64">
            <USelect
              v-model="comparaisonId"
              :items="choixDeComparaison"
              value-key="value"
              :loading="chargementComparables || chargementComparaison"
              :placeholder="$t('gestion.ticketing.stats_no_comparison')"
            />
          </UFormField>

          <UAlert
            v-if="comparaisonEnPanne"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="subtle"
            class="flex-1 min-w-72"
            :title="$t('gestion.ticketing.stats_compare_error')"
          />
          <UAlert
            v-else-if="comparaisonRefusee"
            icon="i-heroicons-lock-closed"
            color="warning"
            variant="subtle"
            class="flex-1 min-w-72"
            :title="$t('gestion.ticketing.stats_compare_denied')"
          />
          <p
            v-else-if="enComparaison"
            class="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1"
          >
            <UIcon name="i-heroicons-information-circle" />
            {{ $t('gestion.ticketing.stats_compare_axis_hint') }}
          </p>
        </div>
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
          class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6"
        >
          <UCard v-if="filters.showParticipants">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('gestion.ticketing.stats_participants') }}
                </p>
                <p
                  :class="`text-2xl font-bold ${ticketConfig.textClass} ${ticketConfig.darkTextClass}`"
                >
                  {{ validationsData.totals.participants }}
                </p>
              </div>
              <UIcon :name="ticketConfig.icon" :class="`h-8 w-8 ${ticketConfig.iconColorClass}`" />
            </div>
          </UCard>
          <UCard v-if="filters.showVolunteers">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('gestion.ticketing.stats_volunteers') }}
                </p>
                <p
                  :class="`text-2xl font-bold ${volunteerConfig.textClass} ${volunteerConfig.darkTextClass}`"
                >
                  {{ validationsData.totals.volunteers }}
                </p>
              </div>
              <UIcon
                :name="volunteerConfig.icon"
                :class="`h-8 w-8 ${volunteerConfig.iconColorClass}`"
              />
            </div>
          </UCard>
          <UCard v-if="filters.showArtists">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('gestion.ticketing.stats_artists') }}
                </p>
                <p
                  :class="`text-2xl font-bold ${artistConfig.textClass} ${artistConfig.darkTextClass}`"
                >
                  {{ validationsData.totals.artists }}
                </p>
              </div>
              <UIcon :name="artistConfig.icon" :class="`h-8 w-8 ${artistConfig.iconColorClass}`" />
            </div>
          </UCard>
          <UCard v-if="filters.showOrganizers">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('gestion.ticketing.stats_organizers') }}
                </p>
                <p
                  :class="`text-2xl font-bold ${organizerConfig.textClass} ${organizerConfig.darkTextClass}`"
                >
                  {{ validationsData.totals.organizers }}
                </p>
              </div>
              <UIcon
                :name="organizerConfig.icon"
                :class="`h-8 w-8 ${organizerConfig.iconColorClass}`"
              />
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
        <div class="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Filtres de type -->
          <UFormField :label="$t('gestion.ticketing.stats_filter_type')">
            <USelect
              v-model="selectedTypes"
              :items="typeItems"
              multiple
              value-key="value"
              :ui="{ content: 'min-w-fit' }"
            >
              <template #default="{ modelValue }">
                <span v-if="Array.isArray(modelValue) && modelValue.length > 0">
                  {{ modelValue.length }}
                  {{
                    modelValue.length > 1 ? $t('common.items_selected') : $t('common.item_selected')
                  }}
                </span>
                <span v-else class="text-gray-400 dark:text-gray-500">
                  {{ $t('common.select') }}
                </span>
              </template>
            </USelect>
          </UFormField>

          <!-- Filtres de période -->
          <UFormField :label="$t('gestion.ticketing.stats_filter_period')">
            <USelect
              v-model="selectedPeriods"
              :items="periodItems"
              multiple
              value-key="value"
              :ui="{ content: 'min-w-fit' }"
            >
              <template #default="{ modelValue }">
                <span v-if="Array.isArray(modelValue) && modelValue.length > 0">
                  {{ modelValue.length }}
                  {{
                    modelValue.length > 1 ? $t('common.items_selected') : $t('common.item_selected')
                  }}
                </span>
                <span v-else class="text-gray-400 dark:text-gray-500">
                  {{ $t('common.select') }}
                </span>
              </template>
            </USelect>
          </UFormField>

          <!-- Granularité -->
          <UFormField :label="$t('gestion.ticketing.stats_filter_granularity')">
            <USelect
              v-model="selectedGranularity"
              :items="granularityItems"
              value-key="value"
              :ui="{ content: 'min-w-fit' }"
            />
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
        <div v-else-if="filteredData && filteredData.timestamps.length > 0">
          <AccessValidationChart
            v-if="donneesDesValidations"
            :data="donneesDesValidations"
            :etiquettes="comparaisonValidations?.etiquettes ?? null"
            :comparaison="
              comparaisonValidations
                ? {
                    libelle: comparaisonValidations.libelle,
                    series: comparaisonValidations.series,
                  }
                : null
            "
            :show-participants="filters.showParticipants"
            :show-volunteers="filters.showVolunteers"
            :show-artists="filters.showArtists"
            :show-organizers="filters.showOrganizers"
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
              >
                <template #default="{ modelValue }">
                  <span v-if="Array.isArray(modelValue) && modelValue.length > 0">
                    {{ modelValue.length }}
                    {{
                      modelValue.length > 1
                        ? $t('common.items_selected')
                        : $t('common.item_selected')
                    }}
                  </span>
                  <span v-else class="text-gray-400 dark:text-gray-500">
                    {{ $t('gestion.ticketing.stats_filter_tiers_placeholder') }}
                  </span>
                </template>
              </USelect>
            </UFormField>
          </div>

          <!-- Graphique en donut -->
          <OrderSourceChart
            :data="viewMode === 'items' ? orderSourcesData.items : orderSourcesData.orders"
            :comparaison="
              enComparaison && provenancesComparees
                ? {
                    libelle: libelleDEdition(editionComparee?.name, editionComparee?.startDate),
                    manual: (viewMode === 'orders'
                      ? provenancesComparees.orders
                      : provenancesComparees.items
                    ).manual,
                    external: (viewMode === 'orders'
                      ? provenancesComparees.orders
                      : provenancesComparees.items
                    ).external,
                  }
                : null
            "
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

      <!-- Graphique des achats de billets -->
      <UCard class="mt-6">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-shopping-cart" class="text-primary-600" />
            <h2 class="text-lg font-semibold">
              {{ $t('gestion.ticketing.stats_purchases_chart_title') }}
            </h2>
          </div>
        </template>

        <!-- Filtres -->
        <div class="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Filtres de type -->
          <UFormField :label="$t('gestion.ticketing.stats_filter_type')">
            <USelect
              v-model="selectedPurchaseTypes"
              :items="typeItemsPurchases"
              multiple
              value-key="value"
              :ui="{ content: 'min-w-fit' }"
            >
              <template #default="{ modelValue }">
                <span v-if="Array.isArray(modelValue) && modelValue.length > 0">
                  {{ modelValue.length }}
                  {{
                    modelValue.length > 1 ? $t('common.items_selected') : $t('common.item_selected')
                  }}
                </span>
                <span v-else class="text-gray-400 dark:text-gray-500">
                  {{ $t('common.select') }}
                </span>
              </template>
            </USelect>
          </UFormField>

          <!-- Périodes de vente -->
          <UFormField :label="$t('gestion.ticketing.stats_filter_buy_period')">
            <USelect
              v-model="selectedPurchasePeriods"
              :items="purchasePeriodItems"
              multiple
              value-key="value"
              :ui="{ content: 'min-w-fit' }"
            >
              <template #default="{ modelValue }">
                <span v-if="Array.isArray(modelValue) && modelValue.length > 0">
                  {{ modelValue.length }}
                  {{
                    modelValue.length > 1 ? $t('common.items_selected') : $t('common.item_selected')
                  }}
                </span>
                <span v-else class="text-gray-400 dark:text-gray-500">
                  {{ $t('common.select') }}
                </span>
              </template>
            </USelect>
          </UFormField>

          <!-- Granularité -->
          <UFormField :label="$t('gestion.ticketing.stats_filter_granularity')">
            <USelect
              v-model="selectedPurchaseGranularity"
              :items="purchaseGranularityItems"
              value-key="value"
              :ui="{ content: 'min-w-fit' }"
            />
          </UFormField>
        </div>

        <!-- Totaux -->
        <div v-if="achatsFiltres" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <UCard v-if="purchaseFilters.showParticipants">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('gestion.ticketing.stats_participants') }} ({{
                    $t('gestion.ticketing.stats_source_manual')
                  }})
                </p>
                <p
                  :class="`text-2xl font-bold ${ticketConfig.textClass} ${ticketConfig.darkTextClass}`"
                >
                  {{ achatsFiltres.totals.participantsManual }}
                </p>
              </div>
              <UIcon :name="ticketConfig.icon" :class="`h-8 w-8 ${ticketConfig.iconColorClass}`" />
            </div>
          </UCard>
          <UCard v-if="purchaseFilters.showParticipants">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('gestion.ticketing.stats_participants') }} ({{
                    $t('gestion.ticketing.stats_source_external')
                  }})
                </p>
                <p
                  :class="`text-2xl font-bold ${ticketConfig.textClass} ${ticketConfig.darkTextClass}`"
                >
                  {{ achatsFiltres.totals.participantsExternal }}
                </p>
              </div>
              <UIcon :name="ticketConfig.icon" :class="`h-8 w-8 ${ticketConfig.iconColorClass}`" />
            </div>
          </UCard>
          <UCard v-if="purchaseFilters.showOthers">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('gestion.ticketing.stats_others') }} ({{
                    $t('gestion.ticketing.stats_source_manual')
                  }})
                </p>
                <p class="text-2xl font-bold text-gray-600 dark:text-gray-400">
                  {{ achatsFiltres.totals.othersManual }}
                </p>
              </div>
              <UIcon name="i-heroicons-user" class="h-8 w-8 text-gray-500" />
            </div>
          </UCard>
          <UCard v-if="purchaseFilters.showOthers">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('gestion.ticketing.stats_others') }} ({{
                    $t('gestion.ticketing.stats_source_external')
                  }})
                </p>
                <p class="text-2xl font-bold text-gray-600 dark:text-gray-400">
                  {{ achatsFiltres.totals.othersExternal }}
                </p>
              </div>
              <UIcon name="i-heroicons-user" class="h-8 w-8 text-gray-500" />
            </div>
          </UCard>
        </div>

        <!-- Graphique -->
        <div v-if="loadingPurchases" class="text-center py-12">
          <UIcon
            name="i-heroicons-arrow-path"
            class="h-8 w-8 text-gray-400 mx-auto mb-2 animate-spin"
          />
          <p class="text-gray-600 dark:text-gray-400">
            {{ $t('gestion.ticketing.stats_loading') }}
          </p>
        </div>
        <div v-else-if="purchasesError" class="text-center py-12">
          <UIcon
            name="i-heroicons-exclamation-triangle"
            class="h-8 w-8 text-red-500 mx-auto mb-2"
          />
          <p class="text-red-600 dark:text-red-400">
            {{ $t('gestion.ticketing.stats_error') }}
          </p>
        </div>
        <!-- Ce qui est RÉELLEMENT tracé, et non les données brutes : décocher les trois périodes
             de vente laissait un graphique vide à l'écran là où « aucune donnée » se lit mieux.
             Et en comparaison, l'axe reste celui des deux éditions — le graphique garde donc sa
             raison d'être même si l'édition en cours n'a rien vendu sur la période retenue. -->
        <div v-else-if="donneesDesAchats && donneesDesAchats.labels.length > 0">
          <PurchaseChart
            v-if="donneesDesAchats"
            :data="donneesDesAchats"
            :comparaison="
              comparaisonAchats
                ? {
                    libelle: comparaisonAchats.libelle,
                    series: comparaisonAchats.series,
                  }
                : null
            "
            :show-participants="purchaseFilters.showParticipants"
            :show-others="purchaseFilters.showOthers"
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
import { comparerSeries, libelleDEdition } from '~/utils/comparaison-stats'
import { PERIODES_DACHAT, indicesDansLesPeriodes, serieSurIndices } from '~/utils/periodes-achats'

// Import explicite : plusieurs layers exportent un `requeteStats`-like et des constantes de même
// famille, et l'auto-import ne saurait pas lequel prendre.
import {
  reglagesDepuisUrl,
  requeteStats,
  TYPES_DE_PRESENCE_STATS,
} from '../../../../../utils/filtres-stats'

const { money } = useEditionCurrency()

const AccessValidationChart = defineAsyncComponent(
  () => import('~/components/ticketing/stats/AccessValidationChart.vue')
)

const OrderSourceChart = defineAsyncComponent(
  () => import('~/components/ticketing/stats/OrderSourceChart.vue')
)

const PurchaseChart = defineAsyncComponent(
  () => import('~/components/ticketing/stats/PurchaseChart.vue')
)

// Utiliser le composable pour obtenir les configurations des types de participants
const { getParticipantTypeConfig } = useParticipantTypes()
const ticketConfig = getParticipantTypeConfig('ticket')
const volunteerConfig = getParticipantTypeConfig('volunteer')
const artistConfig = getParticipantTypeConfig('artist')
const organizerConfig = getParticipantTypeConfig('organizer')

const route = useRoute()
const router = useRouter()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// Vérifier l'accès à cette page — gestion de la billetterie (droit dédié).
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageTicketing(edition.value, authStore.user.id)
})

// Items pour les selects
// typeItems pour les validations d'entrée (incluent tous les types)
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
  ...(edition.value?.artistsEnabled
    ? [
        {
          label: t('gestion.ticketing.stats_artists'),
          value: 'artists',
          icon: 'i-heroicons-star',
        },
      ]
    : []),
  {
    label: t('gestion.ticketing.stats_organizers'),
    value: 'organizers',
    icon: 'i-heroicons-shield-check',
  },
  {
    label: t('gestion.ticketing.stats_others'),
    value: 'others',
    icon: 'i-heroicons-user',
  },
])

// typeItemsPurchases pour les achats de billets (uniquement participants et autres)
const typeItemsPurchases = computed(() => [
  {
    label: t('gestion.ticketing.stats_participants'),
    value: 'participants',
    icon: 'i-heroicons-users',
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

const granularityItems = computed(() => [
  {
    label: t('gestion.ticketing.stats_granularity_30min'),
    value: 30,
  },
  {
    label: t('gestion.ticketing.stats_granularity_1h'),
    value: 60,
  },
  {
    label: t('gestion.ticketing.stats_granularity_2h'),
    value: 120,
  },
  {
    label: t('gestion.ticketing.stats_granularity_6h'),
    value: 360,
  },
])

const purchaseGranularityItems = computed(() => [
  {
    label: t('gestion.ticketing.stats_granularity_12h'),
    value: 720,
  },
  {
    label: t('gestion.ticketing.stats_granularity_1d'),
    value: 1440,
  },
  {
    label: t('gestion.ticketing.stats_granularity_1w'),
    value: 10080,
  },
  {
    label: t('gestion.ticketing.stats_granularity_1m'),
    value: 43200,
  },
])

const tierItems = computed(() =>
  tiers.value.map((tier) => ({
    label: `${tier.name} (${money(tier.price)})`,
    value: tier.id,
  }))
)

/**
 * Les types cochés d'office, figés une fois pour toutes au montage.
 *
 * Ils dépendent de l'activation des artistes sur l'édition. Les recalculer plus tard ferait
 * changer la référence à laquelle l'URL se compare : une sélection restée identique se mettrait
 * soudain à s'écrire, ou l'inverse. Un défaut doit être stable pour que « s'écarte du défaut »
 * veuille dire quelque chose.
 */
const typesParDefaut = TYPES_DE_PRESENCE_STATS.filter(
  (type) => type !== 'artists' || edition.value?.artistsEnabled
)

// Réglages conservés dans l'URL — cf. `filtres-stats.ts` pour la règle.
const reglagesInitiaux = reglagesDepuisUrl(route.query, typesParDefaut)

// Filtres sélectionnés pour les validations d'entrée
const selectedTypes = ref<string[]>(reglagesInitiaux.types)
const selectedPeriods = ref<string[]>(reglagesInitiaux.periodes)
const selectedGranularity = ref<number>(reglagesInitiaux.granularite)

/**
 * L'édition passée à laquelle on se compare, ou `null`.
 *
 * Par défaut aucune : l'écran se comporte exactement comme avant que cette possibilité existe,
 * et son adresse est la même. La sélection vit dans l'URL, donc un lien transporte la
 * comparaison avec le reste des réglages.
 */
const comparaisonId = ref<number | null>(reglagesInitiaux.comparaison)

/** Les éditions proposables — filtrées côté serveur sur le droit « gérer la billetterie ». */
const editionsComparables = ref<EditionComparable[]>([])
const chargementComparables = ref(false)

/** Ce qu'on a chargé de l'édition comparée, ou `null` tant qu'on ne compare pas. */
const validationsComparees = ref<ValidationData | null>(null)
const achatsCompares = ref<PurchaseData | null>(null)
const provenancesComparees = ref<OrderSourcesData | null>(null)
const chargementComparaison = ref(false)
/** Le refus explicite du serveur, distinct d'une panne : à dire, pas à taire. */
const comparaisonRefusee = ref(false)
/** Une panne de chargement, distincte du refus : à dire aussi, plutôt qu'à taire. */
const comparaisonEnPanne = ref(false)

/**
 * Les choix du sélecteur, « aucune comparaison » en tête.
 *
 * L'entrée de tête porte la valeur `null` : c'est elle qui permet de REVENIR à l'écran simple,
 * et sans elle une comparaison choisie par mégarde ne se déferait qu'en rechargeant la page.
 *
 * L'année de début figure dans le libellé quand l'édition n'a pas de nom propre — deux éditions
 * d'une même convention s'appellent souvent pareil, et seule la date les distingue.
 */
const choixDeComparaison = computed(() => [
  { label: t('gestion.ticketing.stats_no_comparison'), value: null },
  ...editionsComparables.value.map((e) => ({
    label: e.name || String(new Date(e.startDate).getFullYear()),
    value: e.id,
  })),
])

/** L'édition comparée, telle que le sélecteur la connaît. */
const editionComparee = computed(
  () => editionsComparables.value.find((e) => e.id === comparaisonId.value) ?? null
)

/** Compare-t-on vraiment ? Une sélection qu'on n'a pas pu charger ne compte pas. */
const enComparaison = computed(
  () => editionComparee.value !== null && !comparaisonRefusee.value && !comparaisonEnPanne.value
)

// Filtres sélectionnés pour les achats de billets
const selectedPurchaseTypes = ref<string[]>(reglagesInitiaux.typesDachat)
const selectedPurchaseGranularity = ref<number>(reglagesInitiaux.granulariteDesAchats)
const selectedPurchasePeriods = ref<string[]>(reglagesInitiaux.periodesDachat)

/**
 * Les trois périodes proposées au graphique des achats.
 *
 * Distinctes des périodes du graphique des validations : celles-ci découpent la vente, pas la
 * présence. « Avant » n'a pas de borne basse — la billetterie ouvre des mois avant le montage.
 */
const purchasePeriodItems = computed(() =>
  PERIODES_DACHAT.map((valeur) => ({
    label: t(`gestion.ticketing.stats_buy_period_${valeur}`),
    value: valeur,
  }))
)

// Filtres du graphique des validations d'entrée (dérivés de selectedTypes)
const filters = computed(() => ({
  showParticipants: selectedTypes.value.includes('participants'),
  showOthers: selectedTypes.value.includes('others'),
  showVolunteers: selectedTypes.value.includes('volunteers'),
  showArtists: selectedTypes.value.includes('artists') && !!edition.value?.artistsEnabled,
  showOrganizers: selectedTypes.value.includes('organizers'),
  showSetup: selectedPeriods.value.includes('setup'),
  showEvent: selectedPeriods.value.includes('event'),
  showTeardown: selectedPeriods.value.includes('teardown'),
}))

// Filtres du graphique des achats (dérivés de selectedPurchaseTypes)
const purchaseFilters = computed(() => ({
  showParticipants: selectedPurchaseTypes.value.includes('participants'),
  showOthers: selectedPurchaseTypes.value.includes('others'),
}))

// Données de validations
interface ValidationData {
  /** Les instants de début de tranche. Le serveur ne compose plus les libellés : il rendait
   *  « Lun 15/06 14h » en français, à l'heure d'UTC. */
  timestamps: string[]
  /** Le fuseau dans lequel les tranches ont été découpées — celui de l'édition. */
  timezone: string | null
  participants: number[]
  volunteers: number[]
  artists: number[]
  organizers: number[]
  others: number[]
  /** Les annulations d'entrée, série à part : elles ne se retranchent pas des arrivées. */
  cancellations: number[]
  periods: {
    setup: { start: string; end: string }
    event: { start: string; end: string }
    teardown: { start: string; end: string }
  }
  totals: {
    participants: number
    volunteers: number
    artists: number
    organizers: number
    others: number
    cancellations: number
  }
}

const validationsData = ref<ValidationData | null>(null)
const loadingValidations = ref(false)
const validationsError = ref(false)

// Données d'achats
interface PurchaseData {
  labels: string[]
  timestamps: string[]
  participantsManual: number[]
  participantsExternal: number[]
  othersManual: number[]
  othersExternal: number[]
  periods: {
    setup: { start: string; end: string }
    event: { start: string; end: string }
    teardown: { start: string; end: string }
  }
  totals: {
    participantsManual: number
    participantsExternal: number
    othersManual: number
    othersExternal: number
  }
}

/** Une édition proposée à la comparaison, telle que le serveur la rend. */
interface EditionComparable {
  id: number
  name: string | null
  startDate: string
  endDate: string
}

const purchasesData = ref<PurchaseData | null>(null)
const loadingPurchases = ref(false)
const purchasesError = ref(false)

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
const viewMode = ref<'items' | 'orders'>(reglagesInitiaux.vue)

// Données des tarifs
interface Tier {
  id: number
  name: string
  price: number
  isActive: boolean
}

const tiers = ref<Tier[]>([])
const selectedTierIds = ref<number[]>(reglagesInitiaux.tarifs)

const loadingTiers = ref(false)

/**
 * Report des réglages vers l'URL.
 *
 * `replace` et non `push` : régler un graphique n'est pas un pas de navigation sur lequel revenir,
 * et sept réglages en feraient vite un historique inutilisable.
 */
watch(
  [
    selectedTypes,
    selectedPeriods,
    selectedGranularity,
    selectedPurchaseTypes,
    selectedPurchaseGranularity,
    selectedPurchasePeriods,
    selectedTierIds,
    viewMode,
    comparaisonId,
  ],
  () => {
    router.replace({
      query: requeteStats(
        route.query,
        {
          types: selectedTypes.value,
          periodes: selectedPeriods.value,
          granularite: selectedGranularity.value,
          typesDachat: selectedPurchaseTypes.value,
          granulariteDesAchats: selectedPurchaseGranularity.value,
          periodesDachat: selectedPurchasePeriods.value,
          tarifs: selectedTierIds.value,
          vue: viewMode.value,
          comparaison: comparaisonId.value,
        },
        typesParDefaut
      ),
    })
  }
)

// Filtrer les données selon les périodes sélectionnées
const filteredData = computed(() => {
  if (!validationsData.value) return null

  const {
    timestamps,
    timezone,
    participants,
    others,
    volunteers,
    artists,
    organizers,
    cancellations,
    periods,
  } = validationsData.value

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
    // Des instants, plus des libellés : le graphique les formate dans la langue du lecteur et au
    // fuseau de l'édition. Le serveur composait « Lun 15/06 14h » en français, à l'heure d'UTC.
    timestamps: filteredIndices
      .map((i) => timestamps[i])
      .filter((v): v is string => v !== undefined),
    timezone,
    participants: filteredIndices
      .map((i) => participants[i])
      .filter((v): v is number => v !== undefined),
    volunteers: filteredIndices
      .map((i) => volunteers[i])
      .filter((v): v is number => v !== undefined),
    artists: filteredIndices.map((i) => artists[i]).filter((v): v is number => v !== undefined),
    organizers: filteredIndices
      .map((i) => organizers[i])
      .filter((v): v is number => v !== undefined),
    others: filteredIndices.map((i) => others[i]).filter((v): v is number => v !== undefined),
    cancellations: filteredIndices
      .map((i) => cancellations?.[i])
      .filter((v): v is number => v !== undefined),
  }
})

/**
 * Les achats ramenés aux périodes retenues.
 *
 * Trois lectures se superposent dans ce graphique : la vente des mois qui précèdent dit si la
 * communication a porté, celle des jours de l'édition dit combien de monde s'est décidé sur
 * place, celle d'après est faite de régularisations. Les découper est le seul moyen de lire
 * chacune pour elle-même.
 *
 * La règle vit dans `periodes-achats`, avec ses tests. Ici on ne fait que l'appliquer — aux
 * quatre séries d'un même geste, par leurs RANGS : les filtrer séparément les désynchroniserait.
 *
 * Les totaux sont recalculés depuis les séries découpées, et non repris du serveur. Des cartes
 * qui annonceraient le total de l'année entière au-dessus d'un graphique réduit à trois jours
 * donneraient un chiffre juste au mauvais endroit, ce qui revient à un chiffre faux.
 */
function filtrerAchats(donnees: PurchaseData | null): PurchaseData | null {
  if (!donnees) return null
  const indices = indicesDansLesPeriodes(
    donnees.timestamps,
    // Les bornes de CETTE édition, tirées de SES propres données : une édition comparée n'a pas
    // les mêmes dates, et lui appliquer celles de l'édition en cours la viderait entièrement.
    { debut: donnees.periods?.event?.start, fin: donnees.periods?.event?.end },
    selectedPurchasePeriods.value
  )
  if (indices.length === donnees.timestamps.length) return donnees

  const participantsManual = serieSurIndices(indices, donnees.participantsManual)
  const participantsExternal = serieSurIndices(indices, donnees.participantsExternal)
  const othersManual = serieSurIndices(indices, donnees.othersManual)
  const othersExternal = serieSurIndices(indices, donnees.othersExternal)
  const somme = (serie: number[]) => serie.reduce((a, b) => a + b, 0)

  return {
    ...donnees,
    labels: indices.map((i) => donnees.labels[i]).filter((v): v is string => v !== undefined),
    timestamps: indices
      .map((i) => donnees.timestamps[i])
      .filter((v): v is string => v !== undefined),
    participantsManual,
    participantsExternal,
    othersManual,
    othersExternal,
    totals: {
      participantsManual: somme(participantsManual),
      participantsExternal: somme(participantsExternal),
      othersManual: somme(othersManual),
      othersExternal: somme(othersExternal),
    },
  }
}

/** Les achats de l'édition en cours, découpés selon les périodes cochées. */
const achatsFiltres = computed(() => filtrerAchats(purchasesData.value))

/**
 * Les deux graphiques temporels, recalés sur l'ouverture de chaque édition.
 *
 * Tout le calcul vit dans `comparerSeries`, à côté de ses tests : ici on ne fait que lui donner
 * ce qu'il attend et récupérer ce qu'il rend — série par série, et non un total. Une comparaison
 * qui ne dit pas d'où vient l'écart n'apprend presque rien.
 */

/** La comparaison des validations d'entrée, ou `null` quand on ne compare pas. */
const comparaisonValidations = computed(() => {
  const courante = filteredData.value
  const comparee = validationsComparees.value
  if (!enComparaison.value || !courante || !comparee) return null

  const resultat = comparerSeries(
    {
      timestamps: courante.timestamps,
      series: {
        participants: courante.participants,
        volunteers: courante.volunteers,
        artists: courante.artists,
        organizers: courante.organizers,
        others: courante.others,
        cancellations: courante.cancellations,
      },
      // L'ouverture vient des DONNÉES, pas du magasin client : chaque jeu transporte sa propre
      // date de début d'édition, dans ses périodes, telle que le serveur la connaît. Lire l'une
      // dans le magasin et l'autre dans la liste des éditions comparables faisait dépendre les
      // deux côtés de sources différentes — et il suffisait que l'une ne porte pas le champ pour
      // qu'une édition entière disparaisse du graphique, sans la moindre erreur.
      ouverture: validationsData.value?.periods?.event?.start,
      fuseau: courante.timezone,
    },
    {
      timestamps: comparee.timestamps,
      series: {
        participants: comparee.participants,
        volunteers: comparee.volunteers,
        artists: comparee.artists,
        organizers: comparee.organizers,
        others: comparee.others,
        cancellations: comparee.cancellations,
      },
      ouverture: comparee.periods?.event?.start,
      fuseau: comparee.timezone,
    },
    selectedGranularity.value
  )

  return {
    etiquettes: resultat.etiquettes,
    // L'édition courante reprend sa place sur l'axe commun, série par série.
    courante: resultat.courante,
    series: resultat.comparee,
    libelle: libelleDEdition(editionComparee.value?.name, editionComparee.value?.startDate),
  }
})

/** La comparaison des achats de billets, ou `null`. */
const comparaisonAchats = computed(() => {
  const courante = achatsFiltres.value
  const comparee = filtrerAchats(achatsCompares.value)
  if (!enComparaison.value || !courante || !comparee) return null

  const series = (d: PurchaseData) => ({
    participantsManual: d.participantsManual,
    participantsExternal: d.participantsExternal,
    othersManual: d.othersManual,
    othersExternal: d.othersExternal,
  })

  const resultat = comparerSeries(
    {
      timestamps: courante.timestamps,
      series: series(courante),
      ouverture: courante.periods?.event?.start,
      fuseau: edition.value?.timezone,
    },
    {
      timestamps: comparee.timestamps,
      series: series(comparee),
      ouverture: comparee.periods?.event?.start,
      fuseau: edition.value?.timezone,
    },
    selectedPurchaseGranularity.value
  )

  return {
    etiquettes: resultat.etiquettes,
    courante: resultat.courante,
    series: resultat.comparee,
    libelle: libelleDEdition(editionComparee.value?.name, editionComparee.value?.startDate),
  }
})

/** Ce que le graphique des achats reçoit : recalé en comparaison, inchangé sinon. */
const donneesDesAchats = computed(() => {
  const brut = achatsFiltres.value
  if (!brut) return null
  const c = comparaisonAchats.value
  if (!c) return brut
  return {
    ...brut,
    labels: c.etiquettes,
    participantsManual: (c.courante.participantsManual ?? []).map((v) => v ?? 0),
    participantsExternal: (c.courante.participantsExternal ?? []).map((v) => v ?? 0),
    othersManual: (c.courante.othersManual ?? []).map((v) => v ?? 0),
    othersExternal: (c.courante.othersExternal ?? []).map((v) => v ?? 0),
  }
})

/** Ce que le graphique des validations reçoit. */
const donneesDesValidations = computed(() => {
  const brut = filteredData.value
  if (!brut) return null
  const c = comparaisonValidations.value
  if (!c) return brut
  return {
    ...brut,
    participants: (c.courante.participants ?? []).map((v) => v ?? 0),
    volunteers: (c.courante.volunteers ?? []).map((v) => v ?? 0),
    artists: (c.courante.artists ?? []).map((v) => v ?? 0),
    organizers: (c.courante.organizers ?? []).map((v) => v ?? 0),
    others: (c.courante.others ?? []).map((v) => v ?? 0),
    // Les annulations se recalent comme les autres : laissées brutes, elles gardaient la
    // longueur de l'axe d'origine et se décalaient dès que l'édition comparée élargissait l'axe.
    cancellations: (c.courante.cancellations ?? []).map((v) => v ?? 0),
    timestamps: brut.timestamps,
  }
})

// Charger les données de validations
async function fetchValidations() {
  loadingValidations.value = true
  validationsError.value = false

  try {
    const params = new URLSearchParams()
    params.append('granularity', selectedGranularity.value.toString())

    const data = await $fetch<ValidationData>(
      `/api/editions/${editionId}/ticketing/stats/validations?${params.toString()}`
    )
    validationsData.value = data
  } catch {
    validationsError.value = true
  } finally {
    loadingValidations.value = false
  }
}

// Charger les données d'achats
async function fetchPurchases() {
  loadingPurchases.value = true
  purchasesError.value = false

  try {
    const params = new URLSearchParams()
    params.append('granularity', selectedPurchaseGranularity.value.toString())

    const data = await $fetch<PurchaseData>(
      `/api/editions/${editionId}/ticketing/stats/purchases?${params.toString()}`
    )
    purchasesData.value = data
  } catch {
    purchasesError.value = true
  } finally {
    loadingPurchases.value = false
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
  } catch {
    orderSourcesError.value = true
  } finally {
    loadingOrderSources.value = false
  }
}

/** Charger les éditions auxquelles on a le droit de se comparer. */
async function chargerEditionsComparables() {
  chargementComparables.value = true
  try {
    const reponse = await $fetch<{ data?: { editions?: EditionComparable[] } }>(
      `/api/editions/${editionId}/ticketing/stats/editions-comparables`
    )
    editionsComparables.value = reponse?.data?.editions ?? []
  } catch {
    // Sans liste, le sélecteur ne s'affiche pas : il n'y a rien à proposer, et une erreur ici
    // ne doit pas empêcher de lire les statistiques de l'édition courante.
    editionsComparables.value = []
  } finally {
    chargementComparables.value = false
  }
}

/**
 * Charger les trois jeux de données de l'édition comparée.
 *
 * Les mêmes points d'API que pour l'édition courante, avec l'autre identifiant — c'est tout ce
 * que la comparaison demande côté serveur. Les granularités sont celles de l'écran, sans quoi
 * les deux courbes seraient découpées différemment et ne se superposeraient pas.
 */
async function chargerComparaison() {
  const id = comparaisonId.value
  if (id === null) {
    validationsComparees.value = null
    achatsCompares.value = null
    provenancesComparees.value = null
    comparaisonRefusee.value = false
    comparaisonEnPanne.value = false
    return
  }

  chargementComparaison.value = true
  comparaisonRefusee.value = false
  comparaisonEnPanne.value = false
  try {
    const [validations, achats, provenances] = await Promise.all([
      $fetch<ValidationData>(
        `/api/editions/${id}/ticketing/stats/validations?granularity=${selectedGranularity.value}`
      ),
      $fetch<PurchaseData>(
        `/api/editions/${id}/ticketing/stats/purchases?granularity=${selectedPurchaseGranularity.value}`
      ),
      $fetch<OrderSourcesData>(`/api/editions/${id}/ticketing/stats/order-sources`),
    ])
    validationsComparees.value = validations
    achatsCompares.value = achats
    provenancesComparees.value = provenances
  } catch (erreur: any) {
    // Un 403 n'est pas une panne : c'est une réponse, et l'écran doit la dire plutôt que
    // d'afficher une erreur générique. La liste est pourtant filtrée en amont — ce cas ne
    // survient que si le droit a été retiré entre le chargement de la liste et la sélection.
    comparaisonRefusee.value = erreur?.statusCode === 403 || erreur?.status === 403
    // Toute AUTRE panne doit se voir, elle aussi : un chargement qui échoue en silence laisse
    // l'écran sans courbe et sans explication, et c'est exactement ce qui s'est produit.
    comparaisonEnPanne.value = !comparaisonRefusee.value
    validationsComparees.value = null
    achatsCompares.value = null
    provenancesComparees.value = null
  } finally {
    chargementComparaison.value = false
  }
}

// Charger la liste des tarifs
async function fetchTiers() {
  loadingTiers.value = true

  try {
    const response = await $fetch<any>(`/api/editions/${editionId}/ticketing/tiers`)
    const data = Array.isArray(response?.data?.tiers) ? response.data.tiers : []
    tiers.value = data.filter((tier: Tier) => tier.isActive)
  } catch {
    // Erreur silencieuse
  } finally {
    loadingTiers.value = false
  }
}

// Watchers pour recharger les données quand les filtres changent
watch([selectedTierIds, viewMode], () => {
  fetchOrderSources()
})

watch(selectedGranularity, () => {
  fetchValidations()
  // L'édition comparée doit être redécoupée à la même granularité, sinon les deux courbes ne se
  // superposent plus : c'est tout l'objet du recalage.
  if (comparaisonId.value !== null) chargerComparaison()
})

watch(selectedPurchaseGranularity, () => {
  fetchPurchases()
  if (comparaisonId.value !== null) chargerComparaison()
})

// Changer d'édition comparée, ou revenir à « aucune comparaison ».
watch(comparaisonId, () => {
  chargerComparaison()
})

// Charger l'édition si nécessaire
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch {
      // Erreur silencieuse
    }
  }

  // Charger les données de validations, achats et sources
  if (canAccess.value) {
    await Promise.all([
      fetchValidations(),
      fetchPurchases(),
      fetchTiers(),
      fetchOrderSources(),
      chargerEditionsComparables(),
    ])
    // Après la liste, pour qu'une comparaison venue de l'URL trouve son édition dans le
    // sélecteur — sans quoi l'écran comparerait sans savoir dire à quoi.
    if (comparaisonId.value !== null) await chargerComparaison()
  }
})

// Métadonnées de la page
useSeoMeta({
  title: t('gestion.ticketing.stats_title') + ' - ' + (edition.value?.name || 'Édition'),
  description: t('gestion.ticketing.stats_description'),
})
</script>
