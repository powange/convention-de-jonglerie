<template>
  <div>
    <div v-if="loading">
      <p>{{ $t('common.loading') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('edition.not_found') }}</p>
    </div>
    <div v-else-if="!canAccess">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="$t('pages.access_denied.description')"
      />
    </div>
    <div v-else-if="!showCall">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        :title="$t('common.not_found')"
      />
    </div>
    <div v-else>
      <!-- Titre de la page -->
      <div class="mb-6">
        <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
          <NuxtLink
            :to="`/editions/${editionId}/gestion/shows-call`"
            class="hover:text-primary-500"
          >
            {{ $t('gestion.shows_call.title') }}
          </NuxtLink>
          <UIcon name="i-heroicons-chevron-right" />
          <span>{{ showCall.name }}</span>
        </div>
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <UIcon name="i-heroicons-cog-6-tooth" class="text-amber-500" />
              {{ showCall.name }}
            </h1>
            <p class="text-gray-600 dark:text-gray-400 mt-1">
              {{ $t('gestion.shows_call.config_description') }}
            </p>
          </div>
          <!-- Bouton Sauvegarder -->
          <UButton
            v-if="hasChanges"
            color="primary"
            icon="i-heroicons-check"
            :loading="saving"
            @click="persistSettings"
          >
            {{ $t('common.save') }}
          </UButton>
        </div>
      </div>

      <!-- Contenu de la page -->
      <div class="space-y-6">
        <!-- Nom de l'appel -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-pencil" class="text-amber-500" />
              <h2 class="text-lg font-semibold">
                {{ $t('gestion.shows_call.name_section') }}
              </h2>
            </div>

            <UFormField :label="$t('gestion.shows_call.name_label')" :error="fieldErrors.name">
              <UInput
                v-model="nameLocal"
                :placeholder="$t('gestion.shows_call.name_placeholder')"
                :disabled="saving"
                class="w-full max-w-md"
              />
            </UFormField>
          </div>
        </UCard>

        <!-- Paramètres généraux -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-cog-6-tooth" class="text-amber-500" />
              <h2 class="text-lg font-semibold">
                {{ $t('gestion.shows_call.general_settings') }}
              </h2>
            </div>

            <!-- Mode de l'appel -->
            <div class="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-medium text-gray-900 dark:text-white">
                    {{ $t('gestion.shows_call.mode_label') }}
                  </h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('gestion.shows_call.mode_description') }}
                  </p>
                </div>
                <UBadge
                  :color="modeLocal === 'INTERNAL' ? 'primary' : 'warning'"
                  variant="soft"
                  size="sm"
                >
                  {{
                    modeLocal === 'INTERNAL'
                      ? $t('gestion.shows_call.mode_internal_badge')
                      : $t('gestion.shows_call.mode_external_badge')
                  }}
                </UBadge>
              </div>

              <UFormField>
                <URadioGroup
                  v-model="modeLocal"
                  :items="modeItems"
                  size="lg"
                  class="flex flex-row gap-6"
                  :disabled="saving"
                />
              </UFormField>

              <!-- URL externe pour mode EXTERNAL -->
              <div v-if="modeLocal === 'EXTERNAL'" class="pt-2">
                <UFormField
                  :label="$t('gestion.shows_call.external_url_label')"
                  :error="fieldErrors.externalUrl"
                >
                  <UInput
                    v-model="externalUrlLocal"
                    :placeholder="$t('gestion.shows_call.external_url_placeholder')"
                    :disabled="saving"
                    class="w-full"
                  />
                </UFormField>
                <p class="text-xs text-gray-500 mt-1">
                  {{ $t('gestion.shows_call.external_url_description') }}
                </p>
              </div>
            </div>

            <!-- Ouverture de l'appel -->
            <div class="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-medium text-gray-900 dark:text-white">
                    {{ $t('gestion.shows_call.open_label') }}
                  </h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('gestion.shows_call.open_description') }}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <UBadge :color="isOpenLocal ? 'success' : 'neutral'" variant="soft">
                    {{ isOpenLocal ? $t('common.active') : $t('common.inactive') }}
                  </UBadge>
                </div>
              </div>

              <div class="flex items-center gap-3">
                <USwitch v-model="isOpenLocal" :disabled="saving" color="primary" />
                <span
                  :class="
                    isOpenLocal
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-600 dark:text-gray-400'
                  "
                >
                  {{
                    isOpenLocal
                      ? $t('gestion.shows_call.open_active')
                      : $t('gestion.shows_call.open_inactive')
                  }}
                </span>
              </div>
            </div>

            <!-- Date limite -->
            <div class="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div>
                <h3 class="font-medium text-gray-900 dark:text-white">
                  {{ $t('gestion.shows_call.deadline_label') }}
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('gestion.shows_call.deadline_description') }}
                </p>
              </div>

              <UFormField :error="fieldErrors.deadline">
                <UInput
                  v-model="deadlineLocal"
                  type="datetime-local"
                  :disabled="saving"
                  class="w-full max-w-xs"
                />
              </UFormField>
            </div>

            <!-- Description de l'appel -->
            <div class="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div>
                <h3 class="font-medium text-gray-900 dark:text-white">
                  {{ $t('gestion.shows_call.description_label') }}
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('gestion.shows_call.description_help') }}
                </p>
              </div>

              <UFormField :error="fieldErrors.description">
                <UTextarea
                  v-model="descriptionLocal"
                  :placeholder="$t('gestion.shows_call.description_placeholder')"
                  :disabled="saving"
                  :rows="4"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>
        </UCard>

        <!-- Champs du formulaire -->
        <UCard v-if="modeLocal === 'INTERNAL'">
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-clipboard-document-list" class="text-amber-500" />
              <h2 class="text-lg font-semibold">
                {{ $t('gestion.shows_call.form_fields_title') }}
              </h2>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ $t('gestion.shows_call.form_fields_description') }}
            </p>

            <div class="space-y-3">
              <!-- Portfolio URL -->
              <div
                class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
              >
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">
                    {{ $t('gestion.shows_call.field_portfolio') }}
                  </p>
                  <p class="text-sm text-gray-500">
                    {{ $t('gestion.shows_call.field_portfolio_desc') }}
                  </p>
                </div>
                <USwitch v-model="askPortfolioUrlLocal" :disabled="saving" />
              </div>

              <!-- Video URL -->
              <div
                class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
              >
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">
                    {{ $t('gestion.shows_call.field_video') }}
                  </p>
                  <p class="text-sm text-gray-500">
                    {{ $t('gestion.shows_call.field_video_desc') }}
                  </p>
                </div>
                <USwitch v-model="askVideoUrlLocal" :disabled="saving" />
              </div>

              <!-- Technical Needs -->
              <div
                class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
              >
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">
                    {{ $t('gestion.shows_call.field_technical') }}
                  </p>
                  <p class="text-sm text-gray-500">
                    {{ $t('gestion.shows_call.field_technical_desc') }}
                  </p>
                </div>
                <USwitch v-model="askTechnicalNeedsLocal" :disabled="saving" />
              </div>

              <!-- Accommodation -->
              <div
                class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
              >
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">
                    {{ $t('gestion.shows_call.field_accommodation') }}
                  </p>
                  <p class="text-sm text-gray-500">
                    {{ $t('gestion.shows_call.field_accommodation_desc') }}
                  </p>
                </div>
                <USwitch v-model="askAccommodationLocal" :disabled="saving" />
              </div>

              <!-- Departure City -->
              <div
                class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
              >
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">
                    {{ $t('gestion.shows_call.field_departure_city') }}
                  </p>
                  <p class="text-sm text-gray-500">
                    {{ $t('gestion.shows_call.field_departure_city_desc') }}
                  </p>
                </div>
                <USwitch v-model="askDepartureCityLocal" :disabled="saving" />
              </div>

              <!-- Social Links -->
              <div
                class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
              >
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">
                    {{ $t('gestion.shows_call.field_social_links') }}
                  </p>
                  <p class="text-sm text-gray-500">
                    {{ $t('gestion.shows_call.field_social_links_desc') }}
                  </p>
                </div>
                <USwitch v-model="askSocialLinksLocal" :disabled="saving" />
              </div>
            </div>
          </div>
        </UCard>

        <!-- Lien vers les candidatures -->
        <UCard>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-document-text" class="text-amber-500" size="24" />
              <div>
                <p class="font-medium text-gray-900 dark:text-white">
                  {{ $t('gestion.shows_call.view_applications') }}
                </p>
                <p class="text-sm text-gray-500">
                  {{ $t('gestion.shows_call.view_applications_desc') }}
                </p>
              </div>
            </div>
            <UButton
              color="primary"
              variant="soft"
              icon="i-heroicons-arrow-right"
              :to="`/editions/${editionId}/gestion/shows-call/${showCallId}/applications`"
            >
              {{ $t('gestion.shows_call.see_applications') }}
            </UButton>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import type { EditionShowCall } from '~/types'

