<template>
  <form @submit.prevent="handleSubmit">
    <div class="space-y-6">
      <!-- Le spectacle (2/3) + Programmation (1/3) côte à côte sur écran large -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Le spectacle -->
        <UCard class="lg:col-span-2">
          <template #header>
            <h2 class="text-lg font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-sparkles" />
              {{ $t('gestion.shows.section_show') }}
            </h2>
          </template>

          <div class="space-y-4">
            <!-- Titre -->
            <UFormField :label="$t('gestion.shows.show_title')" required>
              <UInput
                v-model="formData.title"
                :placeholder="$t('gestion.shows.show_title')"
                required
                class="w-full"
              />
            </UFormField>

            <!-- Type de spectacle : détermine où vivent les artistes -->
            <UFormField
              :label="$t('gestion.shows.type')"
              :description="$t('gestion.shows.type_hint')"
            >
              <URadioGroup
                v-model="formData.type"
                :items="typeOptions"
                value-key="value"
                variant="table"
                orientation="horizontal"
                indicator="hidden"
              />
            </UFormField>

            <!-- Compagnie / nom de scène : propre au spectacle standard. Sur un cabaret, chaque
                 numéro a ses artistes, il n'y a pas de compagnie unique à afficher. -->
            <UFormField
              v-if="formData.type === 'STANDARD'"
              :label="$t('gestion.shows.company_name')"
              :description="$t('gestion.shows.company_name_hint')"
            >
              <UInput
                v-model="formData.companyName"
                :placeholder="$t('gestion.shows.company_name_placeholder')"
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
          </div>
        </UCard>

        <!-- Programmation -->
        <UCard class="lg:col-span-1">
          <template #header>
            <h2 class="text-lg font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-calendar-days" />
              {{ $t('gestion.shows.section_schedule') }}
            </h2>
          </template>

          <div class="space-y-4">
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
              <div class="flex items-center gap-2">
                <!-- step-snapping désactivé : voir ShowActsEditor, une durée hors multiple de 5 doit
                     rester saisissable. -->
                <UInputNumber
                  v-model="formData.duration"
                  :min="0"
                  :step="5"
                  :step-snapping="false"
                  class="w-40"
                />
                <span class="text-sm text-gray-500">{{ $t('gestion.shows.minutes') }}</span>
              </div>
            </UFormField>

            <!-- Lieu -->
            <EditionLocationPicker
              v-model:location-name="formData.location"
              v-model:zone-id="formData.zoneId"
              v-model:marker-id="formData.markerId"
              :edition-id="editionId"
              :site-map-enabled="edition?.siteMapEnabled"
              :label="$t('gestion.shows.location')"
              :placeholder-carte="$t('gestion.shows.select_zone_or_marker')"
              :placeholder-texte="$t('gestion.shows.free_text_placeholder')"
            />
          </div>
        </UCard>
      </div>

      <!-- Artistes et numéros -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-user-group" />
            {{ $t('gestion.shows.section_cast') }}
          </h2>
        </template>

        <div class="space-y-4">
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

          <!-- Cabaret : les numéros (et leurs artistes) -->
          <UFormField v-else :label="$t('gestion.shows.acts')">
            <!-- Cabaret existant : édition des numéros sur une page dédiée -->
            <div
              v-if="props.show && props.show.type === 'CABARET'"
              class="flex flex-wrap items-center gap-3"
            >
              <p class="text-sm text-gray-500">
                {{ $t('gestion.shows.acts_edit_dedicated_hint') }}
              </p>
              <UButton
                :to="actsPath"
                icon="i-heroicons-queue-list"
                color="primary"
                variant="soft"
                size="sm"
              >
                {{ $t('gestion.shows.edit_acts') }}
              </UButton>
            </div>
            <!-- Création ou passage en cabaret : le cabaret est créé vide, les numéros s'ajoutent
                 ensuite sur leur page dédiée -->
            <p v-else class="text-sm text-gray-500">
              {{ $t('gestion.shows.acts_after_switch_hint') }}
            </p>
          </UFormField>
        </div>
      </UCard>

      <!-- Diffusion et interne -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-megaphone" />
            {{ $t('gestion.shows.section_publishing') }}
          </h2>
        </template>

        <div class="space-y-4">
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

          <!-- La visibilité publique se règle depuis la frise du programme, où l'on voit d'un coup
               d'œil ce qui est publié et ce qui ne l'est pas. La garder ici en doublon exposerait
               à deux réglages du même état, à deux endroits, avec le risque qu'ils divergent. -->
        </div>
      </UCard>

      <!-- Actions -->
      <div class="flex justify-end gap-2">
        <UButton type="button" color="neutral" variant="ghost" @click="emit('cancel')">
          {{ $t('common.cancel') }}
        </UButton>
        <UButton type="submit" color="primary" :loading="loading">
          {{ show ? $t('common.save') : $t('common.add') }}
        </UButton>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import { versChampLocal, versInstant } from '~~/shared/utils/fuseau-edition'

