<template>
  <div v-if="edition">
    <EditionHeader :edition="edition" current-page="artist-space" />

    <!-- Chargement -->
    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
    </div>

    <!-- Pas artiste -->
    <UAlert
      v-else-if="!artist"
      icon="i-heroicons-exclamation-triangle"
      color="warning"
      variant="soft"
      :title="$t('common.not_found')"
    />

    <!-- Contenu -->
    <div v-else class="space-y-6">
      <!-- En-tête artiste -->
      <UCard>
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-4">
            <div
              class="flex items-center justify-center w-14 h-14 rounded-xl bg-yellow-100 dark:bg-yellow-900/30"
            >
              <UIcon name="i-heroicons-star" class="h-7 w-7 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <h1 class="text-xl font-bold text-gray-900 dark:text-white">
                {{ artist.firstName }} {{ artist.lastName }}
              </h1>
              <p class="text-sm text-gray-500">{{ artist.email }}</p>
              <p class="text-sm text-gray-400 mt-1">
                {{ $t('artists.artist_space_subtitle') }}
              </p>
            </div>
          </div>
          <UButton
            icon="i-heroicons-qr-code"
            color="primary"
            variant="soft"
            @click="qrModalOpen = true"
          >
            {{ $t('artists.view_qr_code') }}
          </UButton>
        </div>

        <!-- Dates arrivée/départ -->
        <div
          v-if="artist.arrivalDateTime || artist.departureDateTime"
          class="mt-4 flex flex-wrap gap-4"
        >
          <div v-if="artist.arrivalDateTime" class="flex items-center gap-2 text-sm">
            <UIcon name="i-heroicons-arrow-down-tray" class="text-green-500" />
            <span class="text-gray-600 dark:text-gray-400">
              {{ $t('artists.arrival') }} : {{ formatDateTime(artist.arrivalDateTime) }}
            </span>
          </div>
          <div v-if="artist.departureDateTime" class="flex items-center gap-2 text-sm">
            <UIcon name="i-heroicons-arrow-up-tray" class="text-red-500" />
            <span class="text-gray-600 dark:text-gray-400">
              {{ $t('artists.departure') }} : {{ formatDateTime(artist.departureDateTime) }}
            </span>
          </div>
        </div>
      </UCard>

      <!-- Spectacles -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-sparkles" class="text-purple-500" />
            {{ $t('artists.my_shows') }}
          </h2>
        </template>

        <div v-if="artist.shows.length > 0" class="space-y-3">
          <div
            v-for="show in artist.shows"
            :key="show.id"
            class="flex items-start justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
          >
            <div class="space-y-1">
              <p class="font-medium text-gray-900 dark:text-white">{{ show.title }}</p>
              <div class="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                <span class="flex items-center gap-1">
                  <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
                  {{ formatDateTime(show.startDateTime) }}
                </span>
                <span v-if="show.duration" class="flex items-center gap-1">
                  <UIcon name="i-heroicons-clock" class="w-4 h-4" />
                  {{ $t('artists.show_duration_minutes', { duration: show.duration }) }}
                </span>
                <span v-if="show.location" class="flex items-center gap-1">
                  <UIcon name="i-heroicons-map-pin" class="w-4 h-4" />
                  {{ show.location }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-6 text-gray-500">
          <UIcon name="i-heroicons-sparkles" class="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p>{{ $t('artists.no_shows') }}</p>
        </div>
      </UCard>

      <!-- Repas -->
      <UCard v-if="artist.mealSelections.length > 0">
        <template #header>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-cake" class="text-orange-500" />
            {{ $t('artists.my_meals') }}
          </h2>
        </template>

        <div class="space-y-4">
          <!-- Régime alimentaire et allergies -->
          <div
            class="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 space-y-2"
          >
            <!-- Mode lecture -->
            <template v-if="!editingDiet">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ $t('artists.dietary_preference') }}
                </span>
                <UButton
                  icon="i-heroicons-pencil-square"
                  variant="ghost"
                  size="xs"
                  color="neutral"
                  @click="editingDiet = true"
                />
              </div>
              <div
                v-if="artist.dietaryPreference !== 'NONE'"
                class="flex items-center gap-2 text-sm"
              >
                <UIcon name="i-heroicons-heart" class="text-orange-500 shrink-0" />
                <span class="text-gray-700 dark:text-gray-300">
                  <strong>{{ $t(`diet.${artist.dietaryPreference.toLowerCase()}`) }}</strong>
                </span>
              </div>
              <div v-else class="text-sm text-gray-400">
                {{ $t('diet.none') }}
              </div>
              <div v-if="artist.allergies" class="flex items-start gap-2 text-sm">
                <UIcon
                  name="i-heroicons-exclamation-triangle"
                  class="text-orange-500 shrink-0 mt-0.5"
                />
                <span class="text-gray-700 dark:text-gray-300">
                  {{ $t('artists.allergies') }} :
                  <strong>{{ artist.allergies }}</strong>
                  <UBadge
                    v-if="artist.allergySeverity"
                    :color="
                      getAllergySeverityBadgeColor(artist.allergySeverity as AllergySeverityLevel)
                    "
                    variant="soft"
                    size="md"
                    class="ml-2"
                  >
                    {{
                      $t(
                        getAllergySeverityInfo(artist.allergySeverity as AllergySeverityLevel).label
                      )
                    }}
                  </UBadge>
                </span>
              </div>
            </template>

            <!-- Mode édition -->
            <template v-else>
              <div class="space-y-3">
                <UFormField :label="$t('artists.dietary_preference')">
                  <USelect
                    v-model="dietForm.dietaryPreference"
                    :items="dietaryOptions"
                    value-key="value"
                  />
                </UFormField>

                <UFormField :label="$t('artists.allergies')">
                  <UTextarea
                    v-model="dietForm.allergies"
                    :placeholder="$t('artists.allergies')"
                    :rows="2"
                    autoresize
                  />
                </UFormField>

                <UFormField v-if="dietForm.allergies" :label="$t('artists.allergy_severity')">
                  <USelect
                    v-model="dietForm.allergySeverity"
                    :items="allergySeverityOptions"
                    value-key="value"
                  />
                </UFormField>

                <div class="flex justify-end gap-2">
                  <UButton variant="ghost" color="neutral" size="sm" @click="cancelDietEdit">
                    {{ $t('common.cancel') }}
                  </UButton>
                  <UButton
                    :loading="savingDiet"
                    :disabled="!dietFormDirty"
                    icon="i-heroicons-check"
                    size="sm"
                    @click="saveDiet"
                  >
                    {{ $t('common.save') }}
                  </UButton>
                </div>
              </div>
            </template>
          </div>

          <div v-for="(meals, date) in groupedMeals" :key="date">
            <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 capitalize">
              {{ formatDateFull(date) }}
            </p>
            <div class="flex flex-wrap gap-3">
              <div
                v-for="meal in meals"
                :key="meal.id"
                class="flex flex-col items-center gap-1 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
              >
                <span class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ getMealTypeLabel(meal.meal.mealType) }}
                </span>
                <USwitch
                  :model-value="editableMeals[meal.id] ?? meal.afterShow"
                  :loading="savingMealId === meal.id"
                  :disabled="savingMealId !== null"
                  size="xs"
                  :label="$t('artists.meal_after_show')"
                  @update:model-value="toggleAfterShow(meal, $event)"
                />
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Hébergement -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-home-modern" class="text-blue-500" />
              {{ $t('artists.my_accommodation') }}
            </h2>
            <UButton
              v-if="!editingAccommodation"
              icon="i-heroicons-pencil-square"
              variant="ghost"
              size="xs"
              color="neutral"
              @click="editingAccommodation = true"
            />
          </div>
        </template>

        <div class="space-y-3">
          <!-- Mode lecture -->
          <template v-if="!editingAccommodation">
            <div class="flex items-center gap-2">
              <UIcon
                :name="
                  artist.accommodationAutonomous
                    ? 'i-heroicons-check-circle'
                    : 'i-heroicons-x-circle'
                "
                :class="artist.accommodationAutonomous ? 'text-green-500' : 'text-gray-400'"
              />
              <span class="text-gray-700 dark:text-gray-300">
                {{
                  artist.accommodationAutonomous
                    ? $t('artists.accommodation_autonomous_info')
                    : $t('artists.accommodation_not_autonomous_info')
                }}
              </span>
            </div>

            <div
              v-if="artist.accommodationType"
              class="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
            >
              <div class="flex items-center gap-2 text-sm">
                <UIcon name="i-heroicons-home" class="text-blue-500 shrink-0" />
                <span class="text-gray-700 dark:text-gray-300">
                  <strong>{{ accommodationTypeLabel(artist.accommodationType) }}</strong>
                  <span
                    v-if="artist.accommodationType === 'OTHER' && artist.accommodationTypeOther"
                  >
                    — {{ artist.accommodationTypeOther }}
                  </span>
                </span>
              </div>
            </div>

            <div v-if="artist.accommodationProposal" class="space-y-1">
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
                {{ $t('artists.accommodation_proposal_info') }}
              </p>
              <p
                class="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3"
              >
                {{ artist.accommodationProposal }}
              </p>
            </div>
          </template>

          <!-- Mode édition -->
          <template v-else>
            <div class="space-y-3">
              <USwitch
                v-model="accommodationForm.accommodationAutonomous"
                :label="$t('artists.accommodation_autonomous_info')"
              />

              <template v-if="accommodationForm.accommodationAutonomous">
                <UFormField :label="$t('artists.accommodation_type')">
                  <USelect
                    v-model="accommodationForm.accommodationType"
                    :items="accommodationTypeOptions"
                    value-key="value"
                    :placeholder="$t('artists.accommodation_not_specified')"
                    :ui="{ content: 'min-w-fit' }"
                  />
                </UFormField>

                <UFormField
                  v-if="accommodationForm.accommodationType === 'OTHER'"
                  :label="$t('artists.accommodation_type_other')"
                >
                  <UInput
                    v-model="accommodationForm.accommodationTypeOther"
                    :placeholder="$t('artists.accommodation_type_other_placeholder')"
                  />
                </UFormField>
              </template>

              <div class="flex justify-end gap-2">
                <UButton variant="ghost" color="neutral" size="sm" @click="cancelAccommodationEdit">
                  {{ $t('common.cancel') }}
                </UButton>
                <UButton
                  :loading="savingAccommodation"
                  :disabled="!accommodationFormDirty"
                  icon="i-heroicons-check"
                  size="sm"
                  @click="saveAccommodation"
                >
                  {{ $t('common.save') }}
                </UButton>
              </div>
            </div>
          </template>
        </div>
      </UCard>

      <!-- Transport -->
      <UCard v-if="artist.pickupRequired || artist.dropoffRequired">
        <template #header>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-truck" class="text-teal-500" />
            {{ $t('artists.my_transport') }}
          </h2>
        </template>

        <div class="space-y-3">
          <div v-if="artist.pickupRequired" class="flex items-center gap-2">
            <UIcon name="i-heroicons-arrow-down-tray" class="text-green-500" />
            <span class="text-gray-700 dark:text-gray-300">
              {{
                artist.pickupLocation
                  ? $t('artists.pickup_at', { location: artist.pickupLocation })
                  : $t('artists.pickup_required')
              }}
            </span>
          </div>
          <div v-if="artist.dropoffRequired" class="flex items-center gap-2">
            <UIcon name="i-heroicons-arrow-up-tray" class="text-red-500" />
            <span class="text-gray-700 dark:text-gray-300">
              {{
                artist.dropoffLocation
                  ? $t('artists.dropoff_at', { location: artist.dropoffLocation })
                  : $t('artists.dropoff_required')
              }}
            </span>
          </div>
        </div>
      </UCard>

      <!-- Paiement et défraiement -->
      <UCard v-if="artist.payment !== null || artist.reimbursementMax !== null">
        <template #header>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-banknotes" class="text-emerald-500" />
            {{ $t('artists.my_payment') }}
          </h2>
        </template>

        <div class="space-y-4">
          <!-- Paiement -->
          <div v-if="artist.payment !== null" class="flex items-center justify-between">
            <div class="space-y-1">
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ $t('artists.payment_amount') }}
              </p>
              <p class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ $t('artists.payment_amount_value', { amount: artist.payment }) }}
              </p>
            </div>
            <UBadge :color="artist.paymentPaid ? 'success' : 'warning'" variant="soft">
              {{ artist.paymentPaid ? $t('artists.payment_paid') : $t('artists.payment_pending') }}
            </UBadge>
          </div>

          <!-- Défraiement -->
          <div v-if="artist.reimbursementMax !== null" class="flex items-center justify-between">
            <div class="space-y-1">
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ $t('artists.reimbursement_max') }}
              </p>
              <p class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ $t('artists.payment_amount_value', { amount: artist.reimbursementMax }) }}
                <span
                  v-if="artist.reimbursementActual !== null"
                  class="text-sm font-normal text-gray-500"
                >
                  ({{ $t('artists.reimbursement_actual') }} :
                  {{ $t('artists.payment_amount_value', { amount: artist.reimbursementActual }) }})
                </span>
              </p>
            </div>
            <UBadge :color="artist.reimbursementActualPaid ? 'success' : 'warning'" variant="soft">
              {{
                artist.reimbursementActualPaid
                  ? $t('artists.reimbursement_paid')
                  : $t('artists.reimbursement_pending')
              }}
            </UBadge>
          </div>
        </div>
      </UCard>

      <!-- Facture et cachet -->
      <UCard v-if="artist.invoiceRequested || artist.feeRequested">
        <template #header>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-document-text" class="text-indigo-500" />
            {{ $t('artists.invoice_fee_section') }}
          </h2>
        </template>

        <div class="space-y-3">
          <div v-if="artist.invoiceRequested" class="flex items-center justify-between">
            <span class="text-gray-700 dark:text-gray-300">
              {{ $t('artists.invoice_short') }}
            </span>
            <UBadge :color="artist.invoiceProvided ? 'success' : 'warning'" variant="soft">
              {{
                artist.invoiceProvided
                  ? $t('artists.invoice_provided')
                  : $t('artists.invoice_requested')
              }}
            </UBadge>
          </div>
          <div v-if="artist.feeRequested" class="flex items-center justify-between">
            <span class="text-gray-700 dark:text-gray-300">
              {{ $t('artists.fee_short') }}
            </span>
            <UBadge :color="artist.feeProvided ? 'success' : 'warning'" variant="soft">
              {{ artist.feeProvided ? $t('artists.fee_provided') : $t('artists.fee_requested') }}
            </UBadge>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Modal QR Code -->
    <UModal v-model:open="qrModalOpen" :title="$t('artists.artist_qr_code')">
      <template #body>
        <div v-if="artist" class="space-y-4">
          <div
            class="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
          >
            <div class="flex items-start gap-3">
              <UIcon
                name="i-heroicons-information-circle"
                class="text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5"
              />
              <div class="text-sm text-yellow-700 dark:text-yellow-300">
                <p class="font-medium mb-1">
                  {{ $t('artists.qr_code_instructions_title') }}
                </p>
                <p>{{ $t('artists.qr_code_instructions') }}</p>
              </div>
            </div>
          </div>

          <div class="flex flex-col items-center justify-center p-6">
            <Qrcode :value="artist.qrCode" variant="default" />
            <p class="mt-3 text-xs text-gray-500 dark:text-gray-400 font-mono">
              {{ artist.qrCode }}
            </p>
          </div>

          <div class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div class="space-y-2 text-sm">
              <div class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <UIcon name="i-heroicons-user" class="w-4 h-4" />
                <span>{{ artist.firstName }} {{ artist.lastName }}</span>
              </div>
              <div
                v-if="artist.shows.length > 0"
                class="flex items-start gap-2 text-gray-600 dark:text-gray-400"
              >
                <UIcon name="i-heroicons-sparkles" class="w-4 h-4 mt-0.5" />
                <div class="flex flex-wrap gap-1">
                  <span v-for="(show, index) in artist.shows" :key="show.id">
                    {{ show.title }}<span v-if="index < artist.shows.length - 1">,&nbsp;</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { useEditionStore } from '~/stores/editions'