definePageMeta({
  middleware: ['authenticated'],
})

const route = useRoute()
const authStore = useAuthStore()
const editionStore = useEditionStore()
const toast = useToast()
const { t } = useI18n()

const editionId = Number(route.params.id)
const showCallId = Number(route.params.showCallId)

// Charger les données de l'édition
const { data: edition, pending: loading } = await useFetch(`/api/editions/${editionId}`, {
  key: `edition-${editionId}`,
})

// Variables locales
const showCall = ref<EditionShowCall | null>(null)
const nameLocal = ref('')
const isOpenLocal = ref(false)
const modeLocal = ref<'INTERNAL' | 'EXTERNAL'>('INTERNAL')
const externalUrlLocal = ref('')
const descriptionLocal = ref('')
const deadlineLocal = ref('')
const askPortfolioUrlLocal = ref(true)
const askVideoUrlLocal = ref(true)
const askTechnicalNeedsLocal = ref(true)
const askAccommodationLocal = ref(false)
const askDepartureCityLocal = ref(false)
const askSocialLinksLocal = ref(false)

const saving = ref(false)
const fieldErrors = ref<Record<string, string>>({})
const initialized = ref(false)

// État initial pour détecter les changements
const initialState = ref({
  name: '',
  isOpen: false,
  mode: 'INTERNAL' as 'INTERNAL' | 'EXTERNAL',
  externalUrl: '',
  description: '',
  deadline: '',
  askPortfolioUrl: true,
  askVideoUrl: true,
  askTechnicalNeeds: true,
  askAccommodation: false,
  askDepartureCity: false,
  askSocialLinks: false,
})

