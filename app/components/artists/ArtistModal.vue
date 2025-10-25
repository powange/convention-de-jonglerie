<template>
  <UModal v-model="isOpen" :title="title">
    <UCard>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <!-- Sélection utilisateur existant OU création nouveau -->
        <div v-if="!artist" class="space-y-4">
          <UFormField :label="$t('edition.artists.search_user')">
            <UserSelector
              v-model="selectedUserId"
              :placeholder="$t('edition.artists.select_user')"
              @update:model-value="handleUserSelection"
            />
          </UFormField>

          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-300 dark:border-gray-700"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-white dark:bg-gray-900 text-gray-500">
                {{ $t('edition.artists.or_create_new') }}
              </span>
            </div>
          </div>

          <UFormField :label="$t('edition.artists.user_email')">
            <UInput
              v-model="formData.email"
              type="email"
              :placeholder="$t('edition.artists.user_email')"
              :disabled="!!selectedUserId"
            />
          </UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField :label="$t('edition.artists.user_firstname')">
              <UInput
                v-model="formData.prenom"
                :placeholder="$t('edition.artists.user_firstname')"
                :disabled="!!selectedUserId"
              />
            </UFormField>

            <UFormField :label="$t('edition.artists.user_lastname')">
              <UInput
                v-model="formData.nom"
                :placeholder="$t('edition.artists.user_lastname')"
                :disabled="!!selectedUserId"
              />
            </UFormField>
          </div>
        </div>

        <!-- Informations artiste -->
        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="$t('edition.artists.arrival')">
            <UInput
              v-model="formData.arrivalDateTime"
              type="text"
              :placeholder="$t('edition.artists.arrival')"
            />
          </UFormField>

          <UFormField :label="$t('edition.artists.departure')">
            <UInput
              v-model="formData.departureDateTime"
              type="text"
              :placeholder="$t('edition.artists.departure')"
            />
          </UFormField>
        </div>

        <UFormField :label="$t('edition.artists.dietary_preference')">
          <USelect
            v-model="formData.dietaryPreference"
            :options="dietaryOptions"
            option-attribute="label"
            value-attribute="value"
          />
        </UFormField>

        <UFormField :label="$t('edition.artists.allergies')">
          <UTextarea
            v-model="formData.allergies"
            :placeholder="$t('edition.artists.allergies')"
            rows="3"
          />
        </UFormField>

        <UFormField v-if="formData.allergies" :label="$t('edition.artists.allergy_severity')">
          <USelect
            v-model="formData.allergySeverity"
            :options="allergySeverityOptions"
            option-attribute="label"
            value-attribute="value"
          />
        </UFormField>

        <!-- Actions -->
        <div class="flex justify-end gap-2 pt-4">
          <UButton color="neutral" variant="soft" @click="closeModal">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton type="submit" color="primary" :loading="loading">
            {{ artist ? $t('common.save') : $t('common.add') }}
          </UButton>
        </div>
      </form>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  artist?: any
  editionId: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'artist-saved': []
}>()

const { t } = useI18n()
const toast = useToast()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const title = computed(() =>
  props.artist ? t('edition.artists.edit_artist') : t('edition.artists.add_artist')
)

const selectedUserId = ref<number | null>(null)
const loading = ref(false)

const formData = ref({
  email: '',
  prenom: '',
  nom: '',
  arrivalDateTime: '',
  departureDateTime: '',
  dietaryPreference: 'NONE',
  allergies: '',
  allergySeverity: null as string | null,
})

const dietaryOptions = [
  { label: t('common.none'), value: 'NONE' },
  { label: 'Végétarien', value: 'VEGETARIAN' },
  { label: 'Vegan', value: 'VEGAN' },
]

const allergySeverityOptions = [
  { label: 'Légère', value: 'LIGHT' },
  { label: 'Modérée', value: 'MODERATE' },
  { label: 'Sévère', value: 'SEVERE' },
  { label: 'Critique', value: 'CRITICAL' },
]

const handleUserSelection = (userId: number | null) => {
  selectedUserId.value = userId
  if (userId) {
    // Effacer les champs email/nom/prénom si un utilisateur est sélectionné
    formData.value.email = ''
    formData.value.prenom = ''
    formData.value.nom = ''
  }
}

const handleSubmit = async () => {
  loading.value = true
  try {
    const payload: any = {
      arrivalDateTime: formData.value.arrivalDateTime || null,
      departureDateTime: formData.value.departureDateTime || null,
      dietaryPreference: formData.value.dietaryPreference,
      allergies: formData.value.allergies || null,
      allergySeverity: formData.value.allergySeverity,
    }

    if (props.artist) {
      // Mode modification
      await $fetch(`/api/editions/${props.editionId}/artists/${props.artist.id}`, {
        method: 'PUT',
        body: payload,
      })
      toast.add({ title: t('edition.artists.artist_updated'), color: 'success' })
    } else {
      // Mode ajout
      if (selectedUserId.value) {
        payload.userId = selectedUserId.value
      } else {
        payload.email = formData.value.email
        payload.prenom = formData.value.prenom
        payload.nom = formData.value.nom
      }

      await $fetch(`/api/editions/${props.editionId}/artists`, {
        method: 'POST',
        body: payload,
      })
      toast.add({ title: t('edition.artists.artist_added'), color: 'success' })
    }

    emit('artist-saved')
    closeModal()
  } catch (error: any) {
    console.error('Error saving artist:', error)
    toast.add({
      title: props.artist ? t('edition.artists.error_update') : t('edition.artists.error_add'),
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
  selectedUserId.value = null
  formData.value = {
    email: '',
    prenom: '',
    nom: '',
    arrivalDateTime: '',
    departureDateTime: '',
    dietaryPreference: 'NONE',
    allergies: '',
    allergySeverity: null,
  }
}

// Charger les données de l'artiste en mode édition
watch(
  () => props.artist,
  (newArtist) => {
    if (newArtist) {
      formData.value = {
        email: '',
        prenom: '',
        nom: '',
        arrivalDateTime: newArtist.arrivalDateTime || '',
        departureDateTime: newArtist.departureDateTime || '',
        dietaryPreference: newArtist.dietaryPreference || 'NONE',
        allergies: newArtist.allergies || '',
        allergySeverity: newArtist.allergySeverity || null,
      }
    } else {
      resetForm()
    }
  },
  { immediate: true }
)
</script>
