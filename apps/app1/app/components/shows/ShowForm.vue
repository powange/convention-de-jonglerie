<template>
  <form @submit.prevent="handleSubmit">
    <UCard>
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

        <!-- Besoins techniques : note d'organisation, non exposée publiquement -->
        <UFormField
          :label="$t('gestion.shows.technical_needs')"
          :description="$t('gestion.shows.technical_needs_hint')"
        >
          <UTextarea
            v-model="formData.technicalNeeds"
            :placeholder="$t('gestion.shows.technical_needs_placeholder')"
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

        <!-- Lieu -->
        <UFormField :label="$t('gestion.shows.location')">
          <div class="space-y-2">
            <URadioGroup
              v-if="edition?.siteMapEnabled"
              v-model="locationType"
              orientation="horizontal"
              :items="locationTypeOptions"
            />

            <!-- Mode zone/marqueur -->
            <USelect
              v-if="edition?.siteMapEnabled && locationType === 'zone'"
              v-model="selectedLocationRef"
              :items="locationOptions"
              :placeholder="$t('gestion.shows.select_zone_or_marker')"
              class="w-full"
            />

            <!-- Mode texte libre -->
            <UInput
              v-else
              v-model="formData.location"
              :placeholder="$t('gestion.shows.free_text_placeholder')"
              class="w-full"
            />
          </div>
        </UFormField>

        <!-- Type de spectacle : détermine où vivent les artistes -->
        <UFormField :label="$t('gestion.shows.type')" :description="$t('gestion.shows.type_hint')">
          <USelect v-model="formData.type" :items="typeOptions" value-key="value" class="w-full" />
        </UFormField>

        <!-- Spectacle standard : les artistes sont associés au spectacle -->
        <template v-if="formData.type === 'STANDARD'">
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
                <span v-else>
                  {{ $t('gestion.shows.artists_count', { count: formData.artistIds.length }) }}
                </span>
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
              <UiUserName :user="artist.user" />
            </UBadge>
          </div>
          <p v-else class="text-sm text-gray-500">
            {{ $t('gestion.shows.no_artists_selected') }}
          </p>
        </template>

        <!-- Cabaret : les artistes sont associés à chaque numéro -->
        <UFormField v-else :label="$t('gestion.shows.acts')">
          <ShowsShowActsEditor v-model="formData.acts" :artists="artists" />
        </UFormField>

        <!-- Visibilité publique -->
        <USwitch
          v-model="formData.isPublic"
          :label="$t('gestion.shows.is_public')"
          :description="$t('gestion.shows.is_public_hint')"
        />
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton type="button" color="neutral" variant="ghost" @click="emit('cancel')">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton type="submit" color="primary" :loading="loading">
            {{ show ? $t('common.save') : $t('common.add') }}
          </UButton>
        </div>
      </template>
    </UCard>
  </form>
</template>

<script setup lang="ts">
import { formatDateTimeLocal, parseDateTimeLocal } from '~/utils/date'

const props = defineProps<{
  show?: any
  editionId: number
}>()

