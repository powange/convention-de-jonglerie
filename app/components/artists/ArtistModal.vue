<template>
  <UModal v-model:open="isOpen" :title="title">
    <template #body>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <!-- Sélection utilisateur existant OU création nouveau (mode ajout) -->
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

        <!-- Informations utilisateur (mode édition) -->
        <div v-else class="space-y-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-sm font-medium text-gray-900 dark:text-white">
            {{ $t('edition.artists.user_info') }}
          </h3>

          <UFormField :label="$t('edition.artists.user_email')">
            <UInput
              v-model="formData.email"
              type="email"
              :placeholder="$t('edition.artists.user_email')"
              :disabled="!isManualUser"
            />
          </UFormField>

          <UFormField :label="$t('edition.artists.user_firstname')">
            <UInput
              v-model="formData.prenom"
              :placeholder="$t('edition.artists.user_firstname')"
              :disabled="!isManualUser"
            />
          </UFormField>

          <UFormField :label="$t('edition.artists.user_lastname')">
            <UInput
              v-model="formData.nom"
              :placeholder="$t('edition.artists.user_lastname')"
              :disabled="!isManualUser"
            />
          </UFormField>

          <UFormField :label="$t('editions.ticketing.phone')">
            <UInput
              v-model="formData.phone"
              type="tel"
              :placeholder="$t('editions.ticketing.phone')"
              :disabled="!isManualUser"
            />
          </UFormField>

          <div v-if="!isManualUser" class="text-xs text-gray-500 dark:text-gray-400">
            {{ $t('edition.artists.user_info_readonly') }}
          </div>
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

        <!-- Paiement et défraiement -->
        <div class="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 class="text-sm font-medium text-gray-900 dark:text-white">
            {{ $t('edition.artists.payment_section') }}
          </h3>

          <div class="grid grid-cols-2 gap-4">
            <UFormField :label="$t('edition.artists.payment_amount')">
              <UInput
                v-model="formData.payment"
                type="number"
                step="0.01"
                min="0"
                :placeholder="$t('edition.artists.payment_amount_placeholder')"
              >
                <template #trailing>
                  <span class="text-gray-500 dark:text-gray-400 text-sm">€</span>
                </template>
              </UInput>
            </UFormField>

            <UFormField :label="$t('edition.artists.payment_status')">
              <UCheckbox
                v-model="formData.paymentPaid"
                :label="$t('edition.artists.payment_paid')"
              />
            </UFormField>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <UFormField :label="$t('edition.artists.reimbursement_amount')">
              <UInput
                v-model="formData.reimbursement"
                type="number"
                step="0.01"
                min="0"
                :placeholder="$t('edition.artists.reimbursement_amount_placeholder')"
              >
                <template #trailing>
                  <span class="text-gray-500 dark:text-gray-400 text-sm">€</span>
                </template>
              </UInput>
            </UFormField>

            <UFormField :label="$t('edition.artists.reimbursement_status')">
              <UCheckbox
                v-model="formData.reimbursementPaid"
                :label="$t('edition.artists.reimbursement_paid')"
              />
            </UFormField>
          </div>
        </div>

        <!-- Repas (mode édition uniquement) -->
        <div v-if="artist" class="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 class="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <UIcon name="i-heroicons-cake" class="text-primary-500" />
            Repas
          </h3>

          <div v-if="loadingMeals" class="flex items-center justify-center py-8">
            <UIcon name="i-heroicons-arrow-path" class="animate-spin h-6 w-6 text-primary-500" />
          </div>

          <div
            v-else-if="meals.length === 0"
            class="text-sm text-gray-500 italic p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center"
          >
            Aucun repas disponible pour la période de présence de l'artiste.
          </div>

          <div v-else class="space-y-6">
            <div class="text-sm text-gray-600 dark:text-gray-400">
              Sélectionnez les repas que l'artiste prendra pendant sa présence.
            </div>

            <div class="space-y-4">
              <div v-for="(dayMeals, date) in groupedMeals" :key="date" class="space-y-2">
                <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ formatMealDate(date) }}
                </h5>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div
                    v-for="meal in dayMeals"
                    :key="meal.id"
                    :class="[
                      'flex items-center gap-3 p-3 border rounded-lg transition-opacity',
                      meal.accepted
                        ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                        : 'border-gray-200/50 dark:border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 opacity-60',
                    ]"
                  >
                    <UCheckbox v-model="meal.accepted" :disabled="savingMeals" />
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ getMealTypeLabel(meal.mealType) }}
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">
                        {{ getPhaseLabel(meal.phase) }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              class="flex items-center justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700"
            >
              <div v-if="hasUnsavedMealChanges" class="text-xs text-gray-500">
                <UIcon name="i-heroicons-exclamation-circle" class="inline" />
                Modifications non sauvegardées
              </div>
              <UButton
                color="primary"
                :disabled="!hasUnsavedMealChanges || savingMeals"
                :loading="savingMeals"
                @click="saveMealSelections"
              >
                Sauvegarder les repas
              </UButton>
            </div>
          </div>
        </div>

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
  phone: '',
  arrivalDateTime: '',
  departureDateTime: '',
  dietaryPreference: 'NONE',
  allergies: '',
  allergySeverity: null as string | null,
  payment: '',
  paymentPaid: false,
  reimbursement: '',
  reimbursementPaid: false,
})

