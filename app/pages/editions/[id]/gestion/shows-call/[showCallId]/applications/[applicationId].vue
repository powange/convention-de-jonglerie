<template>
  <div>
    <div v-if="editionStore.loading || loadingShowCall || loadingApplication">
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
    <div v-else-if="!showCall || !application">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        :title="$t('common.not_found')"
      />
    </div>
    <div v-else>
      <!-- Breadcrumb -->
      <div class="mb-6">
        <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
          <NuxtLink
            :to="`/editions/${editionId}/gestion/shows-call`"
            class="hover:text-primary-500"
          >
            {{ $t('gestion.shows_call.title') }}
          </NuxtLink>
          <UIcon name="i-heroicons-chevron-right" />
          <NuxtLink
            :to="`/editions/${editionId}/gestion/shows-call/${showCallId}`"
            class="hover:text-primary-500"
          >
            {{ showCall.name }}
          </NuxtLink>
          <UIcon name="i-heroicons-chevron-right" />
          <NuxtLink
            :to="`/editions/${editionId}/gestion/shows-call/${showCallId}/applications`"
            class="hover:text-primary-500"
          >
            {{ $t('gestion.shows_call.applications_title') }}
          </NuxtLink>
          <UIcon name="i-heroicons-chevron-right" />
          <span>{{ application.showTitle }}</span>
        </div>

        <!-- Actions navigation -->
        <div class="flex items-center justify-between flex-wrap gap-3">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UIcon name="i-heroicons-document-text" class="text-amber-500" />
            {{ application.showTitle }}
          </h1>
          <div class="flex items-center gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-heroicons-arrow-left"
              :to="`/editions/${editionId}/gestion/shows-call/${showCallId}/applications`"
            >
              {{ $t('gestion.shows_call.back_to_applications') }}
            </UButton>
            <UButton
              v-if="prevApplicationId"
              color="neutral"
              variant="soft"
              icon="i-heroicons-chevron-left"
              :to="`/editions/${editionId}/gestion/shows-call/${showCallId}/applications/${prevApplicationId}`"
            >
              {{ $t('common.previous') }}
            </UButton>
            <UButton
              v-if="nextApplicationId"
              color="neutral"
              variant="soft"
              trailing-icon="i-heroicons-chevron-right"
              :to="`/editions/${editionId}/gestion/shows-call/${showCallId}/applications/${nextApplicationId}`"
            >
              {{ $t('common.next') }}
            </UButton>
          </div>
        </div>
      </div>

      <div class="xl:grid xl:grid-cols-5 xl:gap-8">
        <!-- Colonne gauche : informations de la candidature -->
        <div class="xl:col-span-3 space-y-6">
          <!-- Statut (dropdown pour changer de statut avec confirmation) -->
          <div class="flex items-center">
            <UDropdownMenu
              :items="statusMenuItems"
              :aria-label="$t('gestion.shows_call.change_status')"
            >
              <UButton
                :color="getStatusColor(application.status)"
                variant="soft"
                size="lg"
                trailing-icon="i-heroicons-chevron-down"
                :loading="updatingStatus"
              >
                {{ $t(`gestion.shows_call.status_${application.status.toLowerCase()}`) }}
              </UButton>
            </UDropdownMenu>
          </div>

          <!-- Info artiste -->
          <UCard>
            <template #header>
              <h4 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <UIcon name="i-heroicons-user" class="text-amber-500" />
                {{ $t('gestion.shows_call.artist_info') }}
              </h4>
            </template>
            <div class="space-y-5">
              <div class="text-sm pl-3">
                <span
                  class="text-gray-900 dark:text-white text-base font-semibold border-l-2 border-primary pl-2 -ml-3"
                  >{{ $t('gestion.shows_call.form.artist_name') }}</span
                >
                <p class="mt-1">{{ application.artistName }}</p>
              </div>
              <div v-if="application.artistBio" class="pl-3">
                <span
                  class="text-gray-900 dark:text-white text-base font-semibold border-l-2 border-primary pl-2 -ml-3"
                  >{{ $t('gestion.shows_call.form.artist_bio') }}</span
                >
                <!-- Markdown rendu + liens cliquables target=_blank (rehype-sanitize + rehypeExternalLinks) -->
                <!-- eslint-disable vue/no-v-html -->
                <div
                  class="mt-1 text-sm prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap"
                  v-html="artistBioHtml"
                />
              </div>
              <div class="flex flex-wrap gap-4 text-sm">
                <a
                  v-if="application.portfolioUrl"
                  :href="application.portfolioUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary-500 hover:underline flex items-center gap-1"
                >
                  <UIcon name="i-heroicons-globe-alt" />
                  Portfolio
                </a>
                <a
                  v-if="application.videoUrl"
                  :href="application.videoUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary-500 hover:underline flex items-center gap-1"
                >
                  <UIcon name="i-heroicons-play-circle" />
                  {{ $t('gestion.shows_call.form.video_url') }}
                </a>
              </div>
              <!-- Lecteur vidéo intégré (YouTube ou Vimeo) -->
              <div v-if="videoEmbed" class="mt-2">
                <div class="relative w-full max-w-lg aspect-video rounded-lg overflow-hidden">
                  <iframe
                    :src="videoEmbed.src"
                    class="absolute inset-0 w-full h-full"
                    frameborder="0"
                    referrerpolicy="strict-origin-when-cross-origin"
                    :allow="videoEmbed.allow"
                    allowfullscreen
                  />
                </div>
              </div>
              <div v-if="application.socialLinks" class="pl-3">
                <span
                  class="text-gray-900 dark:text-white text-base font-semibold border-l-2 border-primary pl-2 -ml-3"
                  >{{ $t('gestion.shows_call.form.social_links') }}</span
                >
                <div class="mt-1 flex flex-wrap gap-2">
                  <a
                    v-for="(link, index) in parseSocialLinks(application.socialLinks)"
                    :key="index"
                    :href="link"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary-500 hover:underline text-sm flex items-center gap-1"
                  >
                    <UIcon name="i-heroicons-link" />
                    {{ getSocialLinkLabel(link) }}
                  </a>
                </div>
              </div>
            </div>
          </UCard>

          <!-- Info spectacle -->
          <UCard>
            <template #header>
              <h4 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <UIcon name="i-heroicons-sparkles" class="text-amber-500" />
                {{ $t('gestion.shows_call.show_info') }}
              </h4>
            </template>
            <div class="space-y-5">
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div class="pl-3">
                  <span
                    class="text-gray-900 dark:text-white text-base font-semibold border-l-2 border-primary pl-2 -ml-3"
                    >{{ $t('gestion.shows_call.form.show_title') }}</span
                  >
                  <p class="mt-1">{{ application.showTitle }}</p>
                </div>
                <div class="pl-3">
                  <span
                    class="text-gray-900 dark:text-white text-base font-semibold border-l-2 border-primary pl-2 -ml-3"
                    >{{ $t('gestion.shows_call.form.duration') }}</span
                  >
                  <p class="mt-1">{{ application.showDuration }} min</p>
                </div>
                <div v-if="application.showCategory" class="pl-3">
                  <span
                    class="text-gray-900 dark:text-white text-base font-semibold border-l-2 border-primary pl-2 -ml-3"
                    >{{ $t('gestion.shows_call.form.category') }}</span
                  >
                  <p class="mt-1">{{ application.showCategory }}</p>
                </div>
              </div>
              <div class="pl-3">
                <div class="flex items-center justify-between">
                  <span
                    class="text-gray-900 dark:text-white text-base font-semibold border-l-2 border-primary pl-2 -ml-3 flex items-center gap-2"
                  >
                    {{ $t('gestion.shows_call.form.description') }}
                    <UButton
                      v-if="!editingDescription"
                      color="neutral"
                      variant="ghost"
                      icon="i-heroicons-pencil-square"
                      size="xs"
                      @click="editingDescription = true"
                    />
                  </span>
                  <UButton
                    v-if="editingDescription && descriptionChanged"
                    color="primary"
                    variant="soft"
                    icon="i-heroicons-document-check"
                    size="xs"
                    :loading="savingDescription"
                    @click="saveDescription"
                  >
                    {{ $t('common.save') }}
                  </UButton>
                  <UButton
                    v-if="editingDescription && !descriptionChanged"
                    color="neutral"
                    variant="ghost"
                    icon="i-heroicons-x-mark"
                    size="xs"
                    @click="editingDescription = false"
                  />
                </div>
                <UTextarea
                  v-if="editingDescription"
                  v-model="editableDescription"
                  :rows="4"
                  class="mt-1 w-full text-sm"
                />
                <!-- Contenu HTML déjà nettoyé via markdownToHtml (rehype-sanitize)
                     + liens cliquables target=_blank rel=noopener via rehypeExternalLinks -->
                <!-- eslint-disable vue/no-v-html -->
                <div
                  v-else
                  class="mt-1 text-sm prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap"
                  v-html="descriptionHtml"
                />
              </div>
              <div v-if="application.technicalNeeds" class="pl-3">
                <span
                  class="text-gray-900 dark:text-white text-base font-semibold border-l-2 border-primary pl-2 -ml-3"
                >
                  {{ $t('gestion.shows_call.form.technical_needs') }}
                </span>
                <!-- Markdown rendu + liens cliquables target=_blank (rehype-sanitize + rehypeExternalLinks) -->
                <!-- eslint-disable vue/no-v-html -->
                <div
                  class="mt-1 text-sm prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap"
                  v-html="technicalNeedsHtml"
                />
              </div>
              <div v-if="application.additionalPerformersCount > 0" class="pl-3">
                <span
                  class="text-gray-900 dark:text-white text-sm font-semibold flex items-center gap-2 mb-2 border-l-2 border-primary pl-2 -ml-3"
                >
                  {{ $t('gestion.shows_call.additional_performers') }}
                  <UBadge color="neutral" variant="subtle" size="sm">
                    {{ application.additionalPerformersCount }}
                  </UBadge>
                </span>
                <div
                  v-if="
                    application.additionalPerformers && application.additionalPerformers.length > 0
                  "
                  class="space-y-2"
                >
                  <div
                    v-for="(performer, index) in application.additionalPerformers"
                    :key="index"
                    class="flex items-center gap-3 text-sm bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                  >
                    <UIcon name="i-heroicons-user" class="text-gray-400 shrink-0" />
                    <div class="min-w-0 flex-1">
                      <p class="font-medium">{{ performer.firstName }} {{ performer.lastName }}</p>
                      <div class="flex flex-wrap gap-x-4 gap-y-1 text-gray-500 text-xs mt-0.5">
                        <span v-if="performer.email" class="flex items-center gap-1">
                          <UIcon name="i-heroicons-envelope" class="w-3 h-3" />
                          {{ performer.email }}
                        </span>
                        <span v-if="performer.phone" class="flex items-center gap-1">
                          <UIcon name="i-heroicons-phone" class="w-3 h-3" />
                          {{ performer.phone }}
                        </span>
                      </div>
                    </div>
                    <!-- Bouton/badge import : visible uniquement si la candidature est ACCEPTED -->
                    <template v-if="application.status === 'ACCEPTED'">
                      <UBadge
                        v-if="
                          isPerformerImported(performer.email) &&
                          isPerformerLinkedToCurrentShow(performer.email)
                        "
                        color="success"
                        variant="soft"
                        icon="i-heroicons-check-circle"
                      >
                        {{ $t('gestion.shows_call.performer_imported') }}
                      </UBadge>
                      <UButton
                        v-else-if="isPerformerImported(performer.email)"
                        color="primary"
                        variant="soft"
                        size="sm"
                        icon="i-heroicons-link"
                        :loading="importingPerformerIndex === index"
                        @click="confirmImportPerformer(index)"
                      >
                        {{ $t('gestion.shows_call.link_performer_to_show') }}
                      </UButton>
                      <UButton
                        v-else
                        color="primary"
                        variant="soft"
                        size="sm"
                        icon="i-heroicons-user-plus"
                        :loading="importingPerformerIndex === index"
                        @click="confirmImportPerformer(index)"
                      >
                        {{ $t('gestion.shows_call.import_performer') }}
                      </UButton>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </UCard>

          <!-- Logistique -->
          <UCard v-if="application.accommodationNeeded || application.departureCity">
            <template #header>
              <h4 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <UIcon name="i-heroicons-truck" class="text-amber-500" />
                {{ $t('gestion.shows_call.logistics') }}
              </h4>
            </template>
            <div class="text-sm space-y-5">
              <div v-if="application.departureCity" class="pl-3">
                <span
                  class="text-gray-900 dark:text-white text-base font-semibold border-l-2 border-primary pl-2 -ml-3"
                  >{{ $t('gestion.shows_call.field_departure_city') }}</span
                >
                <p class="mt-1">{{ application.departureCity }}</p>
              </div>
              <div v-if="application.accommodationNeeded">
                <UBadge color="info" variant="soft">
                  {{ $t('gestion.shows_call.accommodation_needed') }}
                </UBadge>
                <p v-if="application.accommodationNotes" class="mt-1 text-sm">
                  {{ application.accommodationNotes }}
                </p>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Colonne droite : outils organisateur -->
        <div
          class="xl:col-span-2 space-y-6 mt-6 xl:mt-0 border-t xl:border-t-0 xl:border-l xl:pl-8 pt-6 xl:pt-0 border-gray-200 dark:border-gray-700"
        >
          <!-- Contact -->
          <UCard v-if="application.user">
            <template #header>
              <h4 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <UIcon name="i-heroicons-phone" class="text-amber-500" />
                {{ $t('gestion.shows_call.contact') }}
              </h4>
            </template>
            <div class="text-sm space-y-2">
              <div class="flex items-center gap-3">
                <UiUserAvatar :user="application.user" size="md" />
                <p v-if="application.user.prenom || application.user.nom" class="font-medium">
                  {{ application.user.prenom }} {{ application.user.nom }}
                </p>
              </div>
              <p v-if="application.user.email">
                <a
                  :href="`mailto:${application.user.email}`"
                  class="text-primary-500 hover:underline"
                >
                  {{ application.user.email }}
                </a>
              </p>
              <UButton
                v-if="application.contactPhone || application.user.phone"
                :to="`tel:${application.contactPhone || application.user.phone}`"
                icon="i-heroicons-phone"
                color="primary"
                variant="soft"
                size="sm"
              >
                {{ application.contactPhone || application.user.phone }}
              </UButton>
            </div>
          </UCard>

          <!-- Spectacle associé -->
          <UCard>
            <template #header>
              <h4 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <UIcon name="i-heroicons-sparkles" class="text-amber-500" />
                {{ $t('gestion.shows_call.linked_show') }}
              </h4>
            </template>
            <UFormField :label="$t('gestion.shows_call.linked_show_select')">
              <USelect
                v-model="linkedShowId"
                :items="showSelectItems"
                :placeholder="$t('gestion.shows_call.linked_show_placeholder')"
                :loading="loadingShows || savingLinkedShow"
                class="w-full"
                @update:model-value="saveLinkedShow"
              />
            </UFormField>
          </UCard>

          <!-- Notes organisateur -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h4 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <UIcon name="i-heroicons-pencil-square" class="text-amber-500" />
                  {{ $t('gestion.shows_call.organizer_notes') }}
                </h4>
                <UButton
                  v-if="notesChanged"
                  color="primary"
                  variant="soft"
                  icon="i-heroicons-document-check"
                  size="xs"
                  :loading="savingNotes"
                  @click="saveNotes"
                >
                  {{ $t('common.save') }}
                </UButton>
              </div>
            </template>
            <UTextarea
              v-model="organizerNotes"
              :placeholder="$t('gestion.shows_call.organizer_notes_placeholder')"
              :rows="3"
              class="w-full"
            />
          </UCard>

          <!-- Conversation avec l'artiste -->
          <ShowApplicationChat :application-id="application.id" class="max-h-80" />

          <!-- Décision -->
          <div v-if="application.decidedAt" class="text-xs text-gray-400 border-t pt-3">
            {{ $t('gestion.shows_call.decided_info') }}
            {{ formatDate(application.decidedAt) }}
            <span v-if="application.decidedBy">
              {{ $t('common.by') }} {{ application.decidedBy.pseudo }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de confirmation de changement de statut -->
    <UiConfirmModal
      v-model="showConfirmModal"
      :title="confirmModalTexts.title"
      :description="confirmModalTexts.description"
      :confirm-label="confirmModalTexts.confirmLabel"
      :confirm-color="confirmModalTexts.confirmColor"
      :confirm-icon="confirmModalTexts.confirmIcon"
      :icon-name="confirmModalTexts.iconName"
      :icon-color="confirmModalTexts.iconColor"
      :loading="updatingStatus"
      @confirm="executeConfirmedStatusChange"
      @cancel="showConfirmModal = false"
    />

    <!-- Modal de confirmation d'import d'un performer -->
    <UiConfirmModal
      v-model="showImportPerformerModal"
      :title="importPerformerModalTexts.title"
      :description="importPerformerModalTexts.description"
      :confirm-label="importPerformerModalTexts.confirmLabel"
      :confirm-icon="importPerformerModalTexts.confirmIcon"
      :icon-name="importPerformerModalTexts.iconName"
      confirm-color="primary"
      icon-color="text-primary-500"
      :loading="importingPerformerIndex !== null"
      @confirm="executeImportPerformer"
      @cancel="cancelImportPerformer"
    >
      <UFormField :label="$t('gestion.shows_call.apply_application_data_label')">
        <USwitch v-model="applyApplicationData" />
        <template #help>
          {{ $t('gestion.shows_call.apply_application_data_help') }}
        </template>
      </UFormField>
    </UiConfirmModal>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import type { EditionShowCallBasic, ShowApplication, ShowApplicationStatus } from '~/types'
import { markdownToHtml } from '~/utils/markdown'

definePageMeta({
  middleware: ['auth-protected'],
})

const route = useRoute()
const authStore = useAuthStore()
const editionStore = useEditionStore()
const toast = useToast()
const { t, locale } = useI18n()

const editionId = parseInt(route.params.id as string)
const showCallId = parseInt(route.params.showCallId as string)
const applicationId = computed(() => parseInt(route.params.applicationId as string))

const edition = computed(() => editionStore.getEditionById(editionId))

// Show call data
const showCall = ref<EditionShowCallBasic | null>(null)
const loadingShowCall = ref(true)

// Application
const application = ref<ShowApplication | null>(null)
const loadingApplication = ref(true)
const organizerNotes = ref('')
const initialOrganizerNotes = ref('')
const editableDescription = ref('')
const initialDescription = ref('')
const editingDescription = ref(false)

// Liste des candidatures (pour navigation prev/next)
const applicationIds = ref<number[]>([])

const currentIndex = computed(() => applicationIds.value.indexOf(applicationId.value))
const prevApplicationId = computed(() => {
  const idx = currentIndex.value
  return idx > 0 ? applicationIds.value[idx - 1] : null
})
const nextApplicationId = computed(() => {
  const idx = currentIndex.value
  return idx >= 0 && idx < applicationIds.value.length - 1 ? applicationIds.value[idx + 1] : null
})

// Champs UGC rendus en HTML (markdown + autolink des URLs + liens target=_blank rel=noopener)
const descriptionHtml = ref('')
const artistBioHtml = ref('')
const technicalNeedsHtml = ref('')

watch(
  () => application.value?.showDescription,
  async (text) => {
    descriptionHtml.value = text ? await markdownToHtml(text) : ''
  },
  { immediate: true }
)
watch(
  () => application.value?.artistBio,
  async (text) => {
    artistBioHtml.value = text ? await markdownToHtml(text) : ''
  },
  { immediate: true }
)
watch(
  () => application.value?.technicalNeeds,
  async (text) => {
    technicalNeedsHtml.value = text ? await markdownToHtml(text) : ''
  },
  { immediate: true }
)

// Spectacle associé
const linkedShowId = ref<number | null>(null)
const loadingShows = ref(false)
const editionShows = ref<{ id: number; title: string }[]>([])

// Confirmation de changement de statut
const showConfirmModal = ref(false)
const confirmingStatus = ref<ShowApplicationStatus>('PENDING')
const pendingStatus = ref<ShowApplicationStatus>('PENDING')

const showSelectItems = computed(() => [
  { label: t('gestion.shows_call.linked_show_none'), value: null },
  ...editionShows.value.map((s) => ({ label: s.title, value: s.id })),
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

// Helpers
const getStatusColor = (status: ShowApplicationStatus) => {
  switch (status) {
    case 'PENDING':
      return 'warning'
    case 'ACCEPTED':
      return 'success'
    case 'REJECTED':
      return 'error'
    default:
      return 'neutral'
  }
}

const getStatusIcon = (status: ShowApplicationStatus) => {
  switch (status) {
    case 'PENDING':
      return 'i-heroicons-clock'
    case 'ACCEPTED':
      return 'i-heroicons-check'
    case 'REJECTED':
      return 'i-heroicons-x-mark'
    default:
      return 'i-heroicons-question-mark-circle'
  }
}

const getStatusActionLabel = (status: ShowApplicationStatus) => {
  switch (status) {
    case 'PENDING':
      return t('gestion.shows_call.set_pending')
    case 'ACCEPTED':
      return t('gestion.shows_call.accept')
    case 'REJECTED':
      return t('gestion.shows_call.reject')
    default:
      return ''
  }
}

const statusMenuItems = computed(() => {
  const allStatuses: ShowApplicationStatus[] = ['PENDING', 'ACCEPTED', 'REJECTED']
  return allStatuses
    .filter((status) => status !== application.value?.status)
    .map((status) => ({
      label: getStatusActionLabel(status),
      icon: getStatusIcon(status),
      color: getStatusColor(status),
      onSelect: () => confirmStatusChange(status),
    }))
})

const confirmModalTexts = computed(() => {
  const title = application.value?.showTitle || ''
  switch (confirmingStatus.value) {
    case 'ACCEPTED':
      return {
        title: t('gestion.shows_call.confirm_accept_title'),
        description: t('gestion.shows_call.confirm_accept_desc', { title }),
        confirmLabel: t('gestion.shows_call.accept'),
        confirmColor: 'success' as const,
        confirmIcon: 'i-heroicons-check',
        iconName: 'i-heroicons-check-circle',
        iconColor: 'text-green-500',
      }
    case 'REJECTED':
      return {
        title: t('gestion.shows_call.confirm_reject_title'),
        description: t('gestion.shows_call.confirm_reject_desc', { title }),
        confirmLabel: t('gestion.shows_call.reject'),
        confirmColor: 'error' as const,
        confirmIcon: 'i-heroicons-x-mark',
        iconName: 'i-heroicons-x-circle',
        iconColor: 'text-red-500',
      }
    case 'PENDING':
    default:
      return {
        title: t('gestion.shows_call.confirm_pending_title'),
        description: t('gestion.shows_call.confirm_pending_desc', { title }),
        confirmLabel: t('gestion.shows_call.set_pending'),
        confirmColor: 'warning' as const,
        confirmIcon: 'i-heroicons-clock',
        iconName: 'i-heroicons-clock',
        iconColor: 'text-yellow-500',
      }
  }
})

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const parseSocialLinks = (links: string): string[] => {
  return links
    .split('\n')
    .map((link) => link.trim())
    .filter((link) => {
      if (link.length === 0) return false
      try {
        const url = new URL(link)
        return url.protocol === 'http:' || url.protocol === 'https:'
      } catch {
        return false
      }
    })
}

const getSocialLinkLabel = (url: string): string => {
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    const parts = hostname.split('.')
    if (parts.length >= 2) {
      return parts[parts.length - 2]
    }
    return hostname
  } catch {
    return url
  }
}

const getYouTubeId = (url: string): string | null => {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1) || null
    }
    if (parsed.hostname.includes('youtube.com')) {
      return parsed.searchParams.get('v') || null
    }
    return null
  } catch {
    return null
  }
}

