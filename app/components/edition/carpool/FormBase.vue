<template>
  <div class="space-y-6">
    <UForm :state="form" :schema="schema" @submit="onSubmit">
      <!-- Section Trajet -->
      <div class="space-y-6">
        <div>
          <h3 class="text-lg font-medium flex items-center gap-2 mb-4">
            <UIcon name="i-heroicons-map" class="text-primary-500" />
            {{ $t('carpool.route') }}
          </h3>

          <!-- Direction du trajet avec description -->
          <UFormField
            :label="$t('carpool.direction.label')"
            name="direction"
            :required="true"
            :description="$t('carpool.direction.description')"
          >
            <USelect
              v-model="form.direction"
              :items="directionOptions"
              :placeholder="$t('carpool.select_direction')"
              color="primary"
              size="lg"
              class="w-full"
            >
              <template #leading>
                <UIcon
                  :name="
                    form.direction === 'TO_EVENT'
                      ? 'i-heroicons-arrow-right'
                      : 'i-heroicons-arrow-left'
                  "
                  class="text-primary-500"
                />
              </template>
            </USelect>
          </UFormField>
        </div>

        <!-- Section Localisation -->
        <div class="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg space-y-4">
          <h4 class="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <UIcon name="i-heroicons-map-pin" class="text-primary-500" />
            {{ locationLabels.sectionTitle }}
          </h4>

          <!-- Ville de départ/arrivée -->
          <UFormField
            :label="locationLabels.cityLabel"
            name="locationCity"
            :required="true"
            :description="locationLabels.cityHint"
          >
            <UInputMenu
              v-model="selectedCity"
              v-model:search-term="searchTerm"
              :items="citySuggestions"
              :loading="loadingSuggestions"
              :placeholder="locationLabels.cityPlaceholder"
              icon="i-heroicons-map-pin"
              size="lg"
              class="w-full"
              ignore-filter
              label-key="name"
            >
              <template #item-label="{ item }">
                <div>
                  <div class="font-medium">{{ item.name }}</div>
                  <div class="text-sm text-gray-500 dark:text-gray-400">
                    {{ item.city }}, {{ item.country }}
                  </div>
                </div>
              </template>
              <template #empty>
                <div class="text-center py-2 text-sm text-gray-500">
                  {{
                    searchTerm.length < 3
                      ? $t('carpool.type_at_least_3_chars')
                      : $t('carpool.no_city_found')
                  }}
                </div>
              </template>
            </UInputMenu>
          </UFormField>

          <!-- Adresse précise (pour les offres seulement) -->
          <UFormField
            v-if="formType === 'offer'"
            :label="locationLabels.addressLabel"
            name="locationAddress"
            :required="true"
            :description="locationLabels.addressDescription"
          >
            <UInput
              v-model="form.locationAddress"
              :placeholder="locationLabels.addressPlaceholder"
              icon="i-heroicons-home"
              size="lg"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Section Détails du voyage -->
        <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-4">
          <h4 class="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <UIcon name="i-heroicons-clock" class="text-primary-500" />
            {{ $t('carpool.trip_details') }}
          </h4>

          <!-- Date et heure de départ -->
          <UFormField
            :label="$t('components.carpool.departure_date_time')"
            name="tripDate"
            :required="true"
            :description="$t('carpool.departure_date_description')"
          >
            <UiDateTimePicker
              v-model="form.tripDate"
              :min-date="new Date()"
              :placeholder="$t('carpool.select_date_time')"
              size="lg"
            />
          </UFormField>

          <!-- Nombre de places pour les offres (sur ligne séparée) -->
          <UFormField
            v-if="formType === 'offer'"
            :label="$t('carpool.offer.available_seats')"
            name="availableSeats"
            :required="true"
            :description="$t('carpool.offer.seats_description')"
            class="mt-4"
          >
            <UInput
              v-model.number="form.availableSeats"
              type="number"
              min="1"
              max="8"
              :placeholder="$t('carpool.offer.seats_placeholder')"
              icon="i-heroicons-user-group"
              size="lg"
              class="max-w-xs"
            />
          </UFormField>

          <!-- Nombre de places pour les demandes (sur ligne séparée) -->
          <UFormField
            v-if="formType === 'request'"
            :label="$t('carpool.request.required_seats')"
            name="seatsNeeded"
            :required="true"
            :description="$t('carpool.request.seats_description')"
            class="mt-4"
          >
            <UInput
              v-model.number="form.seatsNeeded"
              type="number"
              min="1"
              max="8"
              :placeholder="$t('carpool.request.seats_placeholder')"
              icon="i-heroicons-user-group"
              size="lg"
              class="max-w-xs"
            />
          </UFormField>
        </div>

        <!-- Section Contact -->
        <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg space-y-4">
          <h4 class="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <UIcon name="i-heroicons-phone" class="text-primary-500" />
            {{ $t('carpool.contact') }}
          </h4>

          <!-- Numéro de téléphone (pleine largeur) -->
          <UFormField
            :label="$t('carpool.phone_number')"
            name="phoneNumber"
            :description="$t('carpool.phone_description')"
          >
            <UInput
              v-model="form.phoneNumber"
              :placeholder="$t('carpool.phone_placeholder')"
              icon="i-heroicons-phone"
              type="tel"
              size="lg"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Options supplémentaires (uniquement pour les offres) -->
        <div v-if="formType === 'offer'" class="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
          <h4 class="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
            <UIcon name="i-heroicons-adjustments-horizontal" class="text-primary-500" />
            {{ $t('carpool.preferences') }}
          </h4>

          <div class="space-y-3">
            <USwitch
              v-model="form.smokingAllowed"
              :label="$t('carpool.smoking_allowed')"
              :description="$t('carpool.smoking_description')"
              size="lg"
            />

            <USwitch
              v-model="form.petsAllowed"
              :label="$t('carpool.pets_allowed')"
              :description="$t('carpool.pets_description')"
              size="lg"
            />

            <USwitch
              v-model="form.musicAllowed"
              :label="$t('carpool.music_allowed')"
              :description="$t('carpool.music_description')"
              size="lg"
            />
          </div>
        </div>

        <!-- Description / Détails (en pleine largeur à la fin) -->
        <div class="space-y-2">
          <UFormField
            :label="$t('carpool.details')"
            name="description"
            :description="$t('carpool.details_description')"
          >
            <UTextarea
              v-model="form.description"
              :placeholder="$t('carpool.details_placeholder')"
              :rows="4"
              size="lg"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Boutons -->
        <div
          class="flex justify-between items-center gap-4 pt-6 border-t border-gray-200 dark:border-gray-700"
        >
          <div class="text-sm text-gray-500 dark:text-gray-400">
            <UIcon name="i-heroicons-information-circle" class="inline mr-1" />
            {{ $t('carpool.form_help_text') }}
          </div>

          <div class="flex gap-3">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              size="lg"
              @click="$emit('cancel')"
            >
              {{ $t('common.cancel') }}
            </UButton>

            <UButton
              type="submit"
              :loading="loading"
              :disabled="!isFormValid"
              size="lg"
              icon="i-heroicons-paper-airplane"
            >
              {{
                loading ? $t('common.saving') : isEditing ? $t('common.save') : $t('common.create')
              }}
            </UButton>
          </div>
        </div>
      </div>
    </UForm>
  </div>