import type { Edition } from '~/types'
import {
  getAccommodationTypeLabel,
  getAccommodationTypeSelectOptions,
} from '~/utils/accommodation-type'
import type { AllergySeverityLevel } from '~/utils/allergy-severity'
import { getEditionDisplayName } from '~/utils/editionName'

interface ArtistShow {
  id: number
  title: string
  description: string | null
  startDateTime: string
  duration: number | null
  location: string | null
}

interface MealSelection {
  id: number
  afterShow: boolean
  meal: {
    id: number
    date: string
    mealType: string
  }
}

interface ArtistInfo {
  id: number
  firstName: string
  lastName: string
  email: string
  qrCode: string
  arrivalDateTime: string | null
  departureDateTime: string | null
  dietaryPreference: string
  allergies: string | null
  allergySeverity: string | null
  payment: number | null
  paymentPaid: boolean
  reimbursementMax: number | null
  reimbursementActual: number | null
  reimbursementActualPaid: boolean
  accommodationAutonomous: boolean
  accommodationType: string | null
  accommodationTypeOther: string | null
  accommodationProposal: string | null
  pickupRequired: boolean
  pickupLocation: string | null
  dropoffRequired: boolean
  dropoffLocation: string | null
  invoiceRequested: boolean
  invoiceProvided: boolean
  feeRequested: boolean
  feeProvided: boolean
  shows: ArtistShow[]
  mealSelections: MealSelection[]
}

