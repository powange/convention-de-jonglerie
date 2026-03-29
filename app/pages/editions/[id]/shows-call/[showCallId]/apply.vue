<template>
  <div v-if="edition">
    <EditionHeader :edition="edition" current-page="shows-call" />

    <div class="max-w-3xl 2xl:max-w-full mx-auto space-y-6">
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
        v-else-if="
          showCall && (showCall.visibility === 'CLOSED' || showCall.visibility === 'OFFLINE')
        "
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
          showCall &&
          showCall.visibility !== 'CLOSED' &&
          showCall.visibility !== 'OFFLINE' &&
          authStore.isArtist &&
          (!hasAlreadyApplied || isEditMode)
        "
      >
        <div
          class="2xl:grid 2xl:grid-cols-[1fr_2fr] 2xl:gap-6 2xl:items-start space-y-6 2xl:space-y-0"
        >
          <!-- Colonne gauche : info + presets -->
          <div class="space-y-6 2xl:sticky 2xl:top-4">
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
              <div v-if="descriptionHtml" class="prose prose-sm dark:prose-invert max-w-none mb-4">
                <!-- Contenu HTML déjà nettoyé via markdownToHtml (rehype-sanitize) -->
                <!-- eslint-disable-next-line vue/no-v-html -->
                <div v-html="descriptionHtml" />
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
          </div>

          <!-- Colonne droite : formulaire -->
          <div>
            <!-- Formulaire -->
            <UCard variant="soft">
              <template #header>
                <div class="space-y-3">
                  <h2 class="text-lg font-semibold">
                    {{ isEditMode ? t('shows_call.edit_form_title') : t('shows_call.form_title') }}
                  </h2>
                  <div v-if="authStore.isArtist && presets.length > 0" class="flex items-end gap-3">
                    <UFormField :label="t('shows_call.presets.load_preset')" class="flex-1">
                      <USelect
                        v-model="selectedPresetId"
                        :items="presetItems"
                        :placeholder="t('shows_call.presets.select_placeholder')"
                        value-key="value"
                        size="lg"
                        class="w-full"
                        @update:model-value="loadPreset"
                      />
                    </UFormField>
                    <UButton
                      v-if="selectedPresetId"
                      variant="soft"
                      color="error"
                      icon="i-heroicons-trash"
                      size="lg"
                      :loading="deletingPreset"
                      @click="confirmDeletePreset"
                    />
                  </div>
                </div>
              </template>

              <UForm
                :state="formState"
                :validate="validate"
                class="space-y-6"
                @submit="submitApplication"
              >
                <div class="2xl:grid 2xl:grid-cols-2 2xl:gap-6 space-y-6 2xl:space-y-0">
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
                </div>

                <div class="2xl:grid 2xl:grid-cols-2 2xl:gap-6 space-y-6 2xl:space-y-0">
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

                      <UFormField
                        :label="t('gestion.shows_call.form.category')"
                        name="showCategory"
                      >
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

                  <!-- Section: Artistes du spectacle -->
                  <div class="space-y-4">
                    <h3 class="font-medium text-gray-700 dark:text-gray-300 border-b pb-2">
                      {{ t('shows_call.performers_section') }}
                    </h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ t('shows_call.performers_section_desc') }}
                    </p>

                    <!-- Sélecteur du nombre d'artistes -->
                    <UFormField
                      :label="t('shows_call.form.performers_count')"
                      name="additionalPerformersCount"
                      required
                    >
                      <div class="flex items-center gap-2">
                        <UButton
                          v-for="n in 5"
                          :key="n"
                          :color="formState.additionalPerformersCount === n ? 'primary' : 'neutral'"
                          :variant="formState.additionalPerformersCount === n ? 'solid' : 'outline'"
                          size="lg"
                          @click="selectPerformersCount(n)"
                        >
                          {{ n }}
                        </UButton>
                        <UButton
                          v-if="!showCustomCount && formState.additionalPerformersCount <= 5"
                          color="neutral"
                          variant="outline"
                          size="lg"
                          icon="i-heroicons-plus"
                          @click="showCustomCount = true"
                        />
                        <UInputNumber
                          v-if="showCustomCount || formState.additionalPerformersCount > 5"
                          v-model="formState.additionalPerformersCount"
                          :min="1"
                          :max="50"
                          size="lg"
                          class="w-28"
                        />
                      </div>
                    </UFormField>

                    <!-- Liste des artistes -->
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

                        <!-- Coche "Je participe" sur la première personne -->
                        <UCheckbox
                          v-if="index === 0"
                          v-model="applicantIsPerformer"
                          :label="t('shows_call.form.i_am_performer')"
                        />

                        <!-- Affichage texte quand l'utilisateur participe lui-même -->
                        <div
                          v-if="index === 0 && applicantIsPerformer"
                          class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400"
                        >
                          <span class="font-medium text-gray-900 dark:text-gray-100">
                            {{ formState.firstName }} {{ formState.lastName }}
                          </span>
                          <span>{{ authStore.user?.email }}</span>
                          <span v-if="formState.phone">
                            {{ formState.phone }}
                          </span>
                        </div>

                        <!-- Formulaire pour les autres artistes -->
                        <template v-else>
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
                        </template>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Section: Logistique -->
                <div
                  v-if="showCall.askAccommodation || showCall.askDepartureCity"
                  class="space-y-4 2xl:w-1/2"
                >
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
          </div>
        </div>

        <!-- Modal de sauvegarde de preset (en dehors du UForm) -->
        <UModal
          v-model:open="showSavePresetModal"
          :title="t('shows_call.presets.save_before_submit')"
        >
          <template #body>
            <div class="space-y-4">
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ t('shows_call.presets.save_before_submit_desc') }}
              </p>

              <!-- Cas : preset modifié → proposer mise à jour ou nouveau -->
              <template v-if="presetModified">
                <div class="space-y-3">
                  <UButton
                    block
                    color="primary"
                    variant="soft"
                    icon="i-heroicons-arrow-path"
                    :loading="savingPreset"
                    @click="savePresetAndSubmit('update')"
                  >
                    {{
                      t('shows_call.presets.update_preset_name', {
                        name: loadedPresetName,
                      })
                    }}
                  </UButton>

                  <UFormField :label="t('shows_call.presets.or_save_new')">
                    <div class="flex gap-2">
                      <UInput
                        v-model="presetName"
                        :placeholder="t('shows_call.presets.preset_name_placeholder')"
                        size="lg"
                        class="flex-1"
                      />
                      <UButton
                        color="primary"
                        icon="i-heroicons-bookmark"
                        :loading="savingPreset"
                        :disabled="!presetName.trim()"
                        @click="savePresetAndSubmit('new')"
                      >
                        {{ t('common.save') }}
                      </UButton>
                    </div>
                  </UFormField>
                </div>
              </template>

              <!-- Cas : pas de preset → proposer de sauvegarder comme nouveau -->
              <template v-else>
                <UFormField :label="t('shows_call.presets.preset_name')">
                  <UInput
                    v-model="presetName"
                    :placeholder="t('shows_call.presets.preset_name_placeholder')"
                    size="lg"
                    class="w-full"
                  />
                </UFormField>
              </template>
            </div>
          </template>

          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton color="neutral" variant="ghost" @click="showSavePresetModal = false">
                {{ t('common.cancel') }}
              </UButton>
              <!-- Bouton sauvegarder + envoyer (cas sans preset) -->
              <UButton
                v-if="!presetModified && presetName.trim()"
                color="primary"
                :loading="savingPreset"
                icon="i-heroicons-bookmark"
                @click="savePresetAndSubmit('new')"
              >
                {{ t('shows_call.presets.save_and_submit') }}
              </UButton>
              <UButton
                color="primary"
                variant="soft"
                icon="i-heroicons-paper-airplane"
                :loading="submitting"
                @click="submitWithoutSaving"
              >
                {{ t('shows_call.presets.submit_without_saving') }}
              </UButton>
            </div>
          </template>
        </UModal>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import type { Edition, EditionShowCallPublic, ShowApplication, ShowPreset } from '~/types'
