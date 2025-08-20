<template>
  <div class="space-y-6">
    <h2 class="text-xl font-semibold">
      {{ formType === 'offer' ? $t('carpool.offer.create') : $t('carpool.request.create') }}
    </h2>

    <UForm :state="form" :schema="schema" @submit="onSubmit">
      <!-- Section Trajet -->
      <div class="space-y-4">
        <h3 class="text-lg font-medium">{{ $t('carpool.route') }}</h3>
        
        <div class="grid gap-4 md:grid-cols-2">
          <UFormGroup 
            :label="$t('carpool.from')"
            name="departure"
            :required="true"
          >
            <div class="relative">
              <UInput 
                v-model="form.departure" 
                :placeholder="$t('carpool.departure_placeholder')"
                icon="i-heroicons-map-pin"
                @input="fetchSuggestions('departure', $event)"
              />
              <div
v-if="showDepartureSuggestions && departureSuggestions.length > 0" 
                   class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                <button
                  v-for="suggestion in departureSuggestions"
                  :key="suggestion.id"
                  type="button"
                  class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  @click="selectSuggestion('departure', suggestion)"
                >
                  <div class="font-medium">{{ suggestion.name }}</div>
                  <div class="text-sm text-gray-500">{{ suggestion.city }}, {{ suggestion.country }}</div>
                </button>
              </div>
            </div>
          </UFormGroup>

          <UFormGroup 
            :label="$t('carpool.to')"
            name="arrival"
            :required="true"
          >
            <div class="relative">
              <UInput 
                v-model="form.arrival" 
                :placeholder="$t('carpool.arrival_placeholder')"
                icon="i-heroicons-flag"
                @input="fetchSuggestions('arrival', $event)"
              />
              <div
v-if="showArrivalSuggestions && arrivalSuggestions.length > 0" 
                   class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                <button
                  v-for="suggestion in arrivalSuggestions"
                  :key="suggestion.id"
                  type="button"
                  class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  @click="selectSuggestion('arrival', suggestion)"
                >
                  <div class="font-medium">{{ suggestion.name }}</div>
                  <div class="text-sm text-gray-500">{{ suggestion.city }}, {{ suggestion.country }}</div>
                </button>
              </div>
            </div>
          </UFormGroup>
        </div>

        <!-- Date et Heure -->
        <div class="grid gap-4 md:grid-cols-2">
          <UFormGroup 
            :label="$t('components.carpool.departure_date_time')"
            name="departureDate"
            :required="true"
          >
            <DateTimePicker
              v-model="form.departureDate"
              :min-date="new Date()"
              :placeholder="$t('carpool.select_date_time')"
            />
          </UFormGroup>

          <UFormGroup 
            v-if="formType === 'offer'"
            :label="$t('carpool.offer.available_seats')"
            name="availableSeats"
            :required="true"
          >
            <UInput 
              v-model.number="form.availableSeats" 
              type="number"
              min="1"
              max="8"
              :placeholder="$t('carpool.offer.seats_placeholder')"
              icon="i-heroicons-user-group"
            />
          </UFormGroup>

          <UFormGroup 
            v-else
            :label="$t('carpool.request.required_seats')"
            name="requiredSeats"
            :required="true"
          >
            <UInput 
              v-model.number="form.requiredSeats" 
              type="number"
              min="1"
              max="8"
              :placeholder="$t('carpool.request.seats_placeholder')"
              icon="i-heroicons-user-group"
            />
          </UFormGroup>
        </div>

        <!-- Prix (pour les offres) -->
        <UFormGroup 
          v-if="formType === 'offer'"
          :label="$t('carpool.offer.price_per_seat')"
          name="pricePerSeat"
        >
          <UInput 
            v-model.number="form.pricePerSeat" 
            type="number"
            min="0"
            step="0.01"
            :placeholder="$t('carpool.offer.price_placeholder')"
            icon="i-heroicons-currency-euro"
          />
        </UFormGroup>

        <!-- Description -->
        <UFormGroup 
          :label="$t('carpool.details')"
          name="description"
        >
          <UTextarea 
            v-model="form.description" 
            :placeholder="$t('carpool.details_placeholder')"
            :rows="4"
          />
        </UFormGroup>

        <!-- Options supplémentaires -->
        <div class="space-y-3">
          <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ $t('carpool.options') }}
          </h4>
          
          <UCheckbox 
            v-model="form.smokingAllowed"
            :label="$t('carpool.smoking_allowed')"
          />
          
          <UCheckbox 
            v-model="form.petsAllowed"
            :label="$t('carpool.pets_allowed')"
          />
          
          <UCheckbox 
            v-if="formType === 'offer'"
            v-model="form.musicAllowed"
            :label="$t('carpool.music_allowed')"
          />
        </div>

        <!-- Boutons -->
        <div class="flex justify-end gap-4 pt-4">
          <UButton 
            type="button"
            color="gray" 
            variant="ghost" 
            @click="$emit('cancel')"
          >
            {{ $t('common.cancel') }}
          </UButton>
          
          <UButton 
            type="submit"
            :loading="loading"
            :disabled="!isFormValid"
          >
            {{ $t('common.create') }}
          </UButton>
        </div>
      </div>
    </UForm>
  </div>
</template>

<script setup lang="ts">
import { z } from 'zod'
import DateTimePicker from '~/components/ui/DateTimePicker.vue'