const route = useRoute()
const editionStore = useEditionStore()
const { t } = useI18n()
const toast = useToast()
const { formatDateTime, formatDateFull } = useDateFormat()
const { getMealTypeLabel } = useMealTypeLabel()

const editionId = parseInt(route.params.id as string)

// Charger l'édition
const {
  data: edition,
  pending: _editionLoading,
  error: _editionError,
} = await useFetch<Edition>(`/api/editions/${editionId}`)

// Synchroniser avec le store
watch(
  edition,
  (newEdition) => {
    if (newEdition) {
      editionStore.setEdition(newEdition)
    }
  },
  { immediate: true }
)

// Charger les données artiste
const { data: artistResponse, pending: loading } = await useFetch<{ artist: ArtistInfo | null }>(
  `/api/editions/${editionId}/my-artist-info`
)

const artist = computed(() => artistResponse.value?.artist ?? null)

// Redirection si pas artiste
watch(
  artist,
  (value) => {
    if (value === null && !loading.value) {
      navigateTo(`/editions/${editionId}`)
    }
  },
  { immediate: true }
)

// QR Code modal
const qrModalOpen = ref(false)

// Helper pour le label du type d'hébergement
const accommodationTypeLabel = (type: string) => getAccommodationTypeLabel(type, t)

// Formulaire hébergement
const editingAccommodation = ref(false)