</template>

<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import { watch } from 'vue'
import { z } from 'zod'

interface Props {
  formType: 'offer' | 'request'
  editionId: string
  initialData?: any
  isEditing?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['success', 'cancel'])

const { t, locale } = useI18n()

// État du formulaire
const form = reactive({
  locationCity: props.initialData?.locationCity || '',
  locationAddress: props.initialData?.locationAddress || '',
  departureCoordinates: props.initialData?.departureCoordinates || null,
  tripDate: props.initialData?.tripDate || null,
  direction: props.initialData?.direction || 'TO_EVENT',
  availableSeats: props.initialData?.availableSeats || (props.formType === 'offer' ? 1 : undefined),
  seatsNeeded: props.initialData?.seatsNeeded || (props.formType === 'request' ? 1 : undefined),
  description: props.initialData?.description || '',
  phoneNumber: props.initialData?.phoneNumber || '',
  smokingAllowed: props.initialData?.smokingAllowed || false,
  petsAllowed: props.initialData?.petsAllowed || false,
  musicAllowed: props.initialData?.musicAllowed || false,
})

// Options pour la direction du trajet
const directionOptions = computed(() => [
  {
    value: 'TO_EVENT',
    label: t('carpool.direction.to_event'),
  },
  {
    value: 'FROM_EVENT',
    label: t('carpool.direction.from_event'),
  },
])

