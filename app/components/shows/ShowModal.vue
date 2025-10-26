<template>
  <UModal v-model:open="isOpen" :title="title">
    <template #body>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <!-- Titre -->
        <UFormField :label="$t('edition.shows.show_title')" required>
          <UInput v-model="formData.title" :placeholder="$t('edition.shows.show_title')" required />
        </UFormField>

        <!-- Description -->
        <UFormField :label="$t('edition.shows.description')">
          <UTextarea
            v-model="formData.description"
            :placeholder="$t('edition.shows.description')"
            rows="3"
          />
        </UFormField>

        <!-- Date et heure -->
        <UFormField :label="$t('edition.shows.start_datetime')" required>
          <UInput
            v-model="formData.startDateTime"
            type="datetime-local"
            :placeholder="$t('edition.shows.start_datetime')"
            required
          />
        </UFormField>

        <!-- Durée -->
        <UFormField :label="$t('edition.shows.duration')">
          <UInput
            v-model.number="formData.duration"
            type="number"
            min="0"
            :placeholder="$t('edition.shows.duration')"
          />
        </UFormField>

        <!-- Lieu -->
        <UFormField :label="$t('edition.shows.location')">
          <UInput v-model="formData.location" :placeholder="$t('edition.shows.location')" />
        </UFormField>

        <!-- Sélection des artistes -->
        <UFormField :label="$t('edition.shows.artists')">
          <USelect
            v-model="formData.artistIds"
            :items="artistOptions"
            value-key="value"
            multiple
            :placeholder="$t('edition.shows.select_artists')"
          />
        </UFormField>

        <!-- Liste des artistes sélectionnés -->
        <div v-if="selectedArtists.length > 0" class="flex flex-wrap gap-2">
          <UBadge
            v-for="artist in selectedArtists"
            :key="artist.id"
            color="purple"
            variant="subtle"
          >
            {{ artist.user.prenom }} {{ artist.user.nom }}
          </UBadge>
        </div>
        <p v-else class="text-sm text-gray-500">
          {{ $t('edition.shows.no_artists_selected') }}
        </p>

        <!-- Actions -->
        <div class="flex justify-end gap-2 pt-4">
          <UButton color="neutral" variant="soft" @click="closeModal">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton type="submit" color="primary" :loading="loading">
            {{ show ? $t('common.save') : $t('common.add') }}
          </UButton>
        </div>
      </form>
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
  props.show ? t('edition.shows.edit_show') : t('edition.shows.add_show')
)

const loading = ref(false)
const artists = ref<any[]>([])

const formData = ref({
  title: '',
  description: '',
  startDateTime: '',
  duration: null as number | null,
  location: '',
  artistIds: [] as number[],
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
    artists.value = response.artists || []
  } catch (error) {
    console.error('Error fetching artists:', error)
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
    }

    if (props.show) {
      // Mode modification
      await $fetch(`/api/editions/${props.editionId}/shows/${props.show.id}`, {
        method: 'PUT',
        body: payload,
      })
      toast.add({ title: t('edition.shows.show_updated'), color: 'success' })
    } else {
      // Mode ajout
      await $fetch(`/api/editions/${props.editionId}/shows`, {
        method: 'POST',
        body: payload,
      })
      toast.add({ title: t('edition.shows.show_created'), color: 'success' })
    }

    emit('show-saved')
    closeModal()
  } catch (error: any) {
    console.error('Error saving show:', error)
    toast.add({
      title: props.show ? t('edition.shows.error_update') : t('edition.shows.error_create'),
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

const closeModal = () => {
  isOpen.value = false
  resetForm()
}

const resetForm = () => {
  formData.value = {
    title: '',
    description: '',
    startDateTime: '',
    duration: null,
    location: '',
    artistIds: [],
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
      }
    } else {
      resetForm()
    }
  },
  { immediate: true }
)

// Charger les artistes au montage
onMounted(() => {
  fetchArtists()
})
</script>
