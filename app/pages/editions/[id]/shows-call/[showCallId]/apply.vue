<template>
  <div v-if="edition">
    <EditionHeader :edition="edition" current-page="shows-call" />

    <div class="max-w-3xl mx-auto space-y-6">
      <!-- Message si l'utilisateur n'est pas connecté -->
      <UAlert
        v-if="!authStore.isAuthenticated"
        icon="i-heroicons-information-circle"
        color="info"
        variant="soft"
      >
        <template #title>
          {{ t('shows_call.login_required') }}
        </template>
        <template #description>
          <div class="flex items-center gap-4">
            <span>{{ t('shows_call.login_required_desc') }}</span>
            <UButton
              color="primary"
              size="sm"
              icon="i-heroicons-arrow-right-on-rectangle"
              :to="`/login?redirect=/editions/${editionId}/shows-call/${showCallId}/apply`"
            >
              {{ t('shows_call.login_button') }}
            </UButton>
          </div>
        </template>
      </UAlert>

      <!-- Message si l'utilisateur n'est pas artiste -->
      <UAlert
        v-else-if="!authStore.isArtist"
        icon="i-heroicons-exclamation-triangle"
        color="warning"
        variant="soft"
      >
        <template #title>
          {{ t('shows_call.artist_required') }}
        </template>
        <template #description>
          <div class="flex items-center gap-4">
            <span>{{ t('shows_call.artist_required_desc') }}</span>
            <UButton color="primary" size="sm" icon="i-heroicons-user-circle" to="/profile">
              {{ t('shows_call.update_profile') }}
            </UButton>
          </div>
        </template>
      </UAlert>

      <!-- État de chargement -->
      <div v-else-if="loading" class="flex justify-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
      </div>

      <!-- Erreur -->
      <UAlert
        v-else-if="error"
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
      >
        <template #title>
          {{ t('common.error') }}
        </template>
        <template #description>
          {{ error.message || t('shows_call.load_error') }}
        </template>
      </UAlert>

      <!-- Appel fermé -->
      <UAlert
        v-else-if="showCall && !showCall.isOpen"
        icon="i-heroicons-lock-closed"
        color="warning"
        variant="soft"
      >
        <template #title>
          {{ t('shows_call.call_closed') }}
        </template>
        <template #description>
          {{ t('shows_call.call_closed_desc') }}
        </template>
      </UAlert>

      <!-- Date limite dépassée -->
      <UAlert
        v-else-if="showCall && isDeadlinePassed"
        icon="i-heroicons-clock"
        color="error"
        variant="soft"
      >
        <template #title>
          {{ t('shows_call.deadline_passed') }}
        </template>
        <template #description>
          {{
            t('shows_call.deadline_passed_desc', {
              date: formatDate(showCall.deadline),
            })
          }}
        </template>
      </UAlert>

      <!-- Déjà candidaté -->
      <UAlert
        v-else-if="hasAlreadyApplied"
        icon="i-heroicons-check-circle"
        color="success"
        variant="soft"
      >
        <template #title>
          {{ t('shows_call.already_applied') }}
        </template>
        <template #description>
          <div class="flex items-center gap-4">
            <span>{{ t('shows_call.already_applied_desc') }}</span>
            <UButton
              color="primary"
              variant="soft"
              size="sm"
              icon="i-heroicons-arrow-left"
              :to="`/editions/${editionId}/shows-call`"
            >
              {{ t('shows_call.back_to_list') }}
            </UButton>
          </div>
        </template>
      </UAlert>

      <!-- Mode externe -->
      <UAlert
        v-else-if="showCall && showCall.mode === 'EXTERNAL'"
        icon="i-heroicons-arrow-top-right-on-square"
        color="info"
        variant="soft"
      >
        <template #title>
          {{ t('shows_call.external_mode') }}
        </template>
        <template #description>
          <div class="flex items-center gap-4">
            <span>{{ t('shows_call.external_mode_desc') }}</span>
            <UButton
              v-if="showCall.externalUrl"
              color="primary"
              size="sm"
              icon="i-heroicons-arrow-top-right-on-square"
              :to="showCall.externalUrl"
              target="_blank"
            >
              {{ t('shows_call.apply_external') }}
            </UButton>
          </div>
        </template>
      </UAlert>

      <!-- Formulaire de candidature (création ou modification) -->
      <template
        v-else-if="
          showCall && showCall.isOpen && authStore.isArtist && (!hasAlreadyApplied || isEditMode)
        "
      >
        <!-- En-tête -->
        <UCard variant="soft">
          <template #header>
            <div class="flex items-center gap-3">
              <UButton
                icon="i-heroicons-arrow-left"
                variant="ghost"
                color="neutral"
                size="sm"
                :to="`/editions/${editionId}/shows-call`"
              />
              <div>
                <h1 class="text-xl font-bold">{{ showCall.name }}</h1>
                <p class="text-sm text-gray-500">
                  {{ t('shows_call.apply_to') }} {{ getEditionDisplayName(edition) }}
                </p>
              </div>
            </div>
          </template>

          <!-- Description de l'appel -->
          <div v-if="showCall.description" class="prose prose-sm max-w-none mb-4">
            <p class="text-gray-600 dark:text-gray-400">{{ showCall.description }}</p>
          </div>

          <!-- Date limite -->
          <div v-if="showCall.deadline" class="flex items-center gap-2 text-sm text-gray-500">
            <UIcon name="i-heroicons-clock" />
            <span>
              {{ t('shows_call.deadline') }} :
              <strong>{{ formatDate(showCall.deadline) }}</strong>
            </span>
          </div>
        </UCard>

        <!-- Formulaire -->
        <UCard variant="soft">
          <template #header>
            <h2 class="text-lg font-semibold">
              {{ isEditMode ? t('shows_call.edit_form_title') : t('shows_call.form_title') }}
            </h2>
          </template>

          <UForm
            :state="formState"
            :validate="validate"
            class="space-y-6"
            @submit="submitApplication"
          >
            <!-- Section: Informations personnelles -->
            <div class="space-y-4">
              <h3 class="font-medium text-gray-700 dark:text-gray-300 border-b pb-2">
                {{ t('shows_call.personal_info') }}
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('shows_call.personal_info_desc') }}
              </p>

              <div class="grid grid-cols-2 gap-4">
                <UFormField :label="t('common.last_name')" name="lastName" required>
                  <UInput
                    v-model="formState.lastName"
                    :placeholder="t('shows_call.form.last_name_placeholder')"
                    size="lg"
                    class="w-full"
                  />
                </UFormField>

                <UFormField :label="t('common.first_name')" name="firstName" required>
                  <UInput
                    v-model="formState.firstName"
                    :placeholder="t('shows_call.form.first_name_placeholder')"
                    size="lg"
                    class="w-full"
                  />
                </UFormField>
              </div>

              <UFormField :label="t('common.phone')" name="phone" required>
                <UInput
                  v-model="formState.phone"
                  type="tel"
                  :placeholder="t('shows_call.form.phone_placeholder')"
                  size="lg"
                  class="w-full"
                />
              </UFormField>
            </div>

            <!-- Section: Informations artiste -->
            <div class="space-y-4">
              <h3 class="font-medium text-gray-700 dark:text-gray-300 border-b pb-2">
                {{ t('gestion.shows_call.artist_info') }}
              </h3>

              <UFormField
                :label="t('gestion.shows_call.form.artist_name')"
                name="artistName"
                required
              >
                <UInput
                  v-model="formState.artistName"
                  :placeholder="t('shows_call.form.artist_name_placeholder')"
                  size="lg"
                  class="w-full"
                />
              </UFormField>

              <UFormField :label="t('gestion.shows_call.form.artist_bio')" name="artistBio">
                <UTextarea
                  v-model="formState.artistBio"
                  :placeholder="t('shows_call.form.artist_bio_placeholder')"
                  :rows="3"
                  size="lg"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                v-if="showCall.askPortfolioUrl"
                :label="t('gestion.shows_call.form.portfolio_url')"
                name="portfolioUrl"
              >
                <UInput
                  v-model="formState.portfolioUrl"
                  type="url"
                  placeholder="https://"
                  size="lg"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                v-if="showCall.askVideoUrl"
                :label="t('gestion.shows_call.form.video_url')"
                name="videoUrl"
              >
                <UInput
                  v-model="formState.videoUrl"
                  type="url"
                  placeholder="https://"
                  size="lg"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                v-if="showCall.askSocialLinks"
                :label="t('shows_call.form.social_links')"
                name="socialLinks"
              >
                <UTextarea
                  v-model="formState.socialLinks"
                  :placeholder="t('shows_call.form.social_links_placeholder')"
                  :rows="3"
                  size="lg"
                  class="w-full"
                />
                <template #hint>
                  <span class="text-xs text-gray-500">
                    {{ t('shows_call.form.social_links_hint') }}
                  </span>
                </template>
              </UFormField>
            </div>

            <!-- Section: Informations spectacle -->
            <div class="space-y-4">
              <h3 class="font-medium text-gray-700 dark:text-gray-300 border-b pb-2">
                {{ t('gestion.shows_call.show_info') }}
              </h3>

              <UFormField
                :label="t('gestion.shows_call.form.show_title')"
                name="showTitle"
                required
              >
                <UInput
                  v-model="formState.showTitle"
                  :placeholder="t('shows_call.form.show_title_placeholder')"
                  size="lg"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                :label="t('gestion.shows_call.form.description')"
                name="showDescription"
                required
              >
                <UTextarea
                  v-model="formState.showDescription"
                  :placeholder="t('shows_call.form.show_description_placeholder')"
                  :rows="5"
                  size="lg"
                  class="w-full"
                />
              </UFormField>

              <div class="grid grid-cols-2 gap-4">
                <UFormField
                  :label="t('gestion.shows_call.form.duration')"
                  name="showDuration"
                  required
                >
                  <UInput
                    v-model.number="formState.showDuration"
                    type="number"
                    min="1"
                    max="180"
                    :placeholder="t('shows_call.form.duration_placeholder')"
                    size="lg"
                    class="w-full"
                  />
                </UFormField>

                <UFormField :label="t('gestion.shows_call.form.category')" name="showCategory">
                  <UInput
                    v-model="formState.showCategory"
                    :placeholder="t('shows_call.form.category_placeholder')"
                    size="lg"
                    class="w-full"
                  />
                </UFormField>
              </div>

              <UFormField
                v-if="showCall.askTechnicalNeeds"
                :label="t('gestion.shows_call.form.technical_needs')"
                name="technicalNeeds"
              >
                <UTextarea
                  v-model="formState.technicalNeeds"
                  :placeholder="t('shows_call.form.technical_needs_placeholder')"
                  :rows="3"
                  size="lg"
                  class="w-full"
                />
              </UFormField>
            </div>

            <!-- Section: Personnes supplémentaires -->
            <div class="space-y-4">
              <h3 class="font-medium text-gray-700 dark:text-gray-300 border-b pb-2">
                {{ t('shows_call.additional_performers') }}
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('shows_call.additional_performers_desc') }}
              </p>

              <UFormField
                :label="t('shows_call.form.additional_performers_count')"
                name="additionalPerformersCount"
                required
              >
                <UInput
                  v-model.number="formState.additionalPerformersCount"
                  type="number"
                  min="0"
                  max="50"
                  :placeholder="t('shows_call.form.additional_performers_count_placeholder')"
                  size="lg"
                  class="w-full max-w-xs"
                />
                <template #hint>
                  <span class="text-xs text-gray-500">
                    {{ t('shows_call.form.additional_performers_count_hint') }}
                  </span>
                </template>
              </UFormField>

              <!-- Liste des personnes supplémentaires -->
              <div v-if="formState.additionalPerformersCount > 0" class="space-y-4">
                <div
                  v-for="(performer, index) in formState.additionalPerformers"
                  :key="index"
                  class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-3"
                >
                  <div class="flex items-center justify-between">
                    <h4 class="font-medium text-gray-700 dark:text-gray-300">
                      {{ t('shows_call.form.performer_number', { number: index + 1 }) }}
                    </h4>
                  </div>

                  <div class="grid grid-cols-2 gap-3">
                    <UFormField
                      :label="t('common.last_name')"
                      :name="`additionalPerformers.${index}.lastName`"
                      required
                    >
                      <UInput
                        v-model="performer.lastName"
                        :placeholder="t('shows_call.form.last_name_placeholder')"
                        size="lg"
                        class="w-full"
                      />
                    </UFormField>

                    <UFormField
                      :label="t('common.first_name')"
                      :name="`additionalPerformers.${index}.firstName`"
                      required
                    >
                      <UInput
                        v-model="performer.firstName"
                        :placeholder="t('shows_call.form.first_name_placeholder')"
                        size="lg"
                        class="w-full"
                      />
                    </UFormField>
                  </div>

                  <UFormField
                    :label="t('common.email')"
                    :name="`additionalPerformers.${index}.email`"
                    required
                  >
                    <UInput
                      v-model="performer.email"
                      type="email"
                      :placeholder="t('shows_call.form.email_placeholder')"
                      size="lg"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField
                    :label="t('common.phone')"
                    :name="`additionalPerformers.${index}.phone`"
                    required
                  >
                    <UInput
                      v-model="performer.phone"
                      type="tel"
                      :placeholder="t('shows_call.form.phone_placeholder')"
                      size="lg"
                      class="w-full"
                    />
                  </UFormField>
                </div>
              </div>
            </div>

            <!-- Section: Logistique -->
            <div v-if="showCall.askAccommodation || showCall.askDepartureCity" class="space-y-4">
              <h3 class="font-medium text-gray-700 dark:text-gray-300 border-b pb-2">
                {{ t('gestion.shows_call.logistics') }}
              </h3>

              <!-- Ville de départ -->
              <UFormField
                v-if="showCall.askDepartureCity"
                :label="t('shows_call.form.departure_city')"
                name="departureCity"
              >
                <UInput
                  v-model="formState.departureCity"
                  :placeholder="t('shows_call.form.departure_city_placeholder')"
                  size="lg"
                  class="w-full"
                />
                <template #hint>
                  <span class="text-xs text-gray-500">
                    {{ t('shows_call.form.departure_city_hint') }}
                  </span>
                </template>
              </UFormField>

              <!-- Hébergement -->
              <template v-if="showCall.askAccommodation">
                <UFormField name="accommodationNeeded">
                  <UCheckbox
                    v-model="formState.accommodationNeeded"
                    :label="t('shows_call.form.accommodation_needed')"
                  />
                </UFormField>

                <UFormField
                  v-if="formState.accommodationNeeded"
                  :label="t('shows_call.form.accommodation_notes')"
                  name="accommodationNotes"
                >
                  <UTextarea
                    v-model="formState.accommodationNotes"
                    :placeholder="t('shows_call.form.accommodation_notes_placeholder')"
                    :rows="2"
                    size="lg"
                    class="w-full"
                  />
                </UFormField>
              </template>
            </div>

            <!-- Bouton de soumission -->
            <div class="flex justify-end gap-3 pt-4 border-t">
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                :to="`/editions/${editionId}/shows-call`"
              >
                {{ t('common.cancel') }}
              </UButton>
              <UButton
                type="submit"
                color="primary"
                :loading="submitting"
                icon="i-heroicons-paper-airplane"
              >
                {{
                  isEditMode
                    ? t('shows_call.update_application')
                    : t('shows_call.submit_application')
                }}
              </UButton>
            </div>
          </UForm>
        </UCard>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import type { Edition, EditionShowCallPublic, ShowApplication } from '~/types'
