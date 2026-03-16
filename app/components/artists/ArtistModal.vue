<template>
  <UModal v-model:open="isOpen" :title="title">
    <template #body>
      <form class="space-y-5" @submit.prevent="handleSubmit">
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
              class="w-full"
            />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </div>

        <!-- Informations utilisateur (mode édition) -->
        <div
          v-else
          class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-4 border border-gray-200 dark:border-gray-800"
        >
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-user" class="size-4 text-gray-600 dark:text-gray-400" />
            <h3 class="text-sm font-medium text-gray-800 dark:text-gray-200">
              {{ $t('artists.user_info') }}
            </h3>
          </div>

          <UFormField :label="$t('artists.user_email')">
            <UInput
              v-model="formData.email"
              type="email"
              :placeholder="$t('artists.user_email')"
              :disabled="!isManualUser"
              class="w-full"
            />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>

          <UFormField :label="$t('edition.ticketing.phone')">
            <UInput
              v-model="formData.phone"
              type="tel"
              :placeholder="$t('edition.ticketing.phone')"
              :disabled="!isManualUser"
              class="w-full"
            />
          </UFormField>

          <p v-if="!isManualUser" class="text-xs text-gray-500 dark:text-gray-400">
            {{ $t('artists.user_info_readonly') }}
          </p>
        </div>

        <!-- Présence -->
        <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-calendar" class="size-4 text-blue-600 dark:text-blue-400" />
            <h3 class="text-sm font-medium text-blue-800 dark:text-blue-200">
              {{ $t('artists.presence_section') }}
            </h3>
          </div>

          <UiDateTimePicker
            v-model="formData.arrivalDateTime"
            :date-label="$t('artists.arrival_date')"
            :time-label="$t('artists.arrival_time')"
            :placeholder="$t('artists.arrival')"
          />

          <UiDateTimePicker
            v-model="formData.departureDateTime"
            :date-label="$t('artists.departure_date')"
            :time-label="$t('artists.departure_time')"
            :placeholder="$t('artists.departure')"
          />
        </div>

        <!-- Alimentation -->
        <div class="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 space-y-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-utensils" class="size-4 text-orange-600 dark:text-orange-400" />
            <h3 class="text-sm font-medium text-orange-800 dark:text-orange-200">
              {{ $t('artists.dietary_section') }}
            </h3>
          </div>

          <UFormField :label="$t('artists.dietary_preference')">
            <USelect
              v-model="formData.dietaryPreference"
              :items="dietaryOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="$t('artists.allergies')">
            <UTextarea
              v-model="formData.allergies"
              :placeholder="$t('artists.allergies')"
              rows="3"
              class="w-full"
            />
          </UFormField>

          <UFormField v-if="formData.allergies" :label="$t('artists.allergy_severity')">
            <USelect
              v-model="formData.allergySeverity"
              :items="allergySeverityOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Paiement et défraiement -->
        <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 space-y-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-banknote" class="size-4 text-green-600 dark:text-green-400" />
            <h3 class="text-sm font-medium text-green-800 dark:text-green-200">
              {{ $t('artists.payment_section') }}
            </h3>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <UFormField
            v-if="formData.reimbursementActual"
            :label="$t('artists.reimbursement_status')"
          >
            <UCheckbox
              v-model="formData.reimbursementActualPaid"
              :label="$t('artists.reimbursement_paid')"
            />
          </UFormField>
        </div>

        <!-- Hébergement -->
        <div class="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 space-y-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-bed-double" class="size-4 text-purple-600 dark:text-purple-400" />
            <h3 class="text-sm font-medium text-purple-800 dark:text-purple-200">
              {{ $t('artists.accommodation_section') }}
            </h3>
          </div>

          <UFormField :label="$t('artists.accommodation_autonomous')">
            <UCheckbox
              v-model="formData.accommodationAutonomous"
              :label="$t('artists.accommodation_autonomous_label')"
            />
          </UFormField>

          <UFormField :label="$t('artists.accommodation_type')">
            <USelect
              v-model="formData.accommodationType"
              :items="accommodationTypeOptions"
              value-key="value"
              :placeholder="$t('artists.accommodation_not_specified')"
              :ui="{ content: 'min-w-fit' }"
              class="w-full"
            />
          </UFormField>

          <UFormField
            v-if="formData.accommodationType === 'OTHER'"
            :label="$t('artists.accommodation_type_other')"
          >
            <UInput
              v-model="formData.accommodationTypeOther"
              :placeholder="$t('artists.accommodation_type_other_placeholder')"
              class="w-full"
            />
          </UFormField>

          <UFormField
            v-if="!formData.accommodationAutonomous"
            :label="$t('artists.accommodation_proposal')"
          >
            <UTextarea
              v-model="formData.accommodationProposal"
              :placeholder="$t('artists.accommodation_proposal_placeholder')"
              :rows="3"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Facture et cachet -->
        <div class="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 space-y-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-file-text" class="size-4 text-amber-600 dark:text-amber-400" />
            <h3 class="text-sm font-medium text-amber-800 dark:text-amber-200">
              {{ $t('artists.invoice_fee_section') }}
            </h3>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <!-- Récupération et retour -->
        <div class="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-4 space-y-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-car" class="size-4 text-teal-600 dark:text-teal-400" />
            <h3 class="text-sm font-medium text-teal-800 dark:text-teal-200">
              {{ $t('artists.pickup_dropoff_section') }}
            </h3>
          </div>

          <!-- Récupération -->
          <div class="space-y-3">
            <UFormField :label="$t('artists.pickup_required')">
              <UCheckbox
                v-model="formData.pickupRequired"
                :label="$t('artists.pickup_required_label')"
              />
            </UFormField>

            <div
              v-if="formData.pickupRequired"
              class="space-y-3 pl-6 border-l-2 border-teal-300 dark:border-teal-700"
            >
              <UFormField :label="$t('artists.pickup_location')">
                <UInput
                  v-model="formData.pickupLocation"
                  :placeholder="$t('artists.pickup_location_placeholder')"
                  class="w-full"
                />
              </UFormField>

              <UFormField :label="$t('artists.pickup_responsible')">
                <UserSelector
                  v-model="formData.pickupResponsible"
                  v-model:search-term="pickupSearchTerm"
                  :searched-users="pickupSearchedUsers"
                  :searching-users="searchingPickupUsers"
                  :placeholder="$t('artists.pickup_responsible_placeholder')"
                />
              </UFormField>
            </div>
          </div>

          <!-- Retour -->
          <div class="space-y-3">
            <UFormField :label="$t('artists.dropoff_required')">
              <UCheckbox
                v-model="formData.dropoffRequired"
                :label="$t('artists.dropoff_required_label')"
              />
            </UFormField>

            <div
              v-if="formData.dropoffRequired"
              class="space-y-3 pl-6 border-l-2 border-teal-300 dark:border-teal-700"
            >
              <UFormField :label="$t('artists.dropoff_location')">
                <UInput
                  v-model="formData.dropoffLocation"
                  :placeholder="$t('artists.dropoff_location_placeholder')"
                  class="w-full"
                />
              </UFormField>

              <UFormField :label="$t('artists.dropoff_responsible')">
                <UserSelector
                  v-model="formData.dropoffResponsible"
                  v-model:search-term="dropoffSearchTerm"
                  :searched-users="dropoffSearchedUsers"
                  :searching-users="searchingDropoffUsers"
                  :placeholder="$t('artists.dropoff_responsible_placeholder')"
                />
              </UFormField>
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
import { getAccommodationTypeSelectOptions } from '~/utils/accommodation-type'
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

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const title = computed(() => (props.artist ? t('artists.edit_artist') : t('artists.add_artist')))