// Détecter si des changements ont été faits
const hasChanges = computed(() => {
  if (!initialized.value) return false
  return (
    nameLocal.value !== initialState.value.name ||
    isOpenLocal.value !== initialState.value.isOpen ||
    modeLocal.value !== initialState.value.mode ||
    externalUrlLocal.value !== initialState.value.externalUrl ||
    descriptionLocal.value !== initialState.value.description ||
    deadlineLocal.value !== initialState.value.deadline ||
    askPortfolioUrlLocal.value !== initialState.value.askPortfolioUrl ||
    askVideoUrlLocal.value !== initialState.value.askVideoUrl ||
    askTechnicalNeedsLocal.value !== initialState.value.askTechnicalNeeds ||
    askAccommodationLocal.value !== initialState.value.askAccommodation ||
    askDepartureCityLocal.value !== initialState.value.askDepartureCity ||
    askSocialLinksLocal.value !== initialState.value.askSocialLinks
  )
})

const modeItems = computed(() => [
  { value: 'INTERNAL', label: t('gestion.shows_call.mode_internal') },
  { value: 'EXTERNAL', label: t('gestion.shows_call.mode_external') },
])

// Permissions
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const canManageArtists = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageArtists(edition.value, authStore.user.id)
})

const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return canEdit.value || canManageArtists.value
})