const props = defineProps<{
  show?: any
  editionId: number
}>()

const emit = defineEmits<{
  saved: []
  cancel: []
}>()

const { t } = useI18n()
const { getImageUrl } = useImageUrl()
const editionStore = useEditionStore()

const edition = computed(() => editionStore.getEditionById(props.editionId))

/**
 * Fuseau de la convention : l'heure d'un spectacle est celle du lieu, comme sur la frise du
 * programme où il apparaît. Sans lui, un régisseur préparant la soirée depuis un autre fuseau
 * aurait annoncé une heure fausse au public.
 */
const fuseau = computed(() => edition.value?.timezone ?? null)

// Date par défaut : premier jour de l'édition, à l'heure de l'édition
const defaultStartDateTime = computed(() =>
  edition.value?.startDate ? versChampLocal(edition.value.startDate, fuseau.value) : ''
)

const artists = ref<any[]>([])

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
  companyName: '',
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

// Sélection combinée zone/marqueur
// Format de la valeur : "zone:{id}" ou "marker:{id}" ou "" (aucun)

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

// Lien vers la page dédiée d'édition des numéros (cabaret existant).
const actsPath = computed(() =>
  props.show ? `/editions/${props.editionId}/gestion/artists/shows/${props.show.id}/numeros` : ''
)

// Construit le payload pour l'API.
// Cabaret : les numéros se gèrent sur une page dédiée. On ne les envoie donc PAS pour un cabaret
// EXISTANT (ils resteraient intacts). On les compose à la création (éditeur inline) et lors d'une
// bascule standard→cabaret (sinon le serveur refuse un cabaret sans numéros).
const buildPayload = () => {
  const base = {
    title: formData.value.title,
    // Sur un cabaret, la compagnie n'a pas de sens : on l'envoie vide pour ne pas laisser
    // traîner celle saisie avant une bascule de type.
    companyName:
      formData.value.type === 'STANDARD' ? formData.value.companyName.trim() || null : null,
    description: formData.value.description || null,
    technicalNeeds: formData.value.technicalNeeds || null,
    // Le champ `datetime-local` ne porte pas de fuseau : c'est celui de la convention qui l'ancre.
    startDateTime: versInstant(formData.value.startDateTime, fuseau.value),
    duration: formData.value.duration,
    location: formData.value.location || null,
    imageUrl: formData.value.imageUrl,
    zoneId: formData.value.zoneId,
    markerId: formData.value.markerId,
    type: formData.value.type,
    isPublic: formData.value.isPublic,
  }
  if (formData.value.type === 'STANDARD') {
    return { ...base, artistIds: formData.value.artistIds }
  }
  // Cabaret déjà existant : on ne touche pas aux numéros (édités sur leur page dédiée).
  if (props.show?.type === 'CABARET') {
    return base
  }
  // Création ou bascule vers cabaret : on crée un cabaret VIDE. Les numéros s'ajoutent ensuite
  // sur leur page dédiée. `acts: []` est requis pour que le serveur compose bien un cabaret
  // (sinon il refuse un cabaret sans numéros).
  return { ...base, acts: [] }
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
  formData.value = {
    title: '',
    type: 'STANDARD',
    companyName: '',
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
      // Réaffiché dans le fuseau de la convention, celui-là même qui a servi à l'enregistrer :
      // rouvrir le formulaire puis enregistrer ne doit pas déplacer l'horaire.
      const formattedDateTime = newShow.startDateTime
        ? versChampLocal(newShow.startDateTime, fuseau.value)
        : ''

      formData.value = {
        title: newShow.title || '',
        type: newShow.type === 'CABARET' ? 'CABARET' : 'STANDARD',
        companyName: newShow.companyName || '',
        description: newShow.description || '',
        technicalNeeds: newShow.technicalNeeds || '',
        startDateTime: formattedDateTime,
        duration: newShow.duration || null,
        location: newShow.location || '',
        // L'image est rangée sous le spectacle (`/uploads/shows/{showId}/…`) alors que
        // l'endpoint d'upload est celui de l'édition : on construit l'URL d'affichage ici,
        // sinon le composant la chercherait sous l'identifiant de l'édition. Le serveur ne
        // garde de toute façon que le nom de fichier.
        imageUrl: getImageUrl(newShow.imageUrl, 'show', newShow.id),
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
  Promise.all([fetchArtists()])
})

defineExpose({ isDirty })
</script>
