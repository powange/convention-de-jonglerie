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
            <div class="relative">
              <UInput
                v-model="form.locationCity"
                :placeholder="locationLabels.cityPlaceholder"
                icon="i-heroicons-map-pin"
                size="lg"
                class="w-full"
              />
              <div
                v-if="showDepartureSuggestions && departureSuggestions.length > 0"
                class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
              >
                <button
                  v-for="suggestion in departureSuggestions"
                  :key="suggestion.id"
                  type="button"
                  class="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                  @click="selectSuggestion('locationCity', suggestion)"
                >
                  <div class="font-medium text-gray-900 dark:text-gray-100">
                    {{ suggestion.name }}
                  </div>
                  <div class="text-sm text-gray-500 dark:text-gray-400">
                    {{ suggestion.city }}, {{ suggestion.country }}
                  </div>
                </button>
              </div>
            </div>
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

        <!-- Options supplémentaires -->
        <div class="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
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
              v-if="formType === 'offer'"
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
              {{ loading ? $t('common.creating') : $t('common.create') }}
            </UButton>
          </div>
        </div>
      </div>
    </UForm>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { z } from 'zod'

interface Props {
  formType: 'offer' | 'request'
  editionId: string
  initialData?: any
}

const props = defineProps<Props>()
const emit = defineEmits(['submit', 'cancel'])

const { $api } = useNuxtApp()
const toast = useToast()
const { t, locale } = useI18n()

// État du formulaire
const loading = ref(false)
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

// Suggestions d'adresses
const departureSuggestions = ref<any[]>([])
const showDepartureSuggestions = ref(false)

// Schéma de validation
const baseSchema = z.object({
  locationCity: z.string().min(1, t('carpool.validation.departure_city_required')),
  tripDate: z.date({
    required_error: t('carpool.validation.date_required'),
    invalid_type_error: t('carpool.validation.date_invalid'),
  }),
  direction: z.enum(['TO_EVENT', 'FROM_EVENT'], {
    required_error: t('carpool.validation.direction_required'),
    invalid_type_error: t('carpool.validation.direction_invalid'),
  }),
  description: z.string().optional(),
  phoneNumber: z.string().optional(),
  smokingAllowed: z.boolean().optional(),
  petsAllowed: z.boolean().optional(),
})

const schema = computed(() => {
  if (props.formType === 'offer') {
    return baseSchema.extend({
      locationAddress: z.string().min(1, t('carpool.validation.departure_address_required')),
      availableSeats: z
        .number()
        .min(1, t('carpool.validation.seats_min'))
        .max(8, t('carpool.validation.seats_max')),
      musicAllowed: z.boolean().optional(),
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

// Recherche de suggestions d'adresses
const fetchSuggestions = useDebounceFn(async (_field: 'locationCity', query: string) => {
  if (!query || query.length < 3) {
    departureSuggestions.value = []
    showDepartureSuggestions.value = false
    return
  }

  try {
    // Utiliser la locale actuelle pour l'API Nominatim
    const currentLocale = locale.value || 'fr'
    // Privilégier les résultats en Europe (vous pouvez ajuster selon vos besoins)
    const countryCodes = 'fr,be,ch,de,es,it,nl,gb,lu'
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&accept-language=${currentLocale}&countrycodes=${countryCodes}&addressdetails=1&featuretype=settlement&class=place&type=city,town,village`
    )
    const data = await response.json()

    // Filtrer uniquement les résultats avec addresstype = "city", "town" ou "village"
    const filteredData = data.filter((item: any) =>
      ['city', 'town', 'village'].includes(item.addresstype)
    )

    const suggestions = filteredData.map((item: any) => ({
      id: item.place_id,
      name: item.display_name.split(',')[0],
      city: item.display_name.split(',')[1]?.trim() || '',
      country: item.display_name.split(',').slice(-1)[0]?.trim() || '',
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      fullAddress: item.display_name,
    }))

    departureSuggestions.value = suggestions
    showDepartureSuggestions.value = true
  } catch (error) {
    console.error("Erreur lors de la recherche d'adresses:", error)
  }
}, 300)

// Sélection d'une suggestion
const selectSuggestion = (_field: 'locationCity', suggestion: any) => {
  form.locationCity = suggestion.name
  form.departureCoordinates = { lat: suggestion.lat, lon: suggestion.lon }
  showDepartureSuggestions.value = false
}

// Soumission du formulaire
const onSubmit = async () => {
  loading.value = true

  try {
    const endpoint =
      props.formType === 'offer'
        ? `/api/editions/${props.editionId}/carpool-offers`
        : `/api/editions/${props.editionId}/carpool-requests`

    const payload = {
      ...form,
      editionId: props.editionId,
    }

    // Nettoyer les champs non pertinents
    if (props.formType === 'offer') {
      delete payload.seatsNeeded
    } else {
      delete payload.availableSeats
      delete payload.musicAllowed
    }

    const response = await $api(endpoint, {
      method: 'POST',
      body: payload,
    })

    toast.add({
      title: t('common.success'),
      description:
        props.formType === 'offer' ? t('carpool.offer.created') : t('carpool.request.created'),
      color: 'success',
    })

    emit('submit', response)
  } catch (error: any) {
    console.error('Erreur lors de la création:', error)
    toast.add({
      title: t('common.error'),
      description: error.data?.message || t('errors.generic'),
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

// Watcher pour l'autocomplete de la ville
watch(
  () => form.locationCity,
  (newValue) => {
    fetchSuggestions('locationCity', newValue)
  }
)

// Fermer les suggestions lors d'un clic en dehors
onMounted(() => {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('[name="locationCity"]')) {
      showDepartureSuggestions.value = false
    }
  })
})
</script>