// Labels dynamiques selon la direction
const locationLabels = computed(() => {
  const isToEvent = form.direction === 'TO_EVENT'
  return {
    sectionTitle:
      props.formType === 'offer'
        ? isToEvent
          ? t('carpool.pickup_location')
          : t('carpool.meeting_location')
        : isToEvent
          ? t('carpool.departure_location')
          : t('carpool.dropoff_location'),
    cityLabel: isToEvent ? t('carpool.departure_city') : t('carpool.arrival_city'),
    cityHint: isToEvent ? t('carpool.departure_city_hint') : t('carpool.arrival_city_hint'),
    cityPlaceholder: isToEvent
      ? t('carpool.departure_city_placeholder')
      : t('carpool.arrival_city_placeholder'),
    addressLabel: isToEvent ? t('carpool.departure_address') : t('carpool.arrival_address'),
    addressDescription: isToEvent
      ? t('carpool.departure_address_description')
      : t('carpool.arrival_address_description'),
    addressPlaceholder: isToEvent
      ? t('carpool.departure_address_placeholder')
      : t('carpool.arrival_address_placeholder'),
  }
})

// Suggestions d'adresses - pour UInputMenu
const searchTerm = ref('')
const searchTermDebounced = refDebounced(searchTerm, 300)
const selectedCity = ref<any>(null)

// Schéma de validation
const baseSchema = z.object({
  locationCity: z.string().min(1, t('carpool.validation.departure_city_required')),
  tripDate: z
    .union([z.date(), z.string().transform((val) => new Date(val))])
    .refine((date) => date instanceof Date && !isNaN(date.getTime()), {
      message: t('carpool.validation.date_invalid'),
    }),
  direction: z.enum(['TO_EVENT', 'FROM_EVENT']),
  description: z.string().optional(),
  phoneNumber: z.string().optional(),
  smokingAllowed: z.boolean().optional(),
  petsAllowed: z.boolean().optional(),
  musicAllowed: z.boolean().optional(),
})

const schema = computed(() => {
  if (props.formType === 'offer') {
    return baseSchema.extend({
      locationAddress: z.string().min(1, t('carpool.validation.departure_address_required')),
      availableSeats: z
        .number()
        .min(1, t('carpool.validation.seats_min'))
        .max(8, t('carpool.validation.seats_max')),
    })
  } else {
    return baseSchema.extend({
      seatsNeeded: z
        .number()
        .min(1, t('carpool.validation.seats_min'))
        .max(8, t('carpool.validation.seats_max')),
    })
  }
})

// Vérification de validité du formulaire
const isFormValid = computed(() => {
  try {
    schema.value.parse(form)
    return true
  } catch {
    return false
  }
})