import { getEditionDisplayName } from '~/utils/editionName'

import type { FormSubmitEvent } from '@nuxt/ui'

const route = useRoute()
const authStore = useAuthStore()
const editionStore = useEditionStore()
const toast = useToast()
const { t } = useI18n()
const { formatDate } = useDateFormat()

const editionId = parseInt(route.params.id as string)
const showCallId = parseInt(route.params.showCallId as string)

// Type pour une personne supplémentaire
interface AdditionalPerformer {
  lastName: string
  firstName: string
  email: string
  phone: string
}

// État du formulaire
const formState = reactive({
  // Informations personnelles (profil)
  lastName: '',
  firstName: '',
  phone: '',
  // Informations artiste
  artistName: '',
  artistBio: '',
  portfolioUrl: '',
  videoUrl: '',
  socialLinks: '',
  showTitle: '',
  showDescription: '',
  showDuration: null as number | null,
  showCategory: '',
  technicalNeeds: '',
  accommodationNeeded: false,
  accommodationNotes: '',
  departureCity: '',
  // Personnes supplémentaires
  additionalPerformersCount: 0,
  additionalPerformers: [] as AdditionalPerformer[],
})

const submitting = ref(false)
const existingApplication = ref<ShowApplication | null>(null)

// Mode édition si une candidature existe et est en attente
const isEditMode = computed(() => existingApplication.value?.status === 'PENDING')
const hasAlreadyApplied = computed(
  () => existingApplication.value !== null && existingApplication.value.status !== 'PENDING'
)