import { getEditionDisplayName } from '~/utils/editionName'
import { markdownToHtml } from '~/utils/markdown'

import type { FormSubmitEvent } from '@nuxt/ui'

const route = useRoute()
const authStore = useAuthStore()
const editionStore = useEditionStore()
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
  // Artistes du spectacle
  additionalPerformersCount: 1,
  additionalPerformers: [] as AdditionalPerformer[],
})

const existingApplication = ref<ShowApplication | null>(null)
const applicantIsPerformer = ref(false)
const showCustomCount = ref(false)

function selectPerformersCount(n: number) {
  formState.additionalPerformersCount = n
  showCustomCount.value = false
}

// Pré-remplir Personne 1 quand la coche "Je participe" est activée
watch(applicantIsPerformer, (isPerformer) => {
  if (formState.additionalPerformers.length === 0) return
  if (isPerformer) {
    const user = authStore.user
    if (user) {
      formState.additionalPerformers[0].lastName = user.nom || ''
      formState.additionalPerformers[0].firstName = user.prenom || ''
      formState.additionalPerformers[0].email = user.email || ''
      formState.additionalPerformers[0].phone = user.telephone || user.phone || ''
    }
  } else {
    formState.additionalPerformers[0].lastName = ''
    formState.additionalPerformers[0].firstName = ''
    formState.additionalPerformers[0].email = ''
    formState.additionalPerformers[0].phone = ''
  }
})