const emit = defineEmits<{
  saved: []
  cancel: []
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

const artists = ref<any[]>([])
const zones = ref<any[]>([])
const markers = ref<any[]>([])

interface ActInput {
  title: string
  duration: number | string | null
  description: string | null
  technicalNeeds: string | null
  stageSetup: string | null
  artistIds: number[]
}

const formData = ref({
  title: '',
  type: 'STANDARD' as 'STANDARD' | 'CABARET',
  description: '',
  technicalNeeds: '',
  startDateTime: '',
  duration: null as number | null,
  location: '',
  imageUrl: null as string | null,
  zoneId: null as number | null,
  markerId: null as number | null,
  artistIds: [] as number[],
  acts: [] as ActInput[],
  isPublic: false,
})

// Suivi des modifications, pour prévenir avant de quitter la page sans enregistrer.
// L'hydratation initiale le remet à false, sinon le simple chargement marquerait le
// formulaire comme modifié.
const isDirty = ref(false)
watch(
  formData,
  () => {
    isDirty.value = true
  },
  { deep: true }
)

const typeOptions = computed(() => [
  { label: t('gestion.shows.type_standard'), value: 'STANDARD' },
  { label: t('gestion.shows.type_cabaret'), value: 'CABARET' },
])

// Bascule de type : ne pas perdre la saisie déjà faite.
// Vers le cabaret, les artistes déjà choisis deviennent un premier numéro à découper ;
// dans l'autre sens, on remonte les artistes des numéros au niveau du spectacle.
watch(
  () => formData.value.type,
  (newType, oldType) => {
    if (newType === oldType) return

    if (newType === 'CABARET' && formData.value.acts.length === 0) {
      if (formData.value.artistIds.length > 0) {
        formData.value.acts = [
          {
            title: formData.value.title || t('gestion.shows.act_default_title'),
            duration: null,
            description: null,
            technicalNeeds: null,
            stageSetup: null,
            artistIds: [...formData.value.artistIds],
          },
        ]
      }
      return
    }

    if (newType === 'STANDARD' && formData.value.artistIds.length === 0) {
      formData.value.artistIds = [...new Set(formData.value.acts.flatMap((act) => act.artistIds))]
    }
  }
)

// Type de localisation : zone/marqueur ou texte libre
const locationType = ref<'zone' | 'text'>('zone')

const locationTypeOptions = computed(() => [
  { label: t('gestion.shows.zone_or_marker'), value: 'zone' },
  { label: t('gestion.shows.free_text'), value: 'text' },
])

// Configuration pour l'upload d'image
const uploadEndpoint = computed(() => ({
  type: 'show' as const,
  id: props.editionId,
}))

const onImageUploaded = (result: { imageUrl?: string }) => {
  if (result.imageUrl) {
    formData.value.imageUrl = result.imageUrl
  }
}

const onImageDeleted = () => {
  formData.value.imageUrl = null
}

// Nettoyer les données de l'autre mode au changement
watch(locationType, (newType) => {
  if (newType === 'zone') {
    formData.value.location = ''
  } else {
    formData.value.zoneId = null
    formData.value.markerId = null
  }
})

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

// Charger les artistes disponibles
const fetchArtists = async () => {
  try {
    const response = await $fetch(`/api/editions/${props.editionId}/artists`)
    artists.value = response.data?.artists || []
  } catch (error) {
    console.error('Error fetching artists:', error)
  }
}

// Charger les zones de l'édition
const fetchZones = async () => {
  try {
    const response = await $fetch(`/api/editions/${props.editionId}/zones`)
    zones.value = response.data?.zones || []
  } catch (error) {
    console.error('Error fetching zones:', error)
  }
}

// Charger les marqueurs de l'édition
const fetchMarkers = async () => {
  try {
    const response = await $fetch(`/api/editions/${props.editionId}/markers`)
    markers.value = response.data?.markers || []
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
    technicalNeeds: formData.value.technicalNeeds || null,
    startDateTime: localDate.toISOString(),
    duration: formData.value.duration,
    location: formData.value.location || null,
    imageUrl: formData.value.imageUrl,
    zoneId: formData.value.zoneId,
    markerId: formData.value.markerId,
    type: formData.value.type,
    // Le serveur ne retient que la forme correspondant au type ; on envoie les deux champs
    // pour qu'une bascule efface bien celle qui n'est plus pertinente.
    artistIds: formData.value.type === 'STANDARD' ? formData.value.artistIds : [],
    acts:
      formData.value.type === 'CABARET'
        ? formData.value.acts
            .filter((act) => act.title.trim().length > 0)
            .map((act) => ({
              title: act.title.trim(),
              duration: act.duration ? Number(act.duration) : null,
              description: act.description || null,
              technicalNeeds: act.technicalNeeds || null,
              stageSetup: act.stageSetup || null,
              artistIds: act.artistIds,
            }))
        : [],
    isPublic: formData.value.isPublic,
  }
}

// Callback commun après succès
const onSaveSuccess = () => {
  // Le formulaire n'a plus de modifications à protéger une fois enregistré
  isDirty.value = false
  emit('saved')
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

const resetForm = () => {
  locationType.value = 'zone'
  formData.value = {
    title: '',
    type: 'STANDARD',
    description: '',
    technicalNeeds: '',
    startDateTime: defaultStartDateTime.value,
    duration: null,
    location: '',
    imageUrl: null,
    zoneId: null,
    markerId: null,
    artistIds: [],
    acts: [],
    isPublic: false,
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
        type: newShow.type === 'CABARET' ? 'CABARET' : 'STANDARD',
        description: newShow.description || '',
        technicalNeeds: newShow.technicalNeeds || '',
        startDateTime: formattedDateTime,
        duration: newShow.duration || null,
        location: newShow.location || '',
        imageUrl: newShow.imageUrl || null,
        zoneId: newShow.zoneId || null,
        markerId: newShow.markerId || null,
        // Sur un cabaret, les artistes du spectacle sont ceux des numéros : on ne garde ici
        // que les liens sans numéro, pour ne pas les dupliquer dans le sélecteur du haut.
        artistIds:
          newShow.artists
            ?.filter((showArtist: any) => !showArtist.actId)
            .map((showArtist: any) => showArtist.artistId) || [],
        acts:
          newShow.acts?.map((act: any) => ({
            title: act.title || '',
            duration: act.duration ?? null,
            description: act.description ?? null,
            technicalNeeds: act.technicalNeeds ?? null,
            stageSetup: act.stageSetup ?? null,
            artistIds: act.artists?.map((showArtist: any) => showArtist.artistId) || [],
          })) || [],
        isPublic: newShow.isPublic || false,
      }

      // Auto-détecter le mode selon les données existantes
      if (newShow.zoneId || newShow.markerId) {
        locationType.value = 'zone'
      } else if (newShow.location) {
        locationType.value = 'text'
      } else {
        locationType.value = 'zone'
      }
    } else {
      resetForm()
    }
    // L'hydratation ne compte pas comme une modification de l'utilisateur
    nextTick(() => {
      isDirty.value = false
    })
  },
  { immediate: true }
)

// Charger les référentiels au montage. Pas d'await au niveau racine : cela rendrait le
// composant asynchrone et imposerait un Suspense au parent.
onMounted(() => {
  Promise.all([fetchArtists(), fetchZones(), fetchMarkers()])
})

defineExpose({ isDirty })
</script>