// Charger l'édition
const {
  data: edition,
  pending: _editionLoading,
  error: _editionError,
} = await useFetch<Edition>(`/api/editions/${editionId}`)

// Synchroniser avec le store
watch(
  edition,
  (newEdition) => {
    if (newEdition) {
      editionStore.setEdition(newEdition)
    }
  },
  { immediate: true }
)

// Charger les détails de l'appel à spectacles
const {
  data: showCall,
  pending: loading,
  error,
} = await useFetch<EditionShowCallPublic>(
  `/api/editions/${editionId}/shows-call/${showCallId}/public`
)

// Vérifier si l'utilisateur a déjà candidaté et pré-remplir le formulaire
onMounted(async () => {
  if (authStore.isAuthenticated) {
    try {
      const response = await $fetch<{ application: ShowApplication | null }>(
        `/api/editions/${editionId}/shows-call/${showCallId}/my-application`
      )
      existingApplication.value = response.application

      // Si une candidature existe et est en attente, pré-remplir le formulaire avec ses données
      if (response.application && response.application.status === 'PENDING') {
        const app = response.application
        // Informations personnelles
        formState.lastName = authStore.user?.nom || ''
        formState.firstName = authStore.user?.prenom || ''
        formState.phone = authStore.user?.telephone || authStore.user?.phone || ''
        // Informations artiste
        formState.artistName = app.artistName
        formState.artistBio = app.artistBio || ''
        formState.portfolioUrl = app.portfolioUrl || ''
        formState.videoUrl = app.videoUrl || ''
        formState.socialLinks = app.socialLinks || ''
        // Informations spectacle
        formState.showTitle = app.showTitle
        formState.showDescription = app.showDescription
        formState.showDuration = app.showDuration
        formState.showCategory = app.showCategory || ''
        formState.technicalNeeds = app.technicalNeeds || ''
        // Logistique
        formState.accommodationNeeded = app.accommodationNeeded
        formState.accommodationNotes = app.accommodationNotes || ''
        formState.departureCity = app.departureCity || ''
        // Personnes supplémentaires
        formState.additionalPerformersCount = app.additionalPerformersCount
        if (app.additionalPerformers && Array.isArray(app.additionalPerformers)) {
          formState.additionalPerformers = app.additionalPerformers.map((p: any) => ({
            lastName: p.lastName || '',
            firstName: p.firstName || '',
            email: p.email || '',
            phone: p.phone || '',
          }))
        }
      } else if (!response.application) {
        // Nouvelle candidature : pré-remplir avec les données du profil utilisateur
        const user = authStore.user
        if (user) {
          if (user.nom) formState.lastName = user.nom
          if (user.prenom) formState.firstName = user.prenom
          if (user.telephone || user.phone) formState.phone = user.telephone || user.phone || ''
          if (user.pseudo && !formState.artistName) {
            formState.artistName = user.pseudo
          }
        }
      }
    } catch {
      existingApplication.value = null
    }
  }
})