// Synchroniser l'artiste 1 quand les infos personnelles changent et "Je participe" est coché
watch(
  () => [formState.lastName, formState.firstName, formState.phone],
  ([lastName, firstName, phone]) => {
    if (!applicantIsPerformer.value) return
    if (formState.additionalPerformers.length === 0) return
    formState.additionalPerformers[0].lastName = lastName
    formState.additionalPerformers[0].firstName = firstName
    formState.additionalPerformers[0].phone = phone
  }
)

// Presets de spectacle
const presets = ref<ShowPreset[]>([])
const selectedPresetId = ref<number | null>(null)
const showSavePresetModal = ref(false)
const presetName = ref('')
const savingPreset = ref(false)
const deletingPreset = ref(false)

// Snapshot du preset chargé pour détecter les modifications
const loadedPresetSnapshot = ref<Record<string, string> | null>(null)
const loadedPresetName = ref('')

const presetItems = computed(() => presets.value.map((p) => ({ label: p.name, value: p.id })))

// Champs du preset à comparer (uniquement les champs que le preset gère)
const presetFieldKeys = [
  'artistName',
  'artistBio',
  'portfolioUrl',
  'videoUrl',
  'socialLinks',
  'showTitle',
  'showDescription',
  'showDuration',
  'showCategory',
  'technicalNeeds',
  'additionalPerformersCount',
] as const

function buildSnapshot(source: Record<string, any>, performers: any[]): Record<string, string> {
  const snap: Record<string, string> = {}
  for (const key of presetFieldKeys) {
    snap[key] = JSON.stringify(source[key] ?? '')
  }
  snap.additionalPerformers = JSON.stringify(performers.map((p: any) => ({ ...toRaw(p) })))
  return snap
}

function getPresetSnapshot(): Record<string, string> {
  return buildSnapshot(formState, toRaw(formState.additionalPerformers))
}

const presetModified = computed(() => {
  if (!loadedPresetSnapshot.value) return false
  const current = getPresetSnapshot()
  return Object.keys(current).some((key) => current[key] !== loadedPresetSnapshot.value![key])
})

function loadPreset(presetId: number | null) {
  const preset = presets.value.find((p) => p.id === presetId)
  if (!preset) return

  formState.artistName = preset.artistName
  formState.artistBio = preset.artistBio || ''
  formState.portfolioUrl = preset.portfolioUrl || ''
  formState.videoUrl = preset.videoUrl || ''
  formState.socialLinks = preset.socialLinks || ''
  formState.showTitle = preset.showTitle
  formState.showDescription = preset.showDescription
  formState.showDuration = preset.showDuration
  formState.showCategory = preset.showCategory || ''
  formState.technicalNeeds = preset.technicalNeeds || ''
  formState.additionalPerformersCount = preset.additionalPerformersCount
  if (preset.additionalPerformers && Array.isArray(preset.additionalPerformers)) {
    formState.additionalPerformers = preset.additionalPerformers.map((p) => ({ ...p }))
  }

  // Sauvegarder le snapshot directement depuis les données du preset (pas du formulaire réactif)
  loadedPresetName.value = preset.name
  loadedPresetSnapshot.value = buildSnapshot(
    preset as any,
    Array.isArray(preset.additionalPerformers) ? preset.additionalPerformers : []
  )

  useToast().add({
    title: t('shows_call.presets.preset_loaded'),
    description: t('shows_call.presets.preset_loaded_desc'),
    color: 'success',
  })
}

