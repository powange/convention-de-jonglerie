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
          <UIcon name="i-heroicons-star" class="text-yellow-600 dark:text-yellow-400" />
          {{ $t('artists.list_title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('artists.manage_artists_description') }}
        </p>
      </div>

      <!-- Contenu -->
      <UCard>
        <template #header>
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
        </template>

        <!-- Statistiques -->
        <div v-if="artists.length > 0" class="mb-4 flex gap-2">
          <UBadge color="neutral" variant="soft">
            {{ $t('common.total') }}: {{ artists.length }}
          </UBadge>
        </div>

        <!-- Liste des artistes -->
        <div v-if="loading" class="text-center py-8">
          <p class="text-gray-500">{{ $t('common.loading') }}</p>
        </div>

        <div v-else-if="artists.length === 0" class="text-center py-8">
          <UIcon name="i-heroicons-user-group" class="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p class="text-gray-500">{{ $t('artists.no_artists') }}</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('common.name') }}
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('common.email') }}
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('edition.ticketing.phone') }}
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('artists.arrival') }}
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('artists.departure') }}
                </th>
                <th
                  class="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('common.meals_short') }}
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('artists.shows') }}
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('artists.payment_amount') }}
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('artists.reimbursement_max_actual') }}
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('artists.accommodation') }}
                </th>
                <th
                  class="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('artists.invoice_short') }}
                </th>
                <th
                  class="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('artists.fee_short') }}
                </th>
                <th
                  v-if="canEdit"
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[300px]"
                >
                  {{ $t('artists.organizer_notes') }}
                </th>
                <th
                  v-if="canEdit"
                  class="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('common.actions') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="artist in artists"
                :key="artist.id"
                class="hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <td class="px-4 py-3 text-sm">
                  <div class="flex items-center gap-2">
                    <UiUserAvatar :user="artist.user" size="sm" />
                    <span class="font-medium">
                      {{ artist.user.prenom }} {{ artist.user.nom }}
                    </span>
                  </div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {{ artist.user.email }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {{ artist.user.phone || '-' }}
                </td>
                <td class="px-4 py-3 text-sm">
                  <div v-if="artist.arrivalDateTime" class="space-y-1">
                    <div class="text-gray-900 dark:text-white font-medium">
                      {{ formatDateTime(artist.arrivalDateTime) }}
                    </div>
                    <div v-if="artist.pickupRequired" class="text-xs space-y-0.5">
                      <div class="flex items-center gap-1 text-primary-600 dark:text-primary-400">
                        <UIcon name="i-heroicons-map-pin" class="h-3 w-3" />
                        <span>{{ artist.pickupLocation || $t('artists.pickup_location') }}</span>
                      </div>
                      <div
                        v-if="artist.pickupResponsible"
                        class="flex items-center gap-1 text-gray-600 dark:text-gray-400"
                      >
                        <UIcon name="i-heroicons-user" class="h-3 w-3" />
                        <span>{{ artist.pickupResponsible.pseudo }}</span>
                      </div>
                    </div>
                  </div>
                  <span v-else class="text-gray-400">-</span>
                </td>
                <td class="px-4 py-3 text-sm">
                  <div v-if="artist.departureDateTime" class="space-y-1">
                    <div class="text-gray-900 dark:text-white font-medium">
                      {{ formatDateTime(artist.departureDateTime) }}
                    </div>
                    <div v-if="artist.dropoffRequired" class="text-xs space-y-0.5">
                      <div class="flex items-center gap-1 text-primary-600 dark:text-primary-400">
                        <UIcon name="i-heroicons-map-pin" class="h-3 w-3" />
                        <span>{{ artist.dropoffLocation || $t('artists.dropoff_location') }}</span>
                      </div>
                      <div
                        v-if="artist.dropoffResponsible"
                        class="flex items-center gap-1 text-gray-600 dark:text-gray-400"
                      >
                        <UIcon name="i-heroicons-user" class="h-3 w-3" />
                        <span>{{ artist.dropoffResponsible.pseudo }}</span>
                      </div>
                    </div>
                  </div>
                  <span v-else class="text-gray-400">-</span>
                </td>
                <td class="px-4 py-3 text-sm text-center">
                  <UButton
                    :color="getAcceptedMealsCount(artist) > 0 ? 'primary' : 'neutral'"
                    variant="soft"
                    size="sm"
                    @click="openMealsModal(artist)"
                  >
                    <span class="font-medium">{{ getMealsDisplayText(artist) }}</span>
                    <UIcon name="i-heroicons-chevron-right" class="ml-1 h-4 w-4" />
                  </UButton>
                </td>
                <td class="px-4 py-3 text-sm">
                  <div v-if="artist.shows && artist.shows.length > 0" class="flex flex-wrap gap-1">
                    <UBadge
                      v-for="showArtist in artist.shows"
                      :key="showArtist.show.id"
                      color="purple"
                      variant="subtle"
                      size="sm"
                    >
                      {{ showArtist.show.title }}
                    </UBadge>
                  </div>
                  <span v-else class="text-gray-400">-</span>
                </td>
                <td class="px-4 py-3 text-sm">
                  <div v-if="artist.payment" class="flex items-center gap-2">
                    <span class="font-medium">{{ artist.payment }}€</span>
                    <UBadge
                      :color="artist.paymentPaid ? 'success' : 'warning'"
                      variant="soft"
                      size="sm"
                    >
                      {{ artist.paymentPaid ? '✓' : '○' }}
                    </UBadge>
                  </div>
                  <span v-else class="text-gray-400">-</span>
                </td>
                <td class="px-4 py-3 text-sm">
                  <div
                    v-if="artist.reimbursementMax || artist.reimbursementActual"
                    class="space-y-1"
                  >
                    <div v-if="artist.reimbursementMax" class="flex items-center gap-2">
                      <span class="text-xs text-gray-500">Max:</span>
                      <span class="font-medium">{{ artist.reimbursementMax }}€</span>
                    </div>
                    <div v-if="artist.reimbursementActual" class="flex items-center gap-2">
                      <span class="text-xs text-gray-500">Réel:</span>
                      <span class="font-medium">{{ artist.reimbursementActual }}€</span>
                      <UBadge
                        :color="artist.reimbursementActualPaid ? 'success' : 'warning'"
                        variant="soft"
                        size="sm"
                      >
                        {{ artist.reimbursementActualPaid ? '✓' : '○' }}
                      </UBadge>
                    </div>
                  </div>
                  <span v-else class="text-gray-400">-</span>
                </td>
                <td class="px-4 py-3 text-sm">
                  <div class="space-y-1">
                    <div v-if="artist.accommodationAutonomous" class="flex items-center gap-2">
                      <UIcon name="i-heroicons-check-circle" class="h-5 w-5 text-success-500" />
                      <span class="text-sm text-gray-700 dark:text-gray-300">
                        {{ $t('artists.accommodation_autonomous_yes') }}
                      </span>
                    </div>
                    <div v-if="artist.accommodationType" class="flex items-center gap-1 text-xs">
                      <UBadge color="info" variant="subtle" size="sm">
                        {{ accommodationTypeLabel(artist.accommodationType) }}
                      </UBadge>
                      <span
                        v-if="artist.accommodationType === 'OTHER' && artist.accommodationTypeOther"
                        class="text-gray-500 truncate max-w-[120px]"
                        :title="artist.accommodationTypeOther"
                      >
                        {{ artist.accommodationTypeOther }}
                      </span>
                    </div>
                    <button
                      v-if="!artist.accommodationAutonomous && artist.accommodationProposal"
                      class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer w-full text-left"
                      @click="openAccommodationModal(artist)"
                    >
                      <UIcon
                        name="i-heroicons-home"
                        class="h-5 w-5 text-primary-500 flex-shrink-0"
                      />
                      <span class="text-sm text-gray-700 dark:text-gray-300 line-clamp-1 flex-1">
                        {{ artist.accommodationProposal }}
                      </span>
                      <UIcon name="i-heroicons-chevron-right" class="h-4 w-4 text-primary-500" />
                    </button>
                    <div
                      v-if="
                        !artist.accommodationAutonomous &&
                        !artist.accommodationProposal &&
                        !artist.accommodationType
                      "
                      class="flex items-center gap-2"
                    >
                      <UIcon
                        name="i-heroicons-question-mark-circle"
                        class="h-5 w-5 text-gray-400"
                      />
                      <span class="text-sm text-gray-400">
                        {{ $t('artists.accommodation_not_specified') }}
                      </span>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 text-sm text-center">
                  <UPopover :popper="{ placement: 'top' }">
                    <UBadge
                      :color="getInvoiceStatusColor(artist)"
                      variant="soft"
                      size="sm"
                      class="cursor-help"
                    >
                      {{ getInvoiceStatusIcon(artist) }}
                    </UBadge>
                    <template #content>
                      <div class="p-2 text-sm">
                        {{ getInvoiceStatusText(artist) }}
                      </div>
                    </template>
                  </UPopover>
                </td>
                <td class="px-4 py-3 text-sm text-center">
                  <UPopover :popper="{ placement: 'top' }">
                    <UBadge
                      :color="getFeeStatusColor(artist)"
                      variant="soft"
                      size="sm"
                      class="cursor-help"
                    >
                      {{ getFeeStatusIcon(artist) }}
                    </UBadge>
                    <template #content>
                      <div class="p-2 text-sm">
                        {{ getFeeStatusText(artist) }}
                      </div>
                    </template>
                  </UPopover>
                </td>
                <td v-if="canEdit" class="px-4 py-3 text-sm min-w-[300px]">
                  <button
                    v-if="artist.organizerNotes"
                    class="w-full text-left p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    @click="openNotesModal(artist)"
                  >
                    <p class="text-gray-700 dark:text-gray-300 whitespace-pre-line line-clamp-3">
                      {{ artist.organizerNotes }}
                    </p>
                    <div class="flex items-center gap-1 text-xs text-primary-500 mt-1">
                      <span>{{ $t('common.view_more') }}</span>
                      <UIcon name="i-heroicons-chevron-right" class="h-3 w-3" />
                    </div>
                  </button>
                  <button
                    v-else
                    class="w-full text-left p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    @click="openNotesModal(artist)"
                  >
                    <p class="text-gray-400 italic text-xs">
                      {{ $t('artists.no_notes') }}
                    </p>
                    <div class="flex items-center gap-1 text-xs text-primary-500 mt-1">
                      <span>{{ $t('common.add') }}</span>
                      <UIcon name="i-heroicons-plus" class="h-3 w-3" />
                    </div>
                  </button>
                </td>
                <td v-if="canEdit" class="px-4 py-3 text-sm text-right">
                  <div class="flex items-center justify-end gap-2">
                    <UButton
                      icon="i-heroicons-pencil"
                      color="primary"
                      variant="ghost"
                      size="sm"
                      @click="openEditArtistModal(artist)"
                    />
                    <UButton
                      icon="i-heroicons-trash"
                      color="error"
                      variant="ghost"
                      size="sm"
                      @click="confirmDeleteArtist(artist)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
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
      v-if="showMealsModal"
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

// Permissions
const canAccess = computed(() => {
  if (!edition.value || !authStore.user) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const canEdit = computed(() => {
  if (!edition.value || !authStore.user) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

// Données
const artists = ref<any[]>([])
const loading = ref(false)
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

// Charger l'édition
onMounted(async () => {
  if (!edition.value || edition.value.id !== editionId.value) {
    await editionStore.fetchEditionById(editionId.value)
  }
  await fetchArtists()
})

// Récupérer les artistes
const fetchArtists = async () => {
  loading.value = true
  try {
    const response = await $fetch(`/api/editions/${editionId.value}/artists`)
    artists.value = response.artists || []
  } catch (error) {
    console.error('Error fetching artists:', error)
    toast.add({
      title: 'Erreur lors du chargement des artistes',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

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
  // Rafraîchir les artistes pour obtenir les notes mises à jour
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
  if (!artist.invoiceRequested) return '○' // Non demandé
  if (artist.invoiceRequested && !artist.invoiceProvided) return '⏳' // Demandé
  return '✓' // Fourni
}

const getInvoiceStatusColor = (artist: any) => {
  if (!artist.invoiceRequested) return 'neutral' // Non demandé
  if (artist.invoiceRequested && !artist.invoiceProvided) return 'warning' // Demandé
  return 'success' // Fourni
}

const getInvoiceStatusText = (artist: any) => {
  if (!artist.invoiceRequested) return t('artists.invoice_not_requested')
  if (artist.invoiceRequested && !artist.invoiceProvided) return t('artists.invoice_requested')
  return t('artists.invoice_provided')
}

// Fonctions pour l'état du cachet
const getFeeStatusIcon = (artist: any) => {
  if (!artist.feeRequested) return '○' // Non demandé
  if (artist.feeRequested && !artist.feeProvided) return '⏳' // Demandé
  return '✓' // Fourni
}

const getFeeStatusColor = (artist: any) => {
  if (!artist.feeRequested) return 'neutral' // Non demandé
  if (artist.feeRequested && !artist.feeProvided) return 'warning' // Demandé
  return 'success' // Fourni
}

const getFeeStatusText = (artist: any) => {
  if (!artist.feeRequested) return t('artists.fee_not_requested')
  if (artist.feeRequested && !artist.feeProvided) return t('artists.fee_requested')
  return t('artists.fee_provided')
}
</script>
