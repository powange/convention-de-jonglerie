<template>
  <UModal v-model:open="isOpen" :title="title">
    <template #body>
      <form @submit.prevent="handleSubmit">
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
          <UFormField :label="$t('gestion.shows.start_datetime')" required>
            <UInput
              v-model="formData.startDateTime"
              type="datetime-local"
              :placeholder="$t('gestion.shows.start_datetime')"
              required
            />
          </UFormField>

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
const toast = useToast()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const title = computed(() =>
  props.show ? t('gestion.shows.edit_show') : t('gestion.shows.add_show')
)

const loading = ref(false)
const artists = ref<any[]>([])
const returnableItems = ref<any[]>([])

const formData = ref({
  title: '',
  description: '',
  startDateTime: '',
  duration: null as number | null,
  location: '',
  artistIds: [] as number[],
  returnableItemIds: [] as number[],
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
    returnableItems.value = response?.returnableItems || []
  } catch (error) {
    console.error('Error fetching returnable items:', error)
  }
}

const handleSubmit = async () => {
  loading.value = true
  try {
    // Convertir la date datetime-local en Date (temps local), puis en ISO
    const localDate = parseDateTimeLocal(formData.value.startDateTime)

    const payload = {
      title: formData.value.title,
      description: formData.value.description || null,
      startDateTime: localDate.toISOString(),
      duration: formData.value.duration,
      location: formData.value.location || null,
      artistIds: formData.value.artistIds,
      returnableItemIds: formData.value.returnableItemIds,
    }

    if (props.show) {
      // Mode modification
      await $fetch(`/api/editions/${props.editionId}/shows/${props.show.id}`, {
        method: 'PUT',
        body: payload,
      })
      toast.add({ title: t('gestion.shows.show_updated'), color: 'success' })
    } else {
      // Mode ajout
      await $fetch(`/api/editions/${props.editionId}/shows`, {
        method: 'POST',
        body: payload,
      })
      toast.add({ title: t('gestion.shows.show_created'), color: 'success' })
    }

    emit('show-saved')
    closeModal()
  } catch (error: any) {
    console.error('Error saving show:', error)
    toast.add({
      title: props.show ? t('gestion.shows.error_update') : t('gestion.shows.error_create'),
      color: 'error',
    })
  } finally {
    loading.value = false
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
    startDateTime: '',
    duration: null,
    location: '',
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
      // Charger les artistes et items si pas encore chargés
      await Promise.all([
        artists.value.length === 0 ? fetchArtists() : Promise.resolve(),
        returnableItems.value.length === 0 ? fetchReturnableItems() : Promise.resolve(),
      ])
    }
  },
  { immediate: true }
)
</script>