function buildPresetBody() {
  return {
    name: presetName.value.trim(),
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
    additionalPerformersCount: formState.additionalPerformersCount,
    additionalPerformers: formState.additionalPerformers.map((p) => ({
      lastName: p.lastName.trim(),
      firstName: p.firstName.trim(),
      email: p.email.trim().toLowerCase(),
      phone: p.phone.trim(),
    })),
  }
}

async function savePresetAndSubmit(mode: 'update' | 'new') {
  savingPreset.value = true
  try {
    const body = buildPresetBody()
    if (mode === 'update' && selectedPresetId.value) {
      body.name = loadedPresetName.value
      const response = await $fetch<{ data: { preset: ShowPreset } }>(
        `/api/profile/show-presets/${selectedPresetId.value}`,
        { method: 'PUT', body }
      )
      const idx = presets.value.findIndex((p) => p.id === selectedPresetId.value)
      if (idx !== -1) presets.value[idx] = response.data.preset
      useToast().add({
        title: t('shows_call.presets.preset_updated'),
        description: t('shows_call.presets.preset_updated_desc'),
        color: 'success',
      })
    } else if (presetName.value.trim()) {
      body.name = presetName.value.trim()
      const response = await $fetch<{ data: { preset: ShowPreset } }>('/api/profile/show-presets', {
        method: 'POST',
        body,
      })
      presets.value.unshift(response.data.preset)
      selectedPresetId.value = response.data.preset.id
      useToast().add({
        title: t('shows_call.presets.preset_saved'),
        description: t('shows_call.presets.preset_saved_desc'),
        color: 'success',
      })
    }
    showSavePresetModal.value = false
    presetName.value = ''
    // Envoyer la candidature après la sauvegarde du preset
    doSubmitApplication()
  } catch {
    useToast().add({
      title: t('shows_call.presets.preset_save_error'),
      color: 'error',
    })
  } finally {
    savingPreset.value = false
  }
}

function submitWithoutSaving() {
  showSavePresetModal.value = false
  doSubmitApplication()
}

async function confirmDeletePreset() {
  if (!selectedPresetId.value) return
  if (!window.confirm(t('shows_call.presets.delete_preset_confirm'))) return

  deletingPreset.value = true
  try {
    await $fetch(`/api/profile/show-presets/${selectedPresetId.value}`, {
      method: 'DELETE',
    })
    presets.value = presets.value.filter((p) => p.id !== selectedPresetId.value)
    selectedPresetId.value = null
    useToast().add({
      title: t('shows_call.presets.preset_deleted'),
      description: t('shows_call.presets.preset_deleted_desc'),
      color: 'success',
    })
  } catch {
    useToast().add({
      title: t('shows_call.presets.preset_delete_error'),
      color: 'error',
    })
  } finally {
    deletingPreset.value = false
  }
}

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

    // Charger les presets de spectacle
    if (authStore.isArtist) {
      try {
        const presetsResponse = await $fetch<{ data: { presets: ShowPreset[] } }>(
          '/api/profile/show-presets'
        )
        presets.value = presetsResponse.data.presets
      } catch {
        // Ignorer les erreurs de chargement des presets
      }
    }
  }
})

const isDeadlinePassed = computed(() => {
  if (!showCall.value?.deadline) return false
  return new Date() > new Date(showCall.value.deadline)
})

// Rendu markdown de la description
const descriptionHtml = ref('')

async function renderDescription() {
  if (!showCall.value?.description) {
    descriptionHtml.value = ''
    return
  }
  try {
    descriptionHtml.value = await markdownToHtml(showCall.value.description)
  } catch {
    descriptionHtml.value = ''
  }
}