// Vimeo: gère vimeo.com/{id}, vimeo.com/{id}/{hash} (lien privé),
// vimeo.com/channels/{channel}/{id}, vimeo.com/groups/{group}/videos/{id},
// et player.vimeo.com/video/{id}
const getVimeoEmbed = (url: string): string | null => {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes('vimeo.com')) return null
    const segments = parsed.pathname.split('/').filter(Boolean)
    if (parsed.hostname === 'player.vimeo.com') {
      const idx = segments.indexOf('video')
      const id = idx >= 0 ? segments[idx + 1] : null
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null
    }
    const numericIndex = segments.findIndex((s) => /^\d+$/.test(s))
    if (numericIndex === -1) return null
    const id = segments[numericIndex]
    const hash = segments[numericIndex + 1]
    const hashParam = hash && /^[a-zA-Z0-9]+$/.test(hash) ? `?h=${hash}` : ''
    return `https://player.vimeo.com/video/${id}${hashParam}`
  } catch {
    return null
  }
}

const videoEmbed = computed<{ src: string; allow: string } | null>(() => {
  const url = application.value?.videoUrl
  if (!url) return null
  const ytId = getYouTubeId(url)
  if (ytId) {
    return {
      src: `https://www.youtube.com/embed/${ytId}?rel=0`,
      allow:
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share;',
    }
  }
  const vimeoSrc = getVimeoEmbed(url)
  if (vimeoSrc) {
    return {
      src: vimeoSrc,
      allow: 'autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media;',
    }
  }
  return null
})