const accommodationForm = reactive({
  accommodationAutonomous: artist.value?.accommodationAutonomous ?? false,
  accommodationType: artist.value?.accommodationType ?? (null as string | null),
  accommodationTypeOther: artist.value?.accommodationTypeOther ?? '',
})

const accommodationTypeOptions = computed(() => getAccommodationTypeSelectOptions(t))

watch(artist, (newArtist) => {
  if (newArtist && !editingAccommodation.value) {
    accommodationForm.accommodationAutonomous = newArtist.accommodationAutonomous
    accommodationForm.accommodationType = newArtist.accommodationType ?? null
    accommodationForm.accommodationTypeOther = newArtist.accommodationTypeOther ?? ''
  }
})

const accommodationFormDirty = computed(() => {
  if (!artist.value) return false
  return (
    accommodationForm.accommodationAutonomous !== artist.value.accommodationAutonomous ||
    accommodationForm.accommodationType !== (artist.value.accommodationType ?? null) ||
    (accommodationForm.accommodationType === 'OTHER' &&
      (accommodationForm.accommodationTypeOther || '') !==
        (artist.value.accommodationTypeOther || ''))
  )
})

const { execute: saveAccommodation, loading: savingAccommodation } = useApiAction<
  unknown,
  {
    success: boolean
    accommodationAutonomous: boolean
    accommodationType: string | null
    accommodationTypeOther: string | null
  }