watch(() => showCall.value?.description, renderDescription, { immediate: true })

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
  const errors: { name: string; message: string }[] = []

  // Informations personnelles obligatoires
  if (!state.lastName || state.lastName.trim().length < 2) {
    errors.push({
      name: 'lastName',
      message: t('shows_call.validation.last_name_required'),
    })
  }

  if (!state.firstName || state.firstName.trim().length < 2) {
    errors.push({
      name: 'firstName',
      message: t('shows_call.validation.first_name_required'),
    })
  }

  if (!state.phone || state.phone.trim().length < 6) {
    errors.push({
      name: 'phone',
      message: t('shows_call.validation.phone_required'),
    })
  }

  // Informations artiste
  if (!state.artistName || state.artistName.length < 2) {
    errors.push({
      name: 'artistName',
      message: t('shows_call.validation.artist_name_required'),
    })
  }

  if (!state.showTitle || state.showTitle.length < 3) {
    errors.push({
      name: 'showTitle',
      message: t('shows_call.validation.show_title_required'),
    })
  }

  if (!state.showDescription || state.showDescription.length < 20) {
    errors.push({
      name: 'showDescription',
      message: t('shows_call.validation.show_description_required'),
    })
  }

  if (!state.showDuration || state.showDuration < 1) {
    errors.push({
      name: 'showDuration',
      message: t('shows_call.validation.duration_required'),
    })
  }

  // Validation des personnes supplémentaires
  if (state.additionalPerformersCount === null || state.additionalPerformersCount === undefined) {
    errors.push({
      name: 'additionalPerformersCount',
      message: t('shows_call.validation.additional_performers_count_required'),
    })
  }

  // Valider chaque personne supplémentaire
  if (state.additionalPerformersCount > 0) {
    state.additionalPerformers.forEach((performer, index) => {
      if (!performer.lastName || performer.lastName.trim().length < 2) {
        errors.push({
          name: `additionalPerformers.${index}.lastName`,
          message: t('shows_call.validation.performer_last_name_required'),
        })
      }
      if (!performer.firstName || performer.firstName.trim().length < 2) {
        errors.push({
          name: `additionalPerformers.${index}.firstName`,
          message: t('shows_call.validation.performer_first_name_required'),
        })
      }
      if (!performer.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(performer.email)) {
        errors.push({
          name: `additionalPerformers.${index}.email`,
          message: t('shows_call.validation.performer_email_required'),
        })
      }
      if (!performer.phone || performer.phone.trim().length < 6) {
        errors.push({
          name: `additionalPerformers.${index}.phone`,
          message: t('shows_call.validation.performer_phone_required'),
        })
      }
    })
  }

  return errors
}

// Construire le body de candidature
const buildApplicationBody = () => ({
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
})

const onApplicationSuccess = async () => {
  // Mettre à jour les données utilisateur dans le store (ne pas bloquer si erreur)
  try {
    await authStore.fetchUser()
  } catch {
    // Ignorer les erreurs de mise à jour du profil
  }

  // Rediriger vers la liste des appels
  await navigateTo(`/editions/${editionId}/shows-call`)
}

// Action pour créer une candidature
const { execute: executeCreateApplication, loading: isCreating } = useApiAction(
  () => `/api/editions/${editionId}/shows-call/${showCallId}/applications`,
  {
    method: 'POST',
    body: buildApplicationBody,
    successMessage: {
      title: t('shows_call.application_submitted'),
      description: t('shows_call.application_submitted_desc'),
    },
    errorMessages: { default: t('shows_call.submit_error') },
    onSuccess: onApplicationSuccess,
  }
)

// Action pour modifier une candidature
const { execute: executeUpdateApplication, loading: isUpdating } = useApiAction(
  () => `/api/editions/${editionId}/shows-call/${showCallId}/my-application`,
  {
    method: 'PUT',
    body: buildApplicationBody,
    successMessage: {
      title: t('shows_call.application_updated'),
      description: t('shows_call.application_updated_desc'),
    },
    errorMessages: { default: t('shows_call.submit_error') },
    onSuccess: onApplicationSuccess,
  }
)

const submitting = computed(() => isCreating.value || isUpdating.value)

// Envoi effectif de la candidature
function doSubmitApplication() {
  if (isEditMode.value) {
    executeUpdateApplication()
  } else {
    executeCreateApplication()
  }
}

// Intercepter la soumission pour proposer la sauvegarde de preset
function submitApplication(_event: FormSubmitEvent<typeof formState>) {
  // Si un preset est chargé et non modifié → envoi direct
  if (selectedPresetId.value && !presetModified.value) {
    doSubmitApplication()
    return
  }

  // Sinon → afficher la modal de sauvegarde preset
  presetName.value = ''
  showSavePresetModal.value = true
}

// SEO
useSeoMeta({
  title: computed(() =>
    showCall.value ? `${t('shows_call.apply')} - ${showCall.value.name}` : t('shows_call.apply')
  ),
})
</script>