// Index des artistes déjà importés sur l'édition (par email → showIds liés)
// Utilisé pour 3 états du bouton d'import par performer :
//   - non importé          → bouton "Importer comme artiste"
//   - importé, pas lié     → bouton "Lier au spectacle" (cas où on accepte une
//                            2e candidature impliquant le même performer pour
//                            un autre spectacle)
//   - importé et lié       → badge "Déjà importé"
type ArtistShowIndex = Map<string, { showIds: Set<number> }>
const editionArtistsIndex = ref<ArtistShowIndex>(new Map())

const fetchEditionArtistEmails = async () => {
  try {
    const response = await $fetch<{
      data: {
        artists: {
          user: { email: string }
          shows?: { show: { id: number } }[]
        }[]
      }
    }>(`/api/editions/${editionId}/artists`)
    const artists = response.data?.artists || []
    const next: ArtistShowIndex = new Map()
    for (const a of artists) {
      next.set(a.user.email.toLowerCase(), {
        showIds: new Set((a.shows || []).map((s) => s.show.id)),
      })
    }
    editionArtistsIndex.value = next
  } catch (error) {
    console.error('Error fetching edition artists:', error)
  }
}

const isPerformerImported = (email?: string) => {
  if (!email) return false
  return editionArtistsIndex.value.has(email.toLowerCase())
}