>(() => `/api/editions/${editionId}/my-accommodation`, {
  method: 'PUT',
  body: () => ({
    accommodationAutonomous: accommodationForm.accommodationAutonomous,
    accommodationType: accommodationForm.accommodationAutonomous
      ? accommodationForm.accommodationType || null
      : null,
    accommodationTypeOther:
      accommodationForm.accommodationAutonomous && accommodationForm.accommodationType === 'OTHER'
        ? accommodationForm.accommodationTypeOther || null
        : null,
  }),
  successMessage: { title: t('artists.accommodation_saved') },
  errorMessages: { default: t('artists.accommodation_save_error') },
  onSuccess: (response) => {
    if (response && artistResponse.value?.artist) {
      artistResponse.value = {
        ...artistResponse.value,
        artist: {
          ...artistResponse.value.artist,
          accommodationAutonomous: response.accommodationAutonomous,
          accommodationType: response.accommodationType,
          accommodationTypeOther: response.accommodationTypeOther,
        },
      }
    }
    editingAccommodation.value = false
  },
})

const cancelAccommodationEdit = () => {
  if (artist.value) {
    accommodationForm.accommodationAutonomous = artist.value.accommodationAutonomous
    accommodationForm.accommodationType = artist.value.accommodationType ?? null
    accommodationForm.accommodationTypeOther = artist.value.accommodationTypeOther ?? ''
  }
  editingAccommodation.value = false
}

// Formulaire régime alimentaire / allergies
const editingDiet = ref(false)