const selectedUser = ref<any>(null)
const searchTerm = ref('')
const searchedUsers = ref<any[]>([])
const searchingUsers = ref(false)

// Variables pour la recherche des responsables pickup/dropoff
const pickupSearchTerm = ref('')
const pickupSearchedUsers = ref<any[]>([])
const searchingPickupUsers = ref(false)
const dropoffSearchTerm = ref('')
const dropoffSearchedUsers = ref<any[]>([])
const searchingDropoffUsers = ref(false)

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
  accommodationType: null as string | null,
  accommodationTypeOther: '',
  accommodationProposal: '',
  invoiceRequested: false,
  invoiceProvided: false,
  feeRequested: false,
  feeProvided: false,
  pickupRequired: false,
  pickupLocation: '',
  pickupResponsible: null as any,
  dropoffRequired: false,
  dropoffLocation: '',
  dropoffResponsible: null as any,
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

const accommodationTypeOptions = computed(() => getAccommodationTypeSelectOptions(t))

const allergySeverityOptions = computed(() =>
  getAllergySeveritySelectOptions().map((option) => ({
    value: option.value,
    label: t(option.label),
  }))
)

// Fonction helper pour rechercher des utilisateurs par email exact
const searchUsers = async (email: string) => {
  // Validation basique d'email
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return []
  try {
    const response = await $fetch<{ users: any[] }>('/api/users/search', {
      params: { emailExact: email },
    })
    return (response.users || []).map((user) => ({
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
    return []
  }
}

// Recherche d'utilisateurs par email exact
watch(searchTerm, async (newTerm) => {
  // Validation basique d'email
  if (!newTerm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newTerm)) {
    searchedUsers.value = []
    return
  }
  searchingUsers.value = true
  searchedUsers.value = await searchUsers(newTerm)
  searchingUsers.value = false
})

// Recherche des responsables pickup par email exact
watch(pickupSearchTerm, async (newTerm) => {
  // Validation basique d'email
  if (!newTerm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newTerm)) {
    pickupSearchedUsers.value = []
    return
  }
  searchingPickupUsers.value = true
  pickupSearchedUsers.value = await searchUsers(newTerm)
  searchingPickupUsers.value = false
})

// Recherche des responsables dropoff par email exact
watch(dropoffSearchTerm, async (newTerm) => {
  // Validation basique d'email
  if (!newTerm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newTerm)) {
    dropoffSearchedUsers.value = []
    return
  }
  searchingDropoffUsers.value = true
  dropoffSearchedUsers.value = await searchUsers(newTerm)
  searchingDropoffUsers.value = false
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

// Construit les données de base pour l'API (commun création/modification)
const buildBasePayload = () => ({
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
  accommodationType: formData.value.accommodationType || null,
  accommodationTypeOther:
    formData.value.accommodationType === 'OTHER'
      ? formData.value.accommodationTypeOther || null
      : null,
  accommodationProposal: formData.value.accommodationProposal || null,
  invoiceRequested: formData.value.invoiceRequested,
  invoiceProvided: formData.value.invoiceProvided,
  feeRequested: formData.value.feeRequested,
  feeProvided: formData.value.feeProvided,
  pickupRequired: formData.value.pickupRequired,
  pickupLocation: formData.value.pickupLocation || null,
  pickupResponsibleId: formData.value.pickupResponsible?.id || null,
  dropoffRequired: formData.value.dropoffRequired,
  dropoffLocation: formData.value.dropoffLocation || null,
  dropoffResponsibleId: formData.value.dropoffResponsible?.id || null,
})

// Payload pour la modification (inclut les champs user si MANUAL)
const buildUpdatePayload = () => {
  const payload: Record<string, unknown> = buildBasePayload()
  if (isManualUser.value) {
    payload.userEmail = formData.value.email
    payload.userPrenom = formData.value.prenom
    payload.userNom = formData.value.nom
    payload.userPhone = formData.value.phone || null
  }
  return payload
}

// Payload pour la création (inclut userId ou données utilisateur)
const buildCreatePayload = () => {
  const payload: Record<string, unknown> = buildBasePayload()
  if (selectedUser.value) {
    payload.userId = selectedUser.value.id
  } else {
    payload.email = formData.value.email
    payload.prenom = formData.value.prenom
    payload.nom = formData.value.nom
  }
  return payload
}

// Callback commun après succès
const onSaveSuccess = () => {
  emit('artist-saved')
  closeModal()
}

// Action pour créer un artiste
const { execute: executeCreate, loading: isCreating } = useApiAction(
  () => `/api/editions/${props.editionId}/artists`,
  {
    method: 'POST',
    body: buildCreatePayload,
    successMessage: { title: t('artists.artist_added') },
    errorMessages: { default: t('artists.error_add') },
    onSuccess: onSaveSuccess,
  }
)

// Action pour modifier un artiste
const { execute: executeUpdate, loading: isUpdating } = useApiAction(
  () => `/api/editions/${props.editionId}/artists/${props.artist?.id}`,
  {
    method: 'PUT',
    body: buildUpdatePayload,
    successMessage: { title: t('artists.artist_updated') },
    errorMessages: { default: t('artists.error_update') },
    onSuccess: onSaveSuccess,
  }
)

// État de chargement combiné
const loading = computed(() => isCreating.value || isUpdating.value)

const handleSubmit = () => {
  if (props.artist) {
    executeUpdate()
  } else {
    executeCreate()
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
  pickupSearchTerm.value = ''
  pickupSearchedUsers.value = []
  dropoffSearchTerm.value = ''
  dropoffSearchedUsers.value = []
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
    accommodationType: null as string | null,
    accommodationTypeOther: '',
    accommodationProposal: '',
    invoiceRequested: false,
    invoiceProvided: false,
    feeRequested: false,
    feeProvided: false,
    pickupRequired: false,
    pickupLocation: '',
    pickupResponsible: null,
    dropoffRequired: false,
    dropoffLocation: '',
    dropoffResponsible: null,
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
        accommodationType: newArtist.accommodationType || null,
        accommodationTypeOther: newArtist.accommodationTypeOther || '',
        accommodationProposal: newArtist.accommodationProposal || '',
        invoiceRequested: newArtist.invoiceRequested || false,
        invoiceProvided: newArtist.invoiceProvided || false,
        feeRequested: newArtist.feeRequested || false,
        feeProvided: newArtist.feeProvided || false,
        pickupRequired: newArtist.pickupRequired || false,
        pickupLocation: newArtist.pickupLocation || '',
        pickupResponsible: newArtist.pickupResponsible || null,
        dropoffRequired: newArtist.dropoffRequired || false,
        dropoffLocation: newArtist.dropoffLocation || '',
        dropoffResponsible: newArtist.dropoffResponsible || null,
      }
    } else {
      resetForm()
    }
  },
  { immediate: true }
)
</script>