const isDeadlinePassed = computed(() => {
  if (!showCall.value?.deadline) return false
  return new Date() > new Date(showCall.value.deadline)
})

// Synchroniser le tableau additionalPerformers avec le nombre
watch(
  () => formState.additionalPerformersCount,
  (newCount) => {
    const count = newCount || 0
    const currentLength = formState.additionalPerformers.length

    if (count > currentLength) {
      // Ajouter des entrées vides
      for (let i = currentLength; i < count; i++) {
        formState.additionalPerformers.push({
          lastName: '',
          firstName: '',
          email: '',
          phone: '',
        })
      }
    } else if (count < currentLength) {
      // Supprimer les entrées en trop
      formState.additionalPerformers.splice(count)
    }
  },
  { immediate: true }
)

// Validation du formulaire
function validate(state: typeof formState) {
  const errors: { path: string; message: string }[] = []

  // Informations personnelles obligatoires
  if (!state.lastName || state.lastName.trim().length < 2) {
    errors.push({
      path: 'lastName',
      message: t('shows_call.validation.last_name_required'),
    })
  }

  if (!state.firstName || state.firstName.trim().length < 2) {
    errors.push({
      path: 'firstName',
      message: t('shows_call.validation.first_name_required'),
    })
  }

  if (!state.phone || state.phone.trim().length < 6) {
    errors.push({
      path: 'phone',
      message: t('shows_call.validation.phone_required'),
    })
  }

  // Informations artiste
  if (!state.artistName || state.artistName.length < 2) {
    errors.push({
      path: 'artistName',
      message: t('shows_call.validation.artist_name_required'),
    })
  }

  if (!state.showTitle || state.showTitle.length < 3) {
    errors.push({
      path: 'showTitle',
      message: t('shows_call.validation.show_title_required'),
    })
  }

  if (!state.showDescription || state.showDescription.length < 20) {
    errors.push({
      path: 'showDescription',
      message: t('shows_call.validation.show_description_required'),
    })
  }

  if (!state.showDuration || state.showDuration < 1) {
    errors.push({
      path: 'showDuration',
      message: t('shows_call.validation.duration_required'),
    })
  }

  // Validation des personnes supplémentaires
  if (state.additionalPerformersCount === null || state.additionalPerformersCount === undefined) {
    errors.push({
      path: 'additionalPerformersCount',
      message: t('shows_call.validation.additional_performers_count_required'),
    })
  }

  // Valider chaque personne supplémentaire
  if (state.additionalPerformersCount > 0) {
    state.additionalPerformers.forEach((performer, index) => {
      if (!performer.lastName || performer.lastName.trim().length < 2) {
        errors.push({
          path: `additionalPerformers.${index}.lastName`,
          message: t('shows_call.validation.performer_last_name_required'),
        })
      }
      if (!performer.firstName || performer.firstName.trim().length < 2) {
        errors.push({
          path: `additionalPerformers.${index}.firstName`,
          message: t('shows_call.validation.performer_first_name_required'),
        })
      }
      if (!performer.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(performer.email)) {
        errors.push({
          path: `additionalPerformers.${index}.email`,
          message: t('shows_call.validation.performer_email_required'),
        })
      }
      if (!performer.phone || performer.phone.trim().length < 6) {
        errors.push({
          path: `additionalPerformers.${index}.phone`,
          message: t('shows_call.validation.performer_phone_required'),
        })
      }
    })
  }

  return errors
}

