<template>
  <UModal v-model:open="isOpen" :title="title">
    <template #body>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <!-- Sélection utilisateur existant OU création nouveau (mode ajout) -->
        <div v-if="!artist" class="space-y-4">
          <UFormField :label="$t('artists.search_user')">
            <UserSelector
              v-model="selectedUser"
              v-model:search-term="searchTerm"
              :searched-users="searchedUsers"
              :searching-users="searchingUsers"
              :placeholder="$t('artists.select_user')"
              @update:model-value="handleUserSelection"
            />
          </UFormField>

          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-300 dark:border-gray-700"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-white dark:bg-gray-900 text-gray-500">
                {{ $t('artists.or_create_new') }}
              </span>
            </div>
          </div>

          <UFormField :label="$t('artists.user_email')">
            <UInput
              v-model="formData.email"
              type="email"
              :placeholder="$t('artists.user_email')"
              :disabled="!!selectedUser"
            />
          </UFormField>

          <UFormField :label="$t('artists.user_firstname')">
            <UInput
              v-model="formData.prenom"
              :placeholder="$t('artists.user_firstname')"
              :disabled="!!selectedUser"
            />
          </UFormField>

          <UFormField :label="$t('artists.user_lastname')">
            <UInput
              v-model="formData.nom"
              :placeholder="$t('artists.user_lastname')"
              :disabled="!!selectedUser"
            />
          </UFormField>
        </div>

        <!-- Informations utilisateur (mode édition) -->
        <div v-else class="space-y-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-sm font-medium text-gray-900 dark:text-white">
            {{ $t('artists.user_info') }}
          </h3>

          <UFormField :label="$t('artists.user_email')">
            <UInput
              v-model="formData.email"
              type="email"
              :placeholder="$t('artists.user_email')"
              :disabled="!isManualUser"
            />
          </UFormField>

          <UFormField :label="$t('artists.user_firstname')">
            <UInput
              v-model="formData.prenom"
              :placeholder="$t('artists.user_firstname')"
              :disabled="!isManualUser"
            />
          </UFormField>

          <UFormField :label="$t('artists.user_lastname')">
            <UInput
              v-model="formData.nom"
              :placeholder="$t('artists.user_lastname')"
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
            {{ $t('artists.user_info_readonly') }}
          </div>
        </div>

        <!-- Informations artiste -->
        <UFormField :label="$t('artists.arrival')">
          <UInput
            v-model="formData.arrivalDateTime"
            type="datetime-local"
            :placeholder="$t('artists.arrival')"
          />
        </UFormField>

        <UFormField :label="$t('artists.departure')">
          <UInput
            v-model="formData.departureDateTime"
            type="datetime-local"
            :placeholder="$t('artists.departure')"
          />
        </UFormField>

        <UFormField :label="$t('artists.dietary_preference')">
          <USelect v-model="formData.dietaryPreference" :items="dietaryOptions" value-key="value" />
        </UFormField>

        <UFormField :label="$t('artists.allergies')">
          <UTextarea v-model="formData.allergies" :placeholder="$t('artists.allergies')" rows="3" />
        </UFormField>

        <UFormField v-if="formData.allergies" :label="$t('artists.allergy_severity')">
          <USelect
            v-model="formData.allergySeverity"
            :items="allergySeverityOptions"
            value-key="value"
          />
        </UFormField>

        <!-- Paiement et défraiement -->
        <div class="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 class="text-sm font-medium text-gray-900 dark:text-white">
            {{ $t('artists.payment_section') }}
          </h3>

          <div class="grid grid-cols-2 gap-4">
            <UFormField :label="$t('artists.payment_amount')">
              <UInput
                v-model="formData.payment"
                type="number"
                step="0.01"
                min="0"
                :placeholder="$t('artists.payment_amount_placeholder')"
              >
                <template #trailing>
                  <span class="text-gray-500 dark:text-gray-400 text-sm">€</span>
                </template>
              </UInput>
            </UFormField>

            <UFormField :label="$t('artists.payment_status')">
              <UCheckbox v-model="formData.paymentPaid" :label="$t('artists.payment_paid')" />
            </UFormField>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <UFormField :label="$t('artists.reimbursement_max')">
              <UInput
                v-model="formData.reimbursementMax"
                type="number"
                step="0.01"
                min="0"
                :placeholder="$t('artists.reimbursement_max_placeholder')"
              >
                <template #trailing>
                  <span class="text-gray-500 dark:text-gray-400 text-sm">€</span>
                </template>
              </UInput>
            </UFormField>

            <UFormField :label="$t('artists.reimbursement_actual')">
              <UInput
                v-model="formData.reimbursementActual"
                type="number"
                step="0.01"
                min="0"
                :placeholder="$t('artists.reimbursement_actual_placeholder')"
              >
                <template #trailing>
                  <span class="text-gray-500 dark:text-gray-400 text-sm">€</span>
                </template>
              </UInput>
            </UFormField>
          </div>

          <div v-if="formData.reimbursementActual" class="grid grid-cols-2 gap-4">
            <div></div>
            <UFormField :label="$t('artists.reimbursement_status')">
              <UCheckbox
                v-model="formData.reimbursementActualPaid"
                :label="$t('artists.reimbursement_paid')"
              />
            </UFormField>
          </div>

          <!-- Hébergement -->
          <h3 class="text-lg font-semibold mb-3">
            {{ $t('artists.accommodation_section') }}
          </h3>

          <UFormField :label="$t('artists.accommodation_autonomous')">
            <UCheckbox
              v-model="formData.accommodationAutonomous"
              :label="$t('artists.accommodation_autonomous_label')"
            />
          </UFormField>

          <div v-if="!formData.accommodationAutonomous">
            <UFormField :label="$t('artists.accommodation_proposal')">
              <UTextarea
                v-model="formData.accommodationProposal"
                :placeholder="$t('artists.accommodation_proposal_placeholder')"
                :rows="3"
              />
            </UFormField>
          </div>

          <!-- Facture et cachet -->
          <h3 class="text-lg font-semibold mb-3 mt-4">
            {{ $t('artists.invoice_fee_section') }}
          </h3>

          <div class="grid grid-cols-2 gap-4">
            <UFormField :label="$t('artists.invoice_requested')">
              <UCheckbox
                v-model="formData.invoiceRequested"
                :label="$t('artists.invoice_requested_label')"
              />
            </UFormField>

            <UFormField :label="$t('artists.invoice_provided')">
              <UCheckbox
                v-model="formData.invoiceProvided"
                :label="$t('artists.invoice_provided_label')"
              />
            </UFormField>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <UFormField :label="$t('artists.fee_requested')">
              <UCheckbox
                v-model="formData.feeRequested"
                :label="$t('artists.fee_requested_label')"
              />
            </UFormField>

            <UFormField :label="$t('artists.fee_provided')">
              <UCheckbox v-model="formData.feeProvided" :label="$t('artists.fee_provided_label')" />
            </UFormField>
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