const isPerformerLinkedToCurrentShow = (email?: string) => {
  if (!email) return false
  const entry = editionArtistsIndex.value.get(email.toLowerCase())
  if (!entry) return false
  // Pas de spectacle lié à la candidature → considéré comme "lié" (rien à attacher)
  if (!application.value?.showId) return true
  return entry.showIds.has(application.value.showId)
}

// Import d'un performer comme EditionArtist (avec liaison ShowArtist si la
// candidature est liée à un spectacle)
type AdditionalPerformer = {
  firstName: string
  lastName: string
  email: string
  phone?: string
}

const showImportPerformerModal = ref(false)
const importingPerformerIndex = ref<number | null>(null)
const pendingImportIndex = ref<number | null>(null)
// Toggle dans la modale : appliquer les infos de la candidature à l'EditionArtist
// (accommodationAutonomous + append organizerNotes avec préférences artiste + ville)
const applyApplicationData = ref(true)
const pendingImportPerformer = computed<AdditionalPerformer | null>(() => {
  if (pendingImportIndex.value === null) return null
  const performers = (application.value?.additionalPerformers || []) as AdditionalPerformer[]
  return performers[pendingImportIndex.value] || null
})

const importPerformerModalTexts = computed(() => {
  const performer = pendingImportPerformer.value
  const name = performer ? `${performer.firstName} ${performer.lastName}` : ''
  const alreadyImported = performer ? isPerformerImported(performer.email) : false

  if (alreadyImported && application.value?.showId) {
    // Cas "lier au spectacle" : l'artiste est déjà importé sur l'édition mais
    // pas encore lié au spectacle de cette candidature.
    return {
      title: t('gestion.shows_call.confirm_link_performer_to_show_title'),
      description: t('gestion.shows_call.confirm_link_performer_to_show_desc', { name }),
      confirmLabel: t('gestion.shows_call.link_performer_to_show'),
      confirmIcon: 'i-heroicons-link',
      iconName: 'i-heroicons-link',
    }
  }

  return {
    title: t('gestion.shows_call.confirm_import_performer_title'),
    description: t(
      application.value?.showId
        ? 'gestion.shows_call.confirm_import_performer_with_show_desc'
        : 'gestion.shows_call.confirm_import_performer_desc',
      { name }
    ),
    confirmLabel: t('gestion.shows_call.import_performer'),
    confirmIcon: 'i-heroicons-user-plus',
    iconName: 'i-heroicons-user-plus',
  }
})