// Soumettre ou modifier la candidature
async function submitApplication(_event: FormSubmitEvent<typeof formState>) {
  submitting.value = true

  const body = {
    // Informations personnelles (seront mises à jour dans le profil)
    lastName: formState.lastName.trim(),
    firstName: formState.firstName.trim(),
    phone: formState.phone.trim(),
    // Informations artiste
    artistName: formState.artistName,
    artistBio: formState.artistBio || null,
    portfolioUrl: formState.portfolioUrl || null,
    videoUrl: formState.videoUrl || null,
    socialLinks: formState.socialLinks || null,
    showTitle: formState.showTitle,
    showDescription: formState.showDescription,
    showDuration: formState.showDuration,
    showCategory: formState.showCategory || null,
    technicalNeeds: formState.technicalNeeds || null,
    accommodationNeeded: formState.accommodationNeeded,
    accommodationNotes: formState.accommodationNotes || null,
    departureCity: formState.departureCity || null,
    // Personnes supplémentaires
    additionalPerformersCount: formState.additionalPerformersCount,
    additionalPerformers: formState.additionalPerformers.map((p) => ({
      lastName: p.lastName.trim(),
      firstName: p.firstName.trim(),
      email: p.email.trim().toLowerCase(),
      phone: p.phone.trim(),
    })),
  }

  try {
    if (isEditMode.value) {
      // Mode édition : PUT
      await $fetch(`/api/editions/${editionId}/shows-call/${showCallId}/my-application`, {
        method: 'PUT',
        body,
      })

      toast.add({
        title: t('shows_call.application_updated'),
        description: t('shows_call.application_updated_desc'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    } else {
      // Mode création : POST
      await $fetch(`/api/editions/${editionId}/shows-call/${showCallId}/applications`, {
        method: 'POST',
        body,
      })

      toast.add({
        title: t('shows_call.application_submitted'),
        description: t('shows_call.application_submitted_desc'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    }

    // Mettre à jour les données utilisateur dans le store (ne pas bloquer si erreur)
    try {
      await authStore.fetchUser()
    } catch {
      // Ignorer les erreurs de mise à jour du profil
    }

    // Rediriger vers la liste des appels
    await navigateTo(`/editions/${editionId}/shows-call`)
  } catch (err: any) {
    console.error('Error submitting application:', err)
    toast.add({
      title: t('common.error'),
      description: err.data?.message || t('shows_call.submit_error'),
      icon: 'i-heroicons-exclamation-triangle',
      color: 'error',
    })
  } finally {
    submitting.value = false
  }
}

// SEO
useSeoMeta({
  title: computed(() =>
    showCall.value ? `${t('shows_call.apply')} - ${showCall.value.name}` : t('shows_call.apply')
  ),
})
</script>