const title = computed(() => (props.artist ? t('artists.edit_artist') : t('artists.add_artist')))

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
  reimbursementMax: '',
  reimbursementActual: '',
  reimbursementActualPaid: false,
  accommodationAutonomous: false,
  accommodationProposal: '',
  invoiceRequested: false,
  invoiceProvided: false,
  feeRequested: false,
  feeProvided: false,
})

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
      payment: formData.value.payment ? parseFloat(formData.value.payment) : null,
      paymentPaid: formData.value.paymentPaid,
      reimbursementMax: formData.value.reimbursementMax
        ? parseFloat(formData.value.reimbursementMax)
        : null,
      reimbursementActual: formData.value.reimbursementActual
        ? parseFloat(formData.value.reimbursementActual)
        : null,
      reimbursementActualPaid: formData.value.reimbursementActualPaid,
      accommodationAutonomous: formData.value.accommodationAutonomous,
      accommodationProposal: formData.value.accommodationProposal || null,
      invoiceRequested: formData.value.invoiceRequested,
      invoiceProvided: formData.value.invoiceProvided,
      feeRequested: formData.value.feeRequested,
      feeProvided: formData.value.feeProvided,
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
      toast.add({ title: t('artists.artist_updated'), color: 'success' })
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
      toast.add({ title: t('artists.artist_added'), color: 'success' })
    }

    emit('artist-saved')
    closeModal()
  } catch (error: any) {
    console.error('Error saving artist:', error)
    toast.add({
      title: props.artist ? t('artists.error_update') : t('artists.error_add'),
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
    reimbursementMax: '',
    reimbursementActual: '',
    reimbursementActualPaid: false,
    accommodationAutonomous: false,
    accommodationProposal: '',
    invoiceRequested: false,
    invoiceProvided: false,
    feeRequested: false,
    feeProvided: false,
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
        reimbursementMax: newArtist.reimbursementMax ? newArtist.reimbursementMax.toString() : '',
        reimbursementActual: newArtist.reimbursementActual
          ? newArtist.reimbursementActual.toString()
          : '',
        reimbursementActualPaid: newArtist.reimbursementActualPaid || false,
        accommodationAutonomous: newArtist.accommodationAutonomous || false,
        accommodationProposal: newArtist.accommodationProposal || '',
        invoiceRequested: newArtist.invoiceRequested || false,
        invoiceProvided: newArtist.invoiceProvided || false,
        feeRequested: newArtist.feeRequested || false,
        feeProvided: newArtist.feeProvided || false,
      }
    } else {
      resetForm()
    }
  },
  { immediate: true }
)
</script>