const dietForm = reactive({
  dietaryPreference: artist.value?.dietaryPreference ?? 'NONE',
  allergies: artist.value?.allergies ?? '',
  allergySeverity: artist.value?.allergySeverity ?? (null as string | null),
})

// Synchroniser le formulaire quand les données artiste changent (chargement initial)
watch(artist, (newArtist) => {
  if (newArtist && !editingDiet.value) {
    dietForm.dietaryPreference = newArtist.dietaryPreference
    dietForm.allergies = newArtist.allergies ?? ''
    dietForm.allergySeverity = newArtist.allergySeverity
  }
})

const dietFormDirty = computed(() => {
  if (!artist.value) return false
  return (
    dietForm.dietaryPreference !== artist.value.dietaryPreference ||
    (dietForm.allergies || '') !== (artist.value.allergies || '') ||
    dietForm.allergySeverity !== artist.value.allergySeverity
  )
})

const dietaryOptions = computed(() => [
  { label: t('diet.none'), value: 'NONE' },
  { label: t('diet.vegetarian'), value: 'VEGETARIAN' },
  { label: t('diet.vegan'), value: 'VEGAN' },
])

const allergySeverityOptions = computed(() =>
  getAllergySeveritySelectOptions().map((option) => ({
    value: option.value,
    label: t(option.label),
  }))
)

const savingDiet = ref(false)

const saveDiet = async () => {
  savingDiet.value = true
  try {
    const response = await $fetch<{
      success: boolean
      dietaryPreference: string
      allergies: string | null
      allergySeverity: string | null
    }>(`/api/editions/${editionId}/my-diet`, {
      method: 'PUT',
      body: {
        dietaryPreference: dietForm.dietaryPreference,
        allergies: dietForm.allergies || null,
        allergySeverity: dietForm.allergies ? dietForm.allergySeverity : null,
      },
    })

    if (response.success && artistResponse.value?.artist) {
      artistResponse.value = {
        ...artistResponse.value,
        artist: {
          ...artistResponse.value.artist,
          dietaryPreference: response.dietaryPreference,
          allergies: response.allergies,
          allergySeverity: response.allergySeverity,
        },
      }
      toast.add({
        title: t('artists.diet_saved'),
        color: 'success',
      })
      editingDiet.value = false
    }
  } catch {
    toast.add({
      title: t('common.error'),
      description: t('artists.diet_save_error'),
      color: 'error',
    })
  } finally {
    savingDiet.value = false
  }
}

const cancelDietEdit = () => {
  if (artist.value) {
    dietForm.dietaryPreference = artist.value.dietaryPreference
    dietForm.allergies = artist.value.allergies ?? ''
    dietForm.allergySeverity = artist.value.allergySeverity
  }
  editingDiet.value = false
}

// État local pour les modifications de repas
const editableMeals = ref<Record<number, boolean>>({})
const savingMealId = ref<number | null>(null)

const toggleAfterShow = async (meal: MealSelection, newValue: boolean) => {
  editableMeals.value[meal.id] = newValue
  savingMealId.value = meal.id

  try {
    const response = await $fetch<{ success: boolean; mealSelections: MealSelection[] }>(
      `/api/editions/${editionId}/my-meals`,
      {
        method: 'PUT',
        body: {
          selections: [{ selectionId: meal.id, afterShow: newValue }],
        },
      }
    )

    if (response.success && artistResponse.value?.artist) {
      artistResponse.value = {
        ...artistResponse.value,
        artist: {
          ...artistResponse.value.artist,
          mealSelections: response.mealSelections,
        },
      }
      editableMeals.value = {}
    }
  } catch {
    // Annuler le changement local en cas d'erreur
    const { [meal.id]: _, ...rest } = editableMeals.value
    editableMeals.value = rest
    toast.add({
      title: t('common.error'),
      description: t('artists.meals.error_saving'),
      color: 'error',
    })
  } finally {
    savingMealId.value = null
  }
}

// Grouper les repas par date
const groupedMeals = computed(() => {
  if (!artist.value?.mealSelections) return {}
  const groups: Record<string, MealSelection[]> = {}
  for (const ms of artist.value.mealSelections) {
    const date = ms.meal.date
    if (!groups[date]) groups[date] = []
    groups[date].push(ms)
  }
  return groups
})

// SEO
const editionName = computed(() => (edition.value ? getEditionDisplayName(edition.value) : ''))
useSeoMeta({
  title: computed(() => `${t('artists.artist_space_title')} - ${editionName.value}`),
})
</script>
