<template>
  <UModal v-model:open="isOpen" :title="title">
    <template #body>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <!-- Sélection utilisateur existant OU création nouveau -->
        <div v-if="!artist" class="space-y-4">
          <UFormField :label="$t('edition.artists.search_user')">
            <UserSelector
              v-model="selectedUser"
              v-model:search-term="searchTerm"
              :searched-users="searchedUsers"
              :searching-users="searchingUsers"
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
              :disabled="!!selectedUser"
            />
          </UFormField>

          <UFormField :label="$t('edition.artists.user_firstname')">
            <UInput
              v-model="formData.prenom"
              :placeholder="$t('edition.artists.user_firstname')"
              :disabled="!!selectedUser"
            />
          </UFormField>

          <UFormField :label="$t('edition.artists.user_lastname')">
            <UInput
              v-model="formData.nom"
              :placeholder="$t('edition.artists.user_lastname')"
              :disabled="!!selectedUser"
            />
          </UFormField>
        </div>

        <!-- Informations artiste -->
        <UFormField :label="$t('edition.artists.arrival')">
          <UInput
            v-model="formData.arrivalDateTime"
            type="datetime-local"
            :placeholder="$t('edition.artists.arrival')"
          />
        </UFormField>

        <UFormField :label="$t('edition.artists.departure')">
          <UInput
            v-model="formData.departureDateTime"
            type="datetime-local"
            :placeholder="$t('edition.artists.departure')"
          />
        </UFormField>

        <UFormField :label="$t('edition.artists.dietary_preference')">
          <USelect v-model="formData.dietaryPreference" :items="dietaryOptions" value-key="value" />
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
            :items="allergySeverityOptions"
            value-key="value"
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
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { getAllergySeveritySelectOptions } from '~/utils/allergy-severity'
import { formatDateTimeLocal } from '~/utils/date'

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

const selectedUser = ref<any>(null)
const searchTerm = ref('')
const searchedUsers = ref<any[]>([])
const searchingUsers = ref(false)
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

// Recherche d'utilisateurs
watch(searchTerm, async (newTerm) => {
  if (newTerm.length < 2) {
    searchedUsers.value = []
    return
  }

  searchingUsers.value = true
  try {
    const response = await $fetch<{ users: any[] }>('/api/users/search', {
      params: { q: newTerm },
    })
    searchedUsers.value = (response.users || []).map((user) => ({
      id: user.id,
      label: `${user.pseudo} (${user.email})`,
      pseudo: user.pseudo,
      email: user.email,
      prenom: user.prenom,
      nom: user.nom,
      emailHash: user.emailHash,
      profilePicture: user.profilePicture,
    }))
  } catch (error) {
    console.error('Error searching users:', error)
    searchedUsers.value = []
  } finally {
    searchingUsers.value = false
  }
})

const handleUserSelection = (user: any) => {
  selectedUser.value = user
  if (user) {
    // Pré-remplir les champs avec les données de l'utilisateur sélectionné (en lecture seule)
    formData.value.email = user.email || ''
    formData.value.prenom = user.prenom || ''
    formData.value.nom = user.nom || ''
  } else {
    // Si l'utilisateur est déselectionné, vider les champs
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
      if (selectedUser.value) {
        payload.userId = selectedUser.value.id
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
  selectedUser.value = null
  searchTerm.value = ''
  searchedUsers.value = []
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

// Fonction helper pour convertir une date en format datetime-local
const toDateTimeLocal = (dateString: string | null | undefined): string => {
  if (!dateString) return ''

  // Si la date est déjà au format datetime-local (YYYY-MM-DDTHH:mm), la retourner telle quelle
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateString)) {
    return dateString
  }

  // Sinon, tenter de parser et convertir au format datetime-local
  // Utilise formatDateTimeLocal pour éviter les décalages de timezone
  try {
    const date = new Date(dateString)
    return formatDateTimeLocal(date)
  } catch {
    return ''
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
        arrivalDateTime: toDateTimeLocal(newArtist.arrivalDateTime),
        departureDateTime: toDateTimeLocal(newArtist.departureDateTime),
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
