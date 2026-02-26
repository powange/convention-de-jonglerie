<template>
  <UModal v-model:open="isOpen" :title="title">
    <template #body>
      <form @submit.prevent="handleSubmit">
        <div class="space-y-4">
          <!-- Image / Affiche -->
          <UFormField :label="$t('gestion.shows.image')">
            <UiImageUpload
              v-model="formData.imageUrl"
              :endpoint="uploadEndpoint"
              :options="{
                validation: {
                  maxSize: 5 * 1024 * 1024,
                  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
                  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
                },
                resetAfterUpload: false,
              }"
              :alt="formData.title || $t('gestion.shows.image')"
              :placeholder="$t('gestion.shows.image_placeholder')"
              @uploaded="onImageUploaded"
              @deleted="onImageDeleted"
            />
          </UFormField>

          <!-- Titre -->
          <UFormField :label="$t('gestion.shows.show_title')" required>
            <UInput
              v-model="formData.title"
              :placeholder="$t('gestion.shows.show_title')"
              required
              class="w-full"
            />
          </UFormField>

          <!-- Description -->
          <UFormField :label="$t('gestion.shows.description')">
            <UTextarea
              v-model="formData.description"
              :placeholder="$t('gestion.shows.description')"
              rows="3"
              class="w-full"
            />
          </UFormField>

          <!-- Date et heure -->
          <UiDateTimePicker
            v-model="formData.startDateTime"
            :date-label="$t('gestion.shows.start_date')"
            :time-label="$t('gestion.shows.start_time')"
            :placeholder="$t('gestion.shows.start_datetime')"
            required
          />

          <!-- Durée -->
          <UFormField :label="$t('gestion.shows.duration')">
            <UInput
              v-model.number="formData.duration"
              type="number"
              min="0"
              :placeholder="$t('gestion.shows.duration')"
            />
          </UFormField>

          <!-- Zone ou point de repère -->
          <UFormField :label="$t('gestion.shows.zone_or_marker')">
            <USelect
              v-model="selectedLocationRef"
              :items="locationOptions"
              :placeholder="$t('gestion.shows.select_zone_or_marker')"
              class="w-full"
            />
          </UFormField>

          <!-- Lieu (texte libre) -->
          <UFormField :label="$t('gestion.shows.location')">
            <UInput
              v-model="formData.location"
              :placeholder="$t('gestion.shows.location')"
              class="w-full"
            />
          </UFormField>

          <!-- Sélection des artistes -->
          <UFormField :label="$t('gestion.shows.artists')">
            <USelectMenu
              v-model="formData.artistIds"
              :items="artistOptions"
              value-key="value"
              multiple
              :placeholder="$t('gestion.shows.select_artists')"
              class="w-full"
            >
              <template #label>
                <span v-if="formData.artistIds.length === 0">
                  {{ $t('gestion.shows.no_artists_selected') }}
                </span>
                <span v-else>{{ formData.artistIds.length }} artiste(s) sélectionné(s)</span>
              </template>
            </USelectMenu>
          </UFormField>

          <!-- Liste des artistes sélectionnés -->
          <div v-if="selectedArtists.length > 0" class="flex flex-wrap gap-2">
            <UBadge
              v-for="artist in selectedArtists"
              :key="artist.id"
              color="warning"
              variant="subtle"
            >
              {{ artist.user.prenom }} {{ artist.user.nom }}
            </UBadge>
          </div>
          <p v-else class="text-sm text-gray-500">
            {{ $t('gestion.shows.no_artists_selected') }}
          </p>

          <!-- Sélection des articles à restituer -->
          <UFormField :label="$t('gestion.shows.returnable_items')">
            <USelectMenu
              v-model="formData.returnableItemIds"
              :items="returnableItemOptions"
              value-key="value"
              multiple
              :placeholder="$t('gestion.shows.select_returnable_items')"
              class="w-full"
            >
              <template #label>
                <span v-if="formData.returnableItemIds.length === 0">
                  {{ $t('gestion.shows.no_items_selected') }}
                </span>
                <span v-else
                  >{{ formData.returnableItemIds.length }} article(s) sélectionné(s)</span
                >
              </template>
            </USelectMenu>
          </UFormField>

          <!-- Liste des articles sélectionnés -->
          <div v-if="selectedReturnableItems.length > 0" class="flex flex-wrap gap-2">
            <UBadge
              v-for="item in selectedReturnableItems"
              :key="item.id"
              color="info"
              variant="subtle"
            >
              {{ item.name }}
            </UBadge>
          </div>
        </div>
      </form>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton type="button" color="primary" :loading="loading" @click="handleSubmit">
          {{ show ? $t('common.save') : $t('common.add') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { formatDateTimeLocal, parseDateTimeLocal } from '~/utils/date'

const props = defineProps<{
  modelValue: boolean
  show?: any
  editionId: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'show-saved': []
}>()

const { t } = useI18n()
const editionStore = useEditionStore()

const edition = computed(() => editionStore.getEditionById(props.editionId))

// Date par défaut : premier jour de l'édition à 10h00
const defaultStartDateTime = computed(() => {
  if (!edition.value?.startDate) return ''
  const date = new Date(edition.value.startDate)
  return formatDateTimeLocal(date)
})

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const title = computed(() =>
  props.show ? t('gestion.shows.edit_show') : t('gestion.shows.add_show')
)

const artists = ref<any[]>([])
const returnableItems = ref<any[]>([])
const zones = ref<any[]>([])
const markers = ref<any[]>([])

const formData = ref({
  title: '',
  description: '',
  startDateTime: '',
  duration: null as number | null,
  location: '',
  imageUrl: null as string | null,
  zoneId: null as number | null,
  markerId: null as number | null,
  artistIds: [] as number[],
  returnableItemIds: [] as number[],
})

// Configuration pour l'upload d'image
const uploadEndpoint = computed(() => ({
  type: 'show' as const,
  id: props.editionId,
}))

const onImageUploaded = (result: { success: boolean; imageUrl?: string }) => {
  if (result.success && result.imageUrl) {
    formData.value.imageUrl = result.imageUrl
  }
}

const onImageDeleted = () => {
  formData.value.imageUrl = null
}

// Sélection combinée zone/marqueur
// Format de la valeur : "zone:{id}" ou "marker:{id}" ou "" (aucun)
const selectedLocationRef = computed({
  get: () => {
    if (formData.value.zoneId) return `zone:${formData.value.zoneId}`
    if (formData.value.markerId) return `marker:${formData.value.markerId}`
    return ''
  },
  set: (value: string) => {
    if (!value) {
      formData.value.zoneId = null
      formData.value.markerId = null
      return
    }
    const [type, id] = value.split(':')
    if (type === 'zone') {
      formData.value.zoneId = parseInt(id)
      formData.value.markerId = null
    } else if (type === 'marker') {
      formData.value.markerId = parseInt(id)
      formData.value.zoneId = null
    }
  },
})

// Options combinées zones + marqueurs pour le select
const locationOptions = computed(() => {
  const zoneItems = zones.value.map((zone) => ({
    label: zone.name,
    value: `zone:${zone.id}`,
  }))

  const markerItems = markers.value.map((marker) => ({
    label: marker.name,
    value: `marker:${marker.id}`,
  }))

  const groups: any[][] = []

  if (zoneItems.length > 0) {
    groups.push([{ label: t('gestion.shows.zones_group'), type: 'label' as const }, ...zoneItems])
  }

  if (markerItems.length > 0) {
    groups.push([
      { label: t('gestion.shows.markers_group'), type: 'label' as const },
      ...markerItems,
    ])
  }

  return groups
})

const artistOptions = computed(() => {
  return artists.value.map((artist) => ({
    label: `${artist.user.prenom} ${artist.user.nom}`,
    value: artist.id,
  }))
})

const selectedArtists = computed(() => {
  return artists.value.filter((artist) => formData.value.artistIds.includes(artist.id))
})

const returnableItemOptions = computed(() => {
  return returnableItems.value.map((item) => ({
    label: item.name,
    value: item.id,
  }))
})

const selectedReturnableItems = computed(() => {
  return returnableItems.value.filter((item) => formData.value.returnableItemIds.includes(item.id))
})

// Charger les artistes disponibles
const fetchArtists = async () => {
  try {
    const response = await $fetch(`/api/editions/${props.editionId}/artists`)
    artists.value = response.artists || []
  } catch (error) {
    console.error('Error fetching artists:', error)
  }
}

// Charger les articles à restituer disponibles
const fetchReturnableItems = async () => {
  try {
    const response = await $fetch(`/api/editions/${props.editionId}/ticketing/returnable-items`)
    returnableItems.value = response?.data?.returnableItems || []
  } catch (error) {
    console.error('Error fetching returnable items:', error)
  }
}

// Charger les zones de l'édition
const fetchZones = async () => {
  try {
    const response = await $fetch(`/api/editions/${props.editionId}/zones`)
    zones.value = response.data?.zones || response.zones || []
  } catch (error) {
    console.error('Error fetching zones:', error)
  }
}

// Charger les marqueurs de l'édition
const fetchMarkers = async () => {
  try {
    const response = await $fetch(`/api/editions/${props.editionId}/markers`)
    markers.value = response.data?.markers || response.markers || []
  } catch (error) {
    console.error('Error fetching markers:', error)
  }
}

// Construit le payload pour l'API
const buildPayload = () => {
  const localDate = parseDateTimeLocal(formData.value.startDateTime)
  return {
    title: formData.value.title,
    description: formData.value.description || null,
    startDateTime: localDate.toISOString(),
    duration: formData.value.duration,
    location: formData.value.location || null,
    imageUrl: formData.value.imageUrl,
    zoneId: formData.value.zoneId,
    markerId: formData.value.markerId,
    artistIds: formData.value.artistIds,
    returnableItemIds: formData.value.returnableItemIds,
  }
}

// Callback commun après succès
const onSaveSuccess = () => {
  emit('show-saved')
  closeModal()
}

// Action pour créer un spectacle
const { execute: executeCreate, loading: isCreating } = useApiAction(
  () => `/api/editions/${props.editionId}/shows`,
  {
    method: 'POST',
    body: buildPayload,
    successMessage: { title: t('gestion.shows.show_created') },
    errorMessages: { default: t('gestion.shows.error_create') },
    onSuccess: onSaveSuccess,
  }
)

// Action pour modifier un spectacle
const { execute: executeUpdate, loading: isUpdating } = useApiAction(
  () => `/api/editions/${props.editionId}/shows/${props.show?.id}`,
  {
    method: 'PUT',
    body: buildPayload,
    successMessage: { title: t('gestion.shows.show_updated') },
    errorMessages: { default: t('gestion.shows.error_update') },
    onSuccess: onSaveSuccess,
  }
)

// État de chargement combiné
const loading = computed(() => isCreating.value || isUpdating.value)

const handleSubmit = () => {
  if (props.show) {
    executeUpdate()
  } else {
    executeCreate()
  }
}

const closeModal = () => {
  resetForm()
  isOpen.value = false
}

const resetForm = () => {
  formData.value = {
    title: '',
    description: '',
    startDateTime: defaultStartDateTime.value,
    duration: null,
    location: '',
    imageUrl: null,
    zoneId: null,
    markerId: null,
    artistIds: [],
    returnableItemIds: [],
  }
}

// Charger les données du spectacle en mode édition
watch(
  () => props.show,
  (newShow) => {
    if (newShow) {
      // Convertir la date ISO en format datetime-local (YYYY-MM-DDTHH:mm)
      // Utilise formatDateTimeLocal pour éviter les décalages de timezone
      let formattedDateTime = ''
      if (newShow.startDateTime) {
        const date = new Date(newShow.startDateTime)
        formattedDateTime = formatDateTimeLocal(date)
      }

      formData.value = {
        title: newShow.title || '',
        description: newShow.description || '',
        startDateTime: formattedDateTime,
        duration: newShow.duration || null,
        location: newShow.location || '',
        imageUrl: newShow.imageUrl || null,
        zoneId: newShow.zoneId || null,
        markerId: newShow.markerId || null,
        artistIds: newShow.artists?.map((showArtist: any) => showArtist.artistId) || [],
        returnableItemIds: newShow.returnableItems?.map((item: any) => item.returnableItemId) || [],
      }
    } else {
      resetForm()
    }
  }
)

// Charger les données au montage et quand le modal s'ouvre
watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen) {
      await Promise.all([
        artists.value.length === 0 ? fetchArtists() : Promise.resolve(),
        returnableItems.value.length === 0 ? fetchReturnableItems() : Promise.resolve(),
        zones.value.length === 0 ? fetchZones() : Promise.resolve(),
        markers.value.length === 0 ? fetchMarkers() : Promise.resolve(),
      ])
    }
  },
  { immediate: true }
)
</script>