interface Props {
  formType: 'offer' | 'request'
  editionId: string
  initialData?: any
}

const props = defineProps<Props>()
const emit = defineEmits(['submit', 'cancel'])

const { $api } = useNuxtApp()
const toast = useToast()
const { t } = useI18n()

// État du formulaire
const loading = ref(false)
const form = reactive({
  departure: props.initialData?.departure || '',
  departureCoordinates: props.initialData?.departureCoordinates || null,
  arrival: props.initialData?.arrival || '',
  arrivalCoordinates: props.initialData?.arrivalCoordinates || null,
  departureDate: props.initialData?.departureDate || null,
  availableSeats: props.initialData?.availableSeats || (props.formType === 'offer' ? 1 : undefined),
  requiredSeats: props.initialData?.requiredSeats || (props.formType === 'request' ? 1 : undefined),
  pricePerSeat: props.initialData?.pricePerSeat || null,
  description: props.initialData?.description || '',
  smokingAllowed: props.initialData?.smokingAllowed || false,
  petsAllowed: props.initialData?.petsAllowed || false,
  musicAllowed: props.initialData?.musicAllowed || false
})

// Suggestions d'adresses
const departureSuggestions = ref<any[]>([])
const arrivalSuggestions = ref<any[]>([])
const showDepartureSuggestions = ref(false)
const showArrivalSuggestions = ref(false)

// Schéma de validation
const baseSchema = z.object({
  departure: z.string().min(1, t('carpool.validation.departure_required')),
  arrival: z.string().min(1, t('carpool.validation.arrival_required')),
  departureDate: z.date({
    required_error: t('carpool.validation.date_required'),
    invalid_type_error: t('carpool.validation.date_invalid')
  }),
  description: z.string().optional(),
  smokingAllowed: z.boolean().optional(),
  petsAllowed: z.boolean().optional()
})

const schema = computed(() => {
  if (props.formType === 'offer') {
    return baseSchema.extend({
      availableSeats: z.number()
        .min(1, t('carpool.validation.seats_min'))
        .max(8, t('carpool.validation.seats_max')),
      pricePerSeat: z.number().min(0).optional().nullable(),
      musicAllowed: z.boolean().optional()
    })
  } else {
    return baseSchema.extend({
      requiredSeats: z.number()
        .min(1, t('carpool.validation.seats_min'))
        .max(8, t('carpool.validation.seats_max'))
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
const fetchSuggestions = useDebounceFn(async (field: 'departure' | 'arrival', query: string) => {
  if (!query || query.length < 3) {
    if (field === 'departure') {
      departureSuggestions.value = []
      showDepartureSuggestions.value = false
    } else {
      arrivalSuggestions.value = []
      showArrivalSuggestions.value = false
    }
    return
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
    )
    const data = await response.json()
    
    const suggestions = data.map((item: any) => ({
      id: item.place_id,
      name: item.display_name.split(',')[0],
      city: item.display_name.split(',')[1]?.trim() || '',
      country: item.display_name.split(',').slice(-1)[0]?.trim() || '',
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      fullAddress: item.display_name
    }))

    if (field === 'departure') {
      departureSuggestions.value = suggestions
      showDepartureSuggestions.value = true
    } else {
      arrivalSuggestions.value = suggestions
      showArrivalSuggestions.value = true
    }
  } catch (error) {
    console.error('Erreur lors de la recherche d\'adresses:', error)
  }
}, 300)

// Sélection d'une suggestion
const selectSuggestion = (field: 'departure' | 'arrival', suggestion: any) => {
  if (field === 'departure') {
    form.departure = suggestion.fullAddress
    form.departureCoordinates = { lat: suggestion.lat, lon: suggestion.lon }
    showDepartureSuggestions.value = false
  } else {
    form.arrival = suggestion.fullAddress
    form.arrivalCoordinates = { lat: suggestion.lat, lon: suggestion.lon }
    showArrivalSuggestions.value = false
  }
}

// Soumission du formulaire
const onSubmit = async () => {
  loading.value = true
  
  try {
    const endpoint = props.formType === 'offer' 
      ? `/api/editions/${props.editionId}/carpool-offers`
      : `/api/editions/${props.editionId}/carpool-requests`
    
    const payload = {
      ...form,
      editionId: props.editionId
    }
    
    // Nettoyer les champs non pertinents
    if (props.formType === 'offer') {
      delete payload.requiredSeats
    } else {
      delete payload.availableSeats
      delete payload.pricePerSeat
      delete payload.musicAllowed
    }
    
    const response = await $api(endpoint, {
      method: 'POST',
      body: payload
    })
    
    toast.add({
      title: t('common.success'),
      description: props.formType === 'offer' 
        ? t('carpool.offer.created')
        : t('carpool.request.created'),
      color: 'green'
    })
    
    emit('submit', response)
  } catch (error: any) {
    console.error('Erreur lors de la création:', error)
    toast.add({
      title: t('common.error'),
      description: error.data?.message || t('errors.generic'),
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

// Fermer les suggestions lors d'un clic en dehors
onMounted(() => {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('[name="departure"]')) {
      showDepartureSuggestions.value = false
    }
    if (!target.closest('[name="arrival"]')) {
      showArrivalSuggestions.value = false
    }
  })
})
</script>