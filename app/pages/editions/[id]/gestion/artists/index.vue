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
          <UIcon name="i-heroicons-star" class="text-yellow-600 dark:text-yellow-400" />
          {{ $t('artists.list_title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('artists.manage_artists_description') }}
        </p>
      </div>

      <!-- Informations artistes -->
      <UCard class="mb-6">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-information-circle" class="text-blue-500" />
              {{ $t('artists.artist_info_title') }}
            </h2>
            <div v-if="canEdit" class="flex items-center gap-2">
              <UButton
                v-if="artistInfoDirty"
                color="primary"
                icon="i-heroicons-check"
                :loading="savingArtistInfo"
                @click="saveArtistInfo()"
              >
                {{ $t('common.save') }}
              </UButton>
              <UButton
                v-if="editingArtistInfo"
                color="neutral"
                variant="soft"
                icon="i-heroicons-x-mark"
                @click="cancelArtistInfoEdit"
              >
                {{ $t('common.cancel') }}
              </UButton>
              <UButton
                v-else
                color="primary"
                icon="i-heroicons-pencil-square"
                @click="editingArtistInfo = true"
              >
                {{ $t('common.edit') }}
              </UButton>
            </div>
          </div>
        </template>

        <template v-if="editingArtistInfo">
          <MinimalMarkdownEditor
            v-model="artistInfoLocal"
            :empty-placeholder="$t('artists.artist_info_placeholder')"
          />
        </template>

        <template v-else-if="artistInfoLocal">
          <div class="prose prose-sm dark:prose-invert max-w-none">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div :class="{ 'line-clamp-3': !artistInfoExpanded }" v-html="artistInfoPreviewHtml" />
            <UButton
              v-if="!artistInfoExpanded"
              variant="ghost"
              color="primary"
              size="xs"
              class="mt-2"
              @click="artistInfoExpanded = true"
            >
              {{ $t('common.see_more') }}...
            </UButton>
            <UButton
              v-else
              variant="ghost"
              color="primary"
              size="xs"
              class="mt-2"
              @click="artistInfoExpanded = false"
            >
              {{ $t('common.see_less') }}
            </UButton>
          </div>
        </template>

        <template v-else>
          <p class="text-sm text-gray-400 italic">
            {{ $t('artists.artist_info_empty') }}
          </p>
        </template>
      </UCard>

      <!-- Contenu -->
      <UCard>
        <template #header>
          <div class="flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold">{{ $t('artists.title') }}</h2>
              <UButton
                v-if="canEdit"
                color="primary"
                icon="i-heroicons-plus"
                @click="openAddArtistModal"
              >
                {{ $t('artists.add_artist') }}
              </UButton>
            </div>

            <!-- Barre de filtres et contrôles -->
            <div
              v-if="artists.length > 0"
              class="flex flex-col sm:flex-row items-start sm:items-center gap-3"
            >
              <UInput
                v-model="globalFilter"
                :placeholder="$t('artists.search_placeholder')"
                icon="i-heroicons-magnifying-glass"
                class="w-full sm:w-64"
              />

              <USelect
                v-model="showFilter"
                :items="showFilterItems"
                :placeholder="$t('artists.filter_by_show')"
                class="w-full sm:w-56"
              />

              <div class="flex items-center gap-2 ml-auto">
                <UBadge color="neutral" variant="soft">
                  {{ $t('common.total') }}: {{ filteredArtists.length }}
                </UBadge>

                <UButton
                  v-if="globalFilter || (showFilter && showFilter !== 'ALL')"
                  icon="i-heroicons-x-mark"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :title="$t('artists.reset_filters')"
                  @click="resetFilters"
                />

                <UDropdownMenu :items="columnVisibilityItems">
                  <UButton icon="i-heroicons-view-columns" color="neutral" size="sm" variant="soft">
                    <span class="hidden sm:inline">{{ $t('common.columns') }}</span>
                  </UButton>
                </UDropdownMenu>
              </div>
            </div>
          </div>
        </template>

        <!-- Liste des artistes -->
        <div v-if="loading" class="text-center py-8">
          <p class="text-gray-500">{{ $t('common.loading') }}</p>
        </div>

        <div v-else-if="artists.length === 0" class="text-center py-8">
          <UIcon name="i-heroicons-user-group" class="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p class="text-gray-500">{{ $t('artists.no_artists') }}</p>
        </div>

        <div v-else class="overflow-x-auto">
          <UTable
            ref="tableRef"
            v-model:sorting="sorting"
            v-model:column-visibility="columnVisibility"
            v-model:global-filter="globalFilter"
            :data="filteredArtists"
            :columns="columns"
            class="w-full"
          >
            <!-- Nom -->
            <template #name-cell="{ row }">
              <div class="flex items-center gap-2">
                <UiUserAvatar :user="row.original.user" size="sm" />
                <span class="font-medium">
                  {{ row.original.user.prenom }} {{ row.original.user.nom }}
                </span>
              </div>
            </template>

            <!-- Email -->
            <template #email-cell="{ row }">
              <span class="text-gray-600 dark:text-gray-400">{{ row.original.user.email }}</span>
            </template>

            <!-- Téléphone -->
            <template #phone-cell="{ row }">
              <span class="text-gray-600 dark:text-gray-400">{{
                row.original.user.phone || '-'
              }}</span>
            </template>

            <!-- Arrivée -->
            <template #arrival-cell="{ row }">
              <div v-if="row.original.arrivalDateTime" class="space-y-1">
                <div class="text-gray-900 dark:text-white font-medium">
                  {{ formatDateTime(row.original.arrivalDateTime) }}
                </div>
                <div v-if="row.original.pickupRequired" class="text-xs space-y-0.5">
                  <div class="flex items-center gap-1 text-primary-600 dark:text-primary-400">
                    <UIcon name="i-heroicons-map-pin" class="h-3 w-3" />
                    <span>{{ row.original.pickupLocation || $t('artists.pickup_location') }}</span>
                  </div>
                  <div
                    v-if="row.original.pickupResponsible"
                    class="flex items-center gap-1 text-gray-600 dark:text-gray-400"
                  >
                    <UIcon name="i-heroicons-user" class="h-3 w-3" />
                    <span>{{ row.original.pickupResponsible.pseudo }}</span>
                  </div>
                </div>
              </div>
              <span v-else class="text-gray-400">-</span>
            </template>

            <!-- Départ -->
            <template #departure-cell="{ row }">
              <div v-if="row.original.departureDateTime" class="space-y-1">
                <div class="text-gray-900 dark:text-white font-medium">
                  {{ formatDateTime(row.original.departureDateTime) }}
                </div>
                <div v-if="row.original.dropoffRequired" class="text-xs space-y-0.5">
                  <div class="flex items-center gap-1 text-primary-600 dark:text-primary-400">
                    <UIcon name="i-heroicons-map-pin" class="h-3 w-3" />
                    <span>{{
                      row.original.dropoffLocation || $t('artists.dropoff_location')
                    }}</span>
                  </div>
                  <div
                    v-if="row.original.dropoffResponsible"
                    class="flex items-center gap-1 text-gray-600 dark:text-gray-400"
                  >
                    <UIcon name="i-heroicons-user" class="h-3 w-3" />
                    <span>{{ row.original.dropoffResponsible.pseudo }}</span>
                  </div>
                </div>
              </div>
              <span v-else class="text-gray-400">-</span>
            </template>

            <!-- Repas -->
            <template #meals-cell="{ row }">
              <UButton
                :color="getAcceptedMealsCount(row.original) > 0 ? 'primary' : 'neutral'"
                variant="soft"
                size="sm"
                @click="openMealsModal(row.original)"
              >
                <span class="font-medium">{{ getMealsDisplayText(row.original) }}</span>
                <UIcon name="i-heroicons-chevron-right" class="ml-1 h-4 w-4" />
              </UButton>
            </template>

            <!-- Spectacles -->
            <template #shows-cell="{ row }">
              <div
                v-if="row.original.shows && row.original.shows.length > 0"
                class="flex flex-wrap gap-1"
              >
                <UBadge
                  v-for="showArtist in row.original.shows"
                  :key="showArtist.show.id"
                  color="purple"
                  variant="subtle"
                  size="sm"
                >
                  {{ showArtist.show.title }}
                </UBadge>
              </div>
              <span v-else class="text-gray-400">-</span>
            </template>

            <!-- Paiement -->
            <template #payment-cell="{ row }">
              <div v-if="row.original.payment" class="flex items-center gap-2">
                <span class="font-medium">{{ row.original.payment }}€</span>
                <UBadge
                  :color="row.original.paymentPaid ? 'success' : 'warning'"
                  variant="soft"
                  size="sm"
                >
                  {{ row.original.paymentPaid ? '✓' : '○' }}
                </UBadge>
              </div>
              <span v-else class="text-gray-400">-</span>
            </template>

            <!-- Remboursement -->
            <template #reimbursement-cell="{ row }">
              <div
                v-if="row.original.reimbursementMax || row.original.reimbursementActual"
                class="space-y-1"
              >
                <div v-if="row.original.reimbursementMax" class="flex items-center gap-2">
                  <span class="text-xs text-gray-500">Max:</span>
                  <span class="font-medium">{{ row.original.reimbursementMax }}€</span>
                </div>
                <div v-if="row.original.reimbursementActual" class="flex items-center gap-2">
                  <span class="text-xs text-gray-500">Réel:</span>
                  <span class="font-medium">{{ row.original.reimbursementActual }}€</span>
                  <UBadge
                    :color="row.original.reimbursementActualPaid ? 'success' : 'warning'"
                    variant="soft"
                    size="sm"
                  >
                    {{ row.original.reimbursementActualPaid ? '✓' : '○' }}
                  </UBadge>
                </div>
              </div>
              <span v-else class="text-gray-400">-</span>
            </template>

            <!-- Hébergement -->
            <template #accommodation-cell="{ row }">
              <div class="space-y-1">
                <div v-if="row.original.accommodationAutonomous" class="flex items-center gap-2">
                  <UIcon name="i-heroicons-check-circle" class="h-5 w-5 text-success-500" />
                  <span class="text-sm text-gray-700 dark:text-gray-300">
                    {{ $t('artists.accommodation_autonomous_yes') }}
                  </span>
                </div>
                <div v-if="row.original.accommodationType" class="flex items-center gap-1 text-xs">
                  <UBadge color="info" variant="subtle" size="sm">
                    {{ accommodationTypeLabel(row.original.accommodationType) }}
                  </UBadge>
                  <span
                    v-if="
                      row.original.accommodationType === 'OTHER' &&
                      row.original.accommodationTypeOther
                    "
                    class="text-gray-500 truncate max-w-30"
                    :title="row.original.accommodationTypeOther"
                  >
                    {{ row.original.accommodationTypeOther }}
                  </span>
                </div>
                <button
                  v-if="!row.original.accommodationAutonomous && row.original.accommodationProposal"
                  class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer w-full text-left"
                  @click="openAccommodationModal(row.original)"
                >
                  <UIcon name="i-heroicons-home" class="h-5 w-5 text-primary-500 shrink-0" />
                  <span class="text-sm text-gray-700 dark:text-gray-300 line-clamp-1 flex-1">
                    {{ row.original.accommodationProposal }}
                  </span>
                  <UIcon name="i-heroicons-chevron-right" class="h-4 w-4 text-primary-500" />
                </button>
                <div
                  v-if="
                    !row.original.accommodationAutonomous &&
                    !row.original.accommodationProposal &&
                    !row.original.accommodationType
                  "
                  class="flex items-center gap-2"
                >
                  <UIcon name="i-heroicons-question-mark-circle" class="h-5 w-5 text-gray-400" />
                  <span class="text-sm text-gray-400">
                    {{ $t('artists.accommodation_not_specified') }}
                  </span>
                </div>
              </div>
            </template>

            <!-- Facture -->
            <template #invoice-cell="{ row }">
              <UTooltip :text="getInvoiceStatusText(row.original)">
                <UBadge
                  :color="getInvoiceStatusColor(row.original)"
                  variant="soft"
                  size="sm"
                  class="cursor-help"
                >
                  {{ getInvoiceStatusIcon(row.original) }}
                </UBadge>
              </UTooltip>
            </template>

            <!-- Cachet -->
            <template #fee-cell="{ row }">
              <UTooltip :text="getFeeStatusText(row.original)">
                <UBadge
                  :color="getFeeStatusColor(row.original)"
                  variant="soft"
                  size="sm"
                  class="cursor-help"
                >
                  {{ getFeeStatusIcon(row.original) }}
                </UBadge>
              </UTooltip>
            </template>

            <!-- Notes organisateur -->
            <template #notes-cell="{ row }">
              <button
                v-if="row.original.organizerNotes"
                class="w-full text-left p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                @click="openNotesModal(row.original)"
              >
                <p class="text-gray-700 dark:text-gray-300 whitespace-pre-line line-clamp-3">
                  {{ row.original.organizerNotes }}
                </p>
                <div class="flex items-center gap-1 text-xs text-primary-500 mt-1">
                  <span>{{ $t('common.view_more') }}</span>
                  <UIcon name="i-heroicons-chevron-right" class="h-3 w-3" />
                </div>
              </button>
              <button
                v-else
                class="w-full text-left p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                @click="openNotesModal(row.original)"
              >
                <p class="text-gray-400 italic text-xs">
                  {{ $t('artists.no_notes') }}
                </p>
                <div class="flex items-center gap-1 text-xs text-primary-500 mt-1">
                  <span>{{ $t('common.add') }}</span>
                  <UIcon name="i-heroicons-plus" class="h-3 w-3" />
                </div>
              </button>
            </template>

            <!-- Actions -->
            <template #actions-cell="{ row }">
              <div class="flex items-center justify-end gap-2">
                <UButton
                  icon="i-heroicons-pencil"
                  color="primary"
                  variant="ghost"
                  size="sm"
                  @click="openEditArtistModal(row.original)"
                />
                <UButton
                  icon="i-heroicons-trash"
                  color="error"
                  variant="ghost"
                  size="sm"
                  @click="confirmDeleteArtist(row.original)"
                />
              </div>
            </template>
          </UTable>
        </div>
      </UCard>
    </div>

    <!-- Modal artiste -->
    <ArtistsArtistModal
      v-model="showArtistModal"
      :artist="selectedArtist"
      :edition-id="editionId"
      @artist-saved="handleArtistSaved"
    />

    <!-- Modal repas -->
    <ArtistsMealsModal
      v-if="edition?.mealsEnabled && showMealsModal"
      v-model="showMealsModal"
      :artist="selectedArtistForMeals"
      :edition-id="editionId"
      @meals-saved="handleMealsSaved"
    />

    <!-- Modal notes organisateur -->
    <ArtistsOrganizerNotesModal
      v-if="showNotesModal"
      v-model="showNotesModal"
      :artist="selectedArtistForNotes"
      :edition-id="editionId"
      @notes-saved="handleNotesSaved"
    />

    <!-- Modal hébergement -->
    <ArtistsAccommodationModal
      v-if="showAccommodationModal"
      v-model="showAccommodationModal"
      :artist="selectedArtistForAccommodation"
      :accommodation-proposal="selectedArtistForAccommodation?.accommodationProposal || ''"
    />

    <!-- Modal confirmation suppression -->
    <UiConfirmModal
      v-model="showDeleteConfirm"
      :title="$t('artists.delete_artist')"
      :message="$t('artists.delete_confirm')"
      confirm-color="error"
      @confirm="deleteArtist"
    />
  </div>
</template>

<script setup lang="ts">
import { getAccommodationTypeLabel } from '~/utils/accommodation-type'
import { markdownToHtml } from '~/utils/markdown'

import type { TableColumn } from '@nuxt/ui'
import type { Column } from '@tanstack/vue-table'

definePageMeta({
  middleware: ['authenticated'],
})

const route = useRoute()
const { t } = useI18n()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const { formatDateTime } = useDateFormat()

const editionId = computed(() => parseInt(route.params.id as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))

// Permissions — toute la page est réservée aux organisateurs qui gèrent les artistes
const canAccess = computed(() => {
  if (!edition.value || !authStore.user) return false
  return editionStore.canManageArtists(edition.value, authStore.user.id)
})

const canEdit = computed(() => canAccess.value)

// Informations artistes (champ sur l'édition)
const artistInfoLocal = ref(edition.value?.artistInfo ?? '')
const artistInfoDirty = computed(() => artistInfoLocal.value !== (edition.value?.artistInfo ?? ''))
const editingArtistInfo = ref(false)
const artistInfoExpanded = ref(false)
const artistInfoPreviewHtml = ref('')

const renderArtistInfoPreview = async () => {
  if (!edition.value?.artistInfo) {
    artistInfoPreviewHtml.value = ''
    return
  }
  try {
    artistInfoPreviewHtml.value = await markdownToHtml(edition.value.artistInfo)
  } catch {
    artistInfoPreviewHtml.value = ''
  }
}

const { execute: saveArtistInfo, loading: savingArtistInfo } = useApiAction(
  () => `/api/editions/${editionId.value}/artist-info`,
  {
    method: 'PUT',
    body: () => ({ artistInfo: artistInfoLocal.value || null }),
    successMessage: { title: t('artists.artist_info_saved') },
    errorMessages: { default: t('artists.artist_info_save_error') },
    onSuccess: () => {
      editionStore.fetchEditionById(editionId.value, { force: true })
      editingArtistInfo.value = false
    },
  }
)

const cancelArtistInfoEdit = () => {
  artistInfoLocal.value = edition.value?.artistInfo ?? ''
  editingArtistInfo.value = false
}

// Sync artistInfoLocal quand l'édition change (sauf si l'utilisateur est en train d'éditer)
watch(
  () => edition.value?.artistInfo,
  (val) => {
    if (!editingArtistInfo.value) {
      artistInfoLocal.value = val ?? ''
    }
    renderArtistInfoPreview()
  }
)

// Données
const artists = ref<any[]>([])
const showArtistModal = ref(false)
const selectedArtist = ref<any>(null)
const showMealsModal = ref(false)
const selectedArtistForMeals = ref<any>(null)
const showNotesModal = ref(false)
const selectedArtistForNotes = ref<any>(null)
const showAccommodationModal = ref(false)
const selectedArtistForAccommodation = ref<any>(null)
const showDeleteConfirm = ref(false)
const artistToDelete = ref<any>(null)

// Table ref pour accès API TanStack
const tableRef = ref<InstanceType<typeof import('@nuxt/ui').UTable> | null>(null)

// État du tri
const sorting = ref<{ id: string; desc: boolean }[]>([])

// Visibilité des colonnes
const columnVisibility = ref<Record<string, boolean>>({})

// Filtres
const globalFilter = ref('')
const showFilter = ref('ALL')

// Liste des spectacles pour le filtre
const allShows = computed(() => {
  const showsMap = new Map<number, string>()
  artists.value.forEach((artist) => {
    artist.shows?.forEach((sa: any) => {
      if (!showsMap.has(sa.show.id)) {
        showsMap.set(sa.show.id, sa.show.title)
      }
    })
  })
  return Array.from(showsMap.entries()).map(([id, title]) => ({
    label: title,
    value: String(id),
  }))
})

const showFilterItems = computed(() => [
  { label: t('artists.all_shows'), value: 'ALL' },
  ...allShows.value,
])

// Artistes filtrés par spectacle
const filteredArtists = computed(() => {
  if (!showFilter.value || showFilter.value === 'ALL') return artists.value
  return artists.value.filter((artist) =>
    artist.shows?.some((sa: any) => String(sa.show.id) === showFilter.value)
  )
})

const resetFilters = () => {
  globalFilter.value = ''
  showFilter.value = 'ALL'
  sorting.value = []
}

// Helper pour les en-têtes triables
function getSortableHeader(column: Column<any>, label: string) {
  const isSorted = column.getIsSorted()
  return h(resolveComponent('UButton'), {
    color: 'neutral',
    variant: 'ghost',
    label,
    icon: isSorted
      ? isSorted === 'asc'
        ? 'i-lucide-arrow-up-narrow-wide'
        : 'i-lucide-arrow-down-wide-narrow'
      : 'i-lucide-arrow-up-down',
    class: '-mx-2.5',
    onClick: () => column.toggleSorting(isSorted === 'asc'),
  })
}

// Labels des colonnes pour le sélecteur de visibilité
const getColumnLabel = (columnId: string): string => {
  const labels: Record<string, string> = {
    name: t('common.name'),
    email: t('common.email'),
    phone: t('edition.ticketing.phone'),
    arrival: t('artists.arrival'),
    departure: t('artists.departure'),
    meals: t('common.meals_short'),
    shows: t('artists.shows'),
    payment: t('artists.payment_amount'),
    reimbursement: t('artists.reimbursement_max_actual'),
    accommodation: t('artists.accommodation'),
    invoice: t('artists.invoice_short'),
    fee: t('artists.fee_short'),
    notes: t('artists.organizer_notes'),
    actions: t('common.actions'),
  }
  return labels[columnId] || columnId
}

// Items du dropdown de visibilité des colonnes
const columnVisibilityItems = computed(() => {
  const allColumns = tableRef.value?.tableApi
    ?.getAllColumns()
    .filter((column: any) => column.getCanHide())

  if (!allColumns) return []

  return allColumns.map((column: any) => ({
    label: getColumnLabel(column.id),
    type: 'checkbox' as const,
    checked: column.getIsVisible(),
    onUpdateChecked(checked: boolean) {
      tableRef.value?.tableApi?.getColumn(column.id)?.toggleVisibility(!!checked)
    },
    onSelect(e?: Event) {
      e?.preventDefault()
    },
  }))
})

// Définition des colonnes
const columns = computed((): TableColumn<any>[] => [
  {
    id: 'name',
    accessorFn: (row: any) => `${row.user?.prenom} ${row.user?.nom}`,
    header: ({ column }) => getSortableHeader(column, t('common.name')),
    enableHiding: false,
  },
  {
    id: 'email',
    accessorFn: (row: any) => row.user?.email,
    header: ({ column }) => getSortableHeader(column, t('common.email')),
  },
  {
    id: 'phone',
    accessorFn: (row: any) => row.user?.phone,
    header: t('edition.ticketing.phone'),
    enableSorting: false,
  },
  {
    id: 'arrival',
    accessorKey: 'arrivalDateTime',
    header: ({ column }) => getSortableHeader(column, t('artists.arrival')),
  },
  {
    id: 'departure',
    accessorKey: 'departureDateTime',
    header: ({ column }) => getSortableHeader(column, t('artists.departure')),
  },
  ...(edition.value?.mealsEnabled
    ? [
        {
          id: 'meals',
          header: t('common.meals_short'),
          enableSorting: false,
          meta: { class: { th: 'text-center', td: 'text-center' } },
        } as TableColumn<any>,
      ]
    : []),
  {
    id: 'shows',
    accessorFn: (row: any) => row.shows?.map((sa: any) => sa.show.title).join(', ') || '',
    header: ({ column }) => getSortableHeader(column, t('artists.shows')),
  },
  {
    id: 'payment',
    accessorKey: 'payment',
    header: ({ column }) => getSortableHeader(column, t('artists.payment_amount')),
  },
  {
    id: 'reimbursement',
    accessorFn: (row: any) => row.reimbursementMax || row.reimbursementActual || 0,
    header: ({ column }) => getSortableHeader(column, t('artists.reimbursement_max_actual')),
  },
  {
    id: 'accommodation',
    header: t('artists.accommodation'),
    enableSorting: false,
  },
  {
    id: 'invoice',
    header: t('artists.invoice_short'),
    enableSorting: false,
    meta: { class: { th: 'text-center', td: 'text-center' } },
  },
  {
    id: 'fee',
    header: t('artists.fee_short'),
    enableSorting: false,
    meta: { class: { th: 'text-center', td: 'text-center' } },
  },
  ...(canEdit.value
    ? [
        {
          id: 'notes',
          header: t('artists.organizer_notes'),
          enableSorting: false,
          size: 300,
        } as TableColumn<any>,
        {
          id: 'actions',
          header: t('common.actions'),
          enableSorting: false,
          enableHiding: false,
          meta: { class: { th: 'text-right', td: 'text-right' } },
        } as TableColumn<any>,
      ]
    : []),
])

// Charger l'édition
onMounted(async () => {
  if (!edition.value || edition.value.id !== editionId.value) {
    await editionStore.fetchEditionById(editionId.value)
  }
  await Promise.all([fetchArtists(), renderArtistInfoPreview()])
})

// Récupérer les artistes
const { execute: fetchArtists, loading } = useApiAction(
  () => `/api/editions/${editionId.value}/artists`,
  {
    method: 'GET',
    errorMessages: { default: 'Erreur lors du chargement des artistes' },
    onSuccess: (response: any) => {
      artists.value = response?.artists || []
    },
  }
)

// Ouvrir le modal d'ajout
const openAddArtistModal = () => {
  selectedArtist.value = null
  showArtistModal.value = true
}

// Ouvrir le modal d'édition
const openEditArtistModal = (artist: any) => {
  selectedArtist.value = artist
  showArtistModal.value = true
}

// Gérer la sauvegarde
const handleArtistSaved = () => {
  fetchArtists()
}

// Confirmer la suppression
const confirmDeleteArtist = (artist: any) => {
  artistToDelete.value = artist
  showDeleteConfirm.value = true
}

// Supprimer l'artiste
const { execute: deleteArtist, loading: _deletingArtist } = useApiAction(
  () => `/api/editions/${editionId.value}/artists/${artistToDelete.value?.id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('artists.artist_deleted') },
    errorMessages: { default: t('artists.error_delete') },
    onSuccess: () => {
      artistToDelete.value = null
      fetchArtists()
    },
    onError: () => {
      artistToDelete.value = null
    },
  }
)

// Ouvrir le modal de gestion des repas
const openMealsModal = (artist: any) => {
  selectedArtistForMeals.value = artist
  showMealsModal.value = true
}

// Gérer la sauvegarde des repas
const handleMealsSaved = () => {
  // Rafraîchir les artistes pour obtenir les repas mis à jour
  fetchArtists()
  toast.add({
    title: t('artists.meals.meals_updated'),
    color: 'success',
  })
}

// Ouvrir le modal de gestion des notes
const openNotesModal = (artist: any) => {
  selectedArtistForNotes.value = artist
  showNotesModal.value = true
}

// Gérer la sauvegarde des notes
const handleNotesSaved = () => {
  fetchArtists()
}

// Ouvrir le modal d'hébergement
const openAccommodationModal = (artist: any) => {
  selectedArtistForAccommodation.value = artist
  showAccommodationModal.value = true
}

// Compter les repas acceptés (cochés)
const getAcceptedMealsCount = (artist: any) => {
  if (!artist.mealSelections || artist.mealSelections.length === 0) return 0
  return artist.mealSelections.filter((selection: any) => selection.accepted).length
}

// Obtenir le texte d'affichage des repas (acceptés/total)
const getMealsDisplayText = (artist: any) => {
  if (!artist.mealSelections || artist.mealSelections.length === 0) return '0/0'
  const acceptedCount = artist.mealSelections.filter((selection: any) => selection.accepted).length
  const totalCount = artist.mealSelections.length
  return `${acceptedCount}/${totalCount}`
}

// Label du type d'hébergement
const accommodationTypeLabel = (type: string) => getAccommodationTypeLabel(type, t)

// Fonctions pour l'état de la facture
const getInvoiceStatusIcon = (artist: any) => {
  if (!artist.invoiceRequested) return '○'
  if (artist.invoiceRequested && !artist.invoiceProvided) return '⏳'
  return '✓'
}

const getInvoiceStatusColor = (artist: any) => {
  if (!artist.invoiceRequested) return 'neutral'
  if (artist.invoiceRequested && !artist.invoiceProvided) return 'warning'
  return 'success'
}

const getInvoiceStatusText = (artist: any) => {
  if (!artist.invoiceRequested) return t('artists.invoice_not_requested')
  if (artist.invoiceRequested && !artist.invoiceProvided) return t('artists.invoice_requested')
  return t('artists.invoice_provided')
}

// Fonctions pour l'état du cachet
const getFeeStatusIcon = (artist: any) => {
  if (!artist.feeRequested) return '○'
  if (artist.feeRequested && !artist.feeProvided) return '⏳'
  return '✓'
}

const getFeeStatusColor = (artist: any) => {
  if (!artist.feeRequested) return 'neutral'
  if (artist.feeRequested && !artist.feeProvided) return 'warning'
  return 'success'
}

const getFeeStatusText = (artist: any) => {
  if (!artist.feeRequested) return t('artists.fee_not_requested')
  if (artist.feeRequested && !artist.feeProvided) return t('artists.fee_requested')
  return t('artists.fee_provided')
}
</script>