// Construire le payload pour l'API
const buildPayload = () => {
  const payload: Record<string, unknown> = {
    ...form,
    editionId: props.editionId,
  }

  // Nettoyer les champs non pertinents
  if (props.formType === 'offer') {
    delete payload.seatsNeeded
  } else {
    delete payload.availableSeats
    delete payload.locationAddress
    delete payload.smokingAllowed
    delete payload.petsAllowed
    delete payload.musicAllowed
  }

  return payload
}

// Callback commun après succès
const onSuccess = (response: unknown) => {
  emit('success', response)
}

// Messages de succès dynamiques
const getSuccessMessage = () => {
  if (props.isEditing) {
    return props.formType === 'offer' ? t('carpool.offer.updated') : t('carpool.request.updated')
  }
  return props.formType === 'offer' ? t('carpool.offer.created') : t('carpool.request.created')
}

// Action pour créer une offre/demande
const { execute: executeCreate, loading: isCreating } = useApiAction(
  () =>
    props.formType === 'offer'
      ? `/api/editions/${props.editionId}/carpool-offers`
      : `/api/editions/${props.editionId}/carpool-requests`,
  {
    method: 'POST',
    body: buildPayload,
    successMessage: { title: getSuccessMessage() },
    errorMessages: { default: t('errors.generic') },
    onSuccess,
  }
)

// Action pour mettre à jour une offre/demande
const { execute: executeUpdate, loading: isUpdating } = useApiAction(
  () =>
    props.formType === 'offer'
      ? `/api/carpool-offers/${props.initialData?.id}`
      : `/api/carpool-requests/${props.initialData?.id}`,
  {
    method: 'PUT',
    body: buildPayload,
    successMessage: { title: getSuccessMessage() },
    errorMessages: { default: t('errors.generic') },
    onSuccess,
  }
)

// État de chargement combiné
const loading = computed(() => isCreating.value || isUpdating.value)

// Utilisation de $fetch dans un watcher pour récupérer les suggestions
const citySuggestions = ref<any[]>([])
const loadingSuggestions = ref(false)

watch(searchTermDebounced, async (query) => {
  if (!query || query.length < 3) {
    citySuggestions.value = []
    return
  }

  loadingSuggestions.value = true

  try {
    const currentLocale = locale.value || 'fr'
    const countryCodes = 'fr,be,ch,de,es,it,nl,gb,lu'

    const data = await $fetch<any[]>(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&accept-language=${currentLocale}&countrycodes=${countryCodes}&addressdetails=1&featuretype=settlement&class=place&type=city,town,village`
    )

    if (!data) {
      citySuggestions.value = []
      return
    }

    // Filtrer uniquement les résultats avec addresstype = "city", "town" ou "village"
    const filteredData = data.filter((item: any) =>
      ['city', 'town', 'village'].includes(item.addresstype)
    )

    citySuggestions.value = filteredData.map((item: any) => ({
      id: item.place_id,
      name: item.display_name.split(',')[0],
      city: item.display_name.split(',')[1]?.trim() || '',
      country: item.display_name.split(',').slice(-1)[0]?.trim() || '',
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      fullAddress: item.display_name,
    }))
  } catch (error) {
    console.error("Erreur lors de la recherche d'adresses:", error)
    citySuggestions.value = []
  } finally {
    loadingSuggestions.value = false
  }
})

// Soumission du formulaire
const onSubmit = () => {
  if (props.isEditing) {
    executeUpdate()
  } else {
    executeCreate()
  }
}

// Watcher pour la sélection d'une ville
watch(selectedCity, (newCity) => {
  if (newCity) {
    form.locationCity = newCity.name
    form.departureCoordinates = { lat: newCity.lat, lon: newCity.lon }
  }
})

// Initialiser selectedCity si on édite
onMounted(() => {
  if (props.initialData?.locationCity) {
    selectedCity.value = {
      name: props.initialData.locationCity,
      lat: props.initialData.departureCoordinates?.lat,
      lon: props.initialData.departureCoordinates?.lon,
    }
    searchTerm.value = props.initialData.locationCity
  }
})
</script>