// État pour les repas
const meals = ref<any[]>([])
const initialMeals = ref<any[]>([])
const loadingMeals = ref(false)
const savingMeals = ref(false)

// Vérifier si l'utilisateur est créé manuellement (authProvider = MANUAL)
const isManualUser = computed(() => {
  return props.artist && props.artist.user && props.artist.user.authProvider === 'MANUAL'
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

// Labels pour les repas
const mealTypeLabels: Record<string, string> = {
  BREAKFAST: 'Petit déjeuner',
  LUNCH: 'Déjeuner',
  DINNER: 'Dîner',
}

const phaseLabels: Record<string, string> = {
  SETUP: 'Montage',
  EVENT: 'Édition',
  TEARDOWN: 'Démontage',
}

const getMealTypeLabel = (mealType: string) => mealTypeLabels[mealType] || mealType
const getPhaseLabel = (phase: string) => phaseLabels[phase] || phase

// Grouper les repas par date
const groupedMeals = computed(() => {
  const grouped: Record<string, any[]> = {}
  meals.value.forEach((meal) => {
    const dateKey = meal.date.split('T')[0]
    if (!grouped[dateKey]) {
      grouped[dateKey] = []
    }
    grouped[dateKey].push(meal)
  })
  return grouped
})

// Formater la date pour l'affichage
const formatMealDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Détection des modifications non sauvegardées pour les repas
const hasUnsavedMealChanges = computed(() => {
  if (meals.value.length !== initialMeals.value.length) return true

  return meals.value.some((meal, index) => {
    const initialMeal = initialMeals.value[index]
    return meal.accepted !== initialMeal?.accepted
  })
})

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

// Charger les repas
const fetchMeals = async () => {
  if (!props.artist) return

  loadingMeals.value = true
  try {
    const response = await $fetch(
      `/api/editions/${props.editionId}/artists/${props.artist.id}/meals`
    )
    if (response.success && response.meals) {
      meals.value = response.meals
      // Sauvegarder l'état initial pour la détection de changements
      initialMeals.value = JSON.parse(JSON.stringify(response.meals))
    }
  } catch (error: any) {
    console.error('Failed to fetch meals:', error)
    toast.add({
      title: 'Erreur',
      description: error?.data?.message || 'Impossible de charger les repas',
      color: 'error',
    })
  } finally {
    loadingMeals.value = false
  }
}

// Sauvegarder les sélections de repas
const saveMealSelections = async () => {
  if (!props.artist) return

  savingMeals.value = true
  try {
    const selections = meals.value.map((meal) => ({
      selectionId: meal.selectionId,
      accepted: meal.accepted,
    }))

    const response = await $fetch(
      `/api/editions/${props.editionId}/artists/${props.artist.id}/meals`,
      {
        method: 'PUT',
        body: { selections },
      }
    )

    if (response.success && response.meals) {
      meals.value = response.meals
      // Mettre à jour l'état initial après sauvegarde
      initialMeals.value = JSON.parse(JSON.stringify(response.meals))

      toast.add({
        title: 'Sauvegardé',
        description: "Les repas de l'artiste ont été enregistrés",
        color: 'success',
        icon: 'i-heroicons-check-circle',
      })
    }
  } catch (error: any) {
    console.error('Failed to save meal selections:', error)
    toast.add({
      title: 'Erreur',
      description: error?.data?.message || 'Impossible de sauvegarder les repas',
      color: 'error',
    })
  } finally {
    savingMeals.value = false
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
      payment: formData.value.payment ? parseFloat(formData.value.payment) : null,
      paymentPaid: formData.value.paymentPaid,
      reimbursement: formData.value.reimbursement ? parseFloat(formData.value.reimbursement) : null,
      reimbursementPaid: formData.value.reimbursementPaid,
    }

    if (props.artist) {
      // Mode modification
      // Ajouter les champs user si l'utilisateur est MANUAL
      if (isManualUser.value) {
        payload.userEmail = formData.value.email
        payload.userPrenom = formData.value.prenom
        payload.userNom = formData.value.nom
        payload.userPhone = formData.value.phone || null
      }

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
    phone: '',
    arrivalDateTime: '',
    departureDateTime: '',
    dietaryPreference: 'NONE',
    allergies: '',
    allergySeverity: null,
    payment: '',
    paymentPaid: false,
    reimbursement: '',
    reimbursementPaid: false,
  }
  meals.value = []
  initialMeals.value = []
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
        email: newArtist.user?.email || '',
        prenom: newArtist.user?.prenom || '',
        nom: newArtist.user?.nom || '',
        phone: newArtist.user?.phone || '',
        arrivalDateTime: toDateTimeLocal(newArtist.arrivalDateTime),
        departureDateTime: toDateTimeLocal(newArtist.departureDateTime),
        dietaryPreference: newArtist.dietaryPreference || 'NONE',
        allergies: newArtist.allergies || '',
        allergySeverity: newArtist.allergySeverity || null,
        payment: newArtist.payment ? newArtist.payment.toString() : '',
        paymentPaid: newArtist.paymentPaid || false,
        reimbursement: newArtist.reimbursement ? newArtist.reimbursement.toString() : '',
        reimbursementPaid: newArtist.reimbursementPaid || false,
      }
      // Charger les repas en mode édition
      fetchMeals()
    } else {
      resetForm()
    }
  },
  { immediate: true }
)
</script>