// Charger les paramètres
const fetchSettings = async () => {
  try {
    const response = await $fetch<EditionShowCall>(
      `/api/editions/${editionId}/shows-call/${showCallId}`
    )
    showCall.value = response
    nameLocal.value = response.name
    isOpenLocal.value = response.isOpen ?? false
    modeLocal.value = response.mode ?? 'INTERNAL'
    externalUrlLocal.value = response.externalUrl ?? ''
    descriptionLocal.value = response.description ?? ''
    askPortfolioUrlLocal.value = response.askPortfolioUrl ?? true
    askVideoUrlLocal.value = response.askVideoUrl ?? true
    askTechnicalNeedsLocal.value = response.askTechnicalNeeds ?? true
    askAccommodationLocal.value = response.askAccommodation ?? false
    askDepartureCityLocal.value = response.askDepartureCity ?? false
    askSocialLinksLocal.value = response.askSocialLinks ?? false

    // Formater la date pour l'input datetime-local
    if (response.deadline) {
      const date = new Date(response.deadline)
      deadlineLocal.value = date.toISOString().slice(0, 16)
    } else {
      deadlineLocal.value = ''
    }

    // Sauvegarder l'état initial pour détecter les changements
    updateInitialState()

    initialized.value = true
  } catch (error: any) {
    console.error('Error fetching show call settings:', error)
    if (error?.statusCode === 404 || error?.status === 404) {
      showCall.value = null
    }
  }
}

// Mettre à jour l'état initial
const updateInitialState = () => {
  initialState.value = {
    name: nameLocal.value,
    isOpen: isOpenLocal.value,
    mode: modeLocal.value,
    externalUrl: externalUrlLocal.value,
    description: descriptionLocal.value,
    deadline: deadlineLocal.value,
    askPortfolioUrl: askPortfolioUrlLocal.value,
    askVideoUrl: askVideoUrlLocal.value,
    askTechnicalNeeds: askTechnicalNeedsLocal.value,
    askAccommodation: askAccommodationLocal.value,
    askDepartureCity: askDepartureCityLocal.value,
    askSocialLinks: askSocialLinksLocal.value,
  }
}

// Sauvegarder les paramètres
const persistSettings = async () => {
  if (!initialized.value) return

  saving.value = true
  fieldErrors.value = {}

  try {
    const body: any = {
      name: nameLocal.value.trim(),
      isOpen: isOpenLocal.value,
      mode: modeLocal.value,
      description: descriptionLocal.value || null,
      deadline: deadlineLocal.value ? new Date(deadlineLocal.value).toISOString() : null,
      askPortfolioUrl: askPortfolioUrlLocal.value,
      askVideoUrl: askVideoUrlLocal.value,
      askTechnicalNeeds: askTechnicalNeedsLocal.value,
      askAccommodation: askAccommodationLocal.value,
      askDepartureCity: askDepartureCityLocal.value,
      askSocialLinks: askSocialLinksLocal.value,
    }

    if (modeLocal.value === 'EXTERNAL') {
      body.externalUrl = externalUrlLocal.value.trim() || null
    }

    const updated = await $fetch<{ success: boolean; showCall: EditionShowCall }>(
      `/api/editions/${editionId}/shows-call/${showCallId}`,
      {
        method: 'PUT',
        body,
      }
    )

    if (updated.showCall) {
      showCall.value = updated.showCall
    }

    // Mettre à jour l'état initial après une sauvegarde réussie
    updateInitialState()

    toast.add({
      title: t('common.saved'),
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })
  } catch (error: any) {
    // Gérer les erreurs de validation Zod
    if (error?.data?.data?.issues) {
      for (const issue of error.data.data.issues) {
        const path = issue.path.join('.')
        fieldErrors.value[path] = issue.message
      }
    }

    toast.add({
      title: error?.data?.message || t('common.error'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    saving.value = false
  }
}

// Charger les paramètres au montage
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }

  await fetchSettings()
})

useSeoMeta({
  title: () => showCall.value?.name || t('gestion.shows_call.config_title'),
})
</script>