const confirmImportPerformer = (index: number) => {
  pendingImportIndex.value = index
  applyApplicationData.value = true
  showImportPerformerModal.value = true
}

const cancelImportPerformer = () => {
  showImportPerformerModal.value = false
  pendingImportIndex.value = null
}

const executeImportPerformer = async () => {
  if (pendingImportIndex.value === null || !application.value) return
  const index = pendingImportIndex.value
  importingPerformerIndex.value = index
  showImportPerformerModal.value = false
  try {
    await $fetch(
      `/api/editions/${editionId}/shows-call/${showCallId}/applications/${application.value.id}/import-performer`,
      {
        method: 'POST',
        body: { performerIndex: index, applyApplicationData: applyApplicationData.value },
      }
    )
    // Rafraîchir la liste locale pour basculer le bouton en badge "Déjà importé"
    await fetchEditionArtistEmails()
    toast.add({
      title: t('common.saved'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (error: any) {
    const message =
      error?.data?.message || error?.statusMessage || error?.message || t('common.error')
    toast.add({ title: message, icon: 'i-heroicons-x-circle', color: 'error' })
  } finally {
    importingPerformerIndex.value = null
    pendingImportIndex.value = null
  }
}

// Charger les spectacles de l'édition (pour le select "linked show")
const fetchEditionShows = async () => {
  loadingShows.value = true
  try {
    const response = await $fetch<{ data: { shows: { id: number; title: string }[] } }>(
      `/api/editions/${editionId}/shows`
    )
    editionShows.value = response.data?.shows || []
  } catch (error) {
    console.error('Error fetching shows:', error)
  } finally {
    loadingShows.value = false
  }
}

// Charger l'appel à spectacles
const fetchShowCall = async () => {
  loadingShowCall.value = true
  try {
    const response = await $fetch<EditionShowCallBasic>(
      `/api/editions/${editionId}/shows-call/${showCallId}`
    )
    showCall.value = response
  } catch (error: any) {
    console.error('Error fetching show call:', error)
    if (error?.statusCode === 404 || error?.status === 404) {
      showCall.value = null
    }
  } finally {
    loadingShowCall.value = false
  }
}

// Charger la liste des IDs (pour navigation prev/next)
const fetchApplicationIds = async () => {
  try {
    // On charge sans pagination pour avoir l'ordre complet (limit assez large)
    const response = await $fetch<{ applications: { id: number }[] }>(
      `/api/editions/${editionId}/shows-call/${showCallId}/applications`,
      { params: { page: 1, limit: 1000 } }
    )
    applicationIds.value = (response.applications || []).map((a) => a.id)
  } catch (error) {
    console.error('Error fetching application list:', error)
  }
}

// Charger le détail d'une candidature
const fetchApplication = async (id: number) => {
  loadingApplication.value = true
  try {
    const details = await $fetch<ShowApplication>(
      `/api/editions/${editionId}/shows-call/${showCallId}/applications/${id}`
    )
    application.value = details
    organizerNotes.value = details.organizerNotes || ''
    initialOrganizerNotes.value = details.organizerNotes || ''
    editableDescription.value = details.showDescription || ''
    initialDescription.value = details.showDescription || ''
    editingDescription.value = false
    linkedShowId.value = details.showId ?? null
  } catch (error: any) {
    console.error('Error fetching application:', error)
    application.value = null
    if (error?.statusCode !== 404 && error?.status !== 404) {
      toast.add({
        title: t('common.error'),
        color: 'error',
      })
    }
  } finally {
    loadingApplication.value = false
  }
}

// Recharge les détails quand l'ID change (navigation prev/next)
watch(applicationId, (newId) => {
  if (Number.isFinite(newId)) {
    fetchApplication(newId)
  }
})

// Sauvegarde du spectacle associé
const { execute: executeSaveLinkedShow, loading: savingLinkedShow } = useApiAction(
  () => `/api/editions/${editionId}/shows-call/${showCallId}/applications/${application.value?.id}`,
  {
    method: 'PATCH',
    body: () => ({ showId: linkedShowId.value }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('common.error') },
  }
)

const saveLinkedShow = () => {
  if (!application.value) return
  executeSaveLinkedShow()
}

// Sauvegarde de la description
const descriptionChanged = computed(() => editableDescription.value !== initialDescription.value)

const { execute: executeSaveDescription, loading: savingDescription } = useApiAction(
  () => `/api/editions/${editionId}/shows-call/${showCallId}/applications/${application.value?.id}`,
  {
    method: 'PATCH',
    body: () => ({ showDescription: editableDescription.value }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('common.error') },
    onSuccess: () => {
      initialDescription.value = editableDescription.value
      editingDescription.value = false
      if (application.value) application.value.showDescription = editableDescription.value
    },
  }
)

const saveDescription = () => {
  if (!application.value) return
  executeSaveDescription()
}

// Sauvegarde des notes organisateur
const notesChanged = computed(() => organizerNotes.value !== initialOrganizerNotes.value)

const { execute: executeSaveNotes, loading: savingNotes } = useApiAction(
  () => `/api/editions/${editionId}/shows-call/${showCallId}/applications/${application.value?.id}`,
  {
    method: 'PATCH',
    body: () => ({ organizerNotes: organizerNotes.value || null }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('common.error') },
    onSuccess: () => {
      initialOrganizerNotes.value = organizerNotes.value
    },
  }
)

const saveNotes = () => {
  if (!application.value) return
  executeSaveNotes()
}

// Mise à jour du statut
const { execute: executeUpdateStatus, loading: updatingStatusFromAction } = useApiAction<
  unknown,
  { application?: ShowApplication }
>(
  () => `/api/editions/${editionId}/shows-call/${showCallId}/applications/${application.value?.id}`,
  {
    method: 'PATCH',
    body: () => ({
      status: pendingStatus.value,
      organizerNotes: organizerNotes.value || null,
      ...(linkedShowId.value !== null ? { showId: linkedShowId.value } : {}),
    }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('common.error') },
    onSuccess: (response) => {
      // Remplacer entièrement l'objet pour garantir la réactivité Vue
      if (response?.application) {
        application.value = response.application
      } else if (application.value) {
        application.value = { ...application.value, status: pendingStatus.value }
      }
    },
  }
)

const confirmStatusChange = (status: ShowApplicationStatus) => {
  confirmingStatus.value = status
  showConfirmModal.value = true
}

const executeConfirmedStatusChange = () => {
  if (!application.value) return
  pendingStatus.value = confirmingStatus.value
  showConfirmModal.value = false
  executeUpdateStatus()
}

const updatingStatus = computed(() => updatingStatusFromAction.value)

// Initialisation
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }

  await Promise.all([
    fetchShowCall(),
    fetchApplication(applicationId.value),
    fetchApplicationIds(),
    fetchEditionShows(),
    fetchEditionArtistEmails(),
  ])
})

useSeoMeta({
  title: () =>
    application.value
      ? `${application.value.showTitle} - ${t('gestion.shows_call.applications_title')}`
      : t('gestion.shows_call.applications_title'),
})
</script>
