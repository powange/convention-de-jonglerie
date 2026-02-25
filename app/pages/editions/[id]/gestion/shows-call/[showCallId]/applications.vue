<template>
  <div>
    <div v-if="editionStore.loading || loadingShowCall">
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
          <NuxtLink
            :to="`/editions/${editionId}/gestion/shows-call/${showCallId}`"
            class="hover:text-primary-500"
          >
            {{ showCall.name }}
          </NuxtLink>
          <UIcon name="i-heroicons-chevron-right" />
          <span>{{ $t('gestion.shows_call.applications_title') }}</span>
        </div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-document-text" class="text-amber-500" />
          {{ $t('gestion.shows_call.applications_title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ showCall.name }} - {{ $t('gestion.shows_call.applications_description') }}
        </p>
      </div>

      <!-- Statistiques -->
      <div v-if="stats" class="mb-6 flex flex-wrap gap-3">
        <UBadge color="neutral" variant="soft" size="lg">
          {{ $t('common.total') }}: {{ stats.pending + stats.accepted + stats.rejected }}
        </UBadge>
        <UBadge color="warning" variant="soft" size="lg">
          {{ $t('gestion.shows_call.status_pending') }}: {{ stats.pending }}
        </UBadge>
        <UBadge color="success" variant="soft" size="lg">
          {{ $t('gestion.shows_call.status_accepted') }}: {{ stats.accepted }}
        </UBadge>
        <UBadge color="error" variant="soft" size="lg">
          {{ $t('gestion.shows_call.status_rejected') }}: {{ stats.rejected }}
        </UBadge>
      </div>

      <!-- Filtres -->
      <UCard class="mb-6">
        <div class="flex flex-wrap items-center gap-4">
          <!-- Filtre par statut -->
          <UFormField :label="$t('gestion.shows_call.filter_status')">
            <USelect
              v-model="statusFilter"
              :items="statusOptions"
              class="w-40"
              @change="fetchApplications()"
            />
          </UFormField>

          <!-- Recherche -->
          <UFormField :label="$t('gestion.shows_call.filter_search')" class="flex-1">
            <UInput
              v-model="searchQuery"
              :placeholder="$t('gestion.shows_call.search_placeholder')"
              icon="i-heroicons-magnifying-glass"
              class="w-full max-w-md"
              @keydown.enter="fetchApplications()"
            />
          </UFormField>

          <UButton
            color="primary"
            variant="soft"
            icon="i-heroicons-magnifying-glass"
            class="mt-5"
            @click="fetchApplications()"
          >
            {{ $t('common.search') }}
          </UButton>
        </div>
      </UCard>

      <!-- Tableau des candidatures -->
      <UCard>
        <div v-if="loadingApplications" class="py-8 text-center">
          <p class="text-gray-500">{{ $t('common.loading') }}...</p>
        </div>

        <div v-else-if="applications.length === 0" class="py-12 text-center">
          <UIcon name="i-heroicons-inbox" class="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {{ $t('gestion.shows_call.no_applications') }}
          </h3>
          <p class="text-gray-500">
            {{ $t('gestion.shows_call.no_applications_desc') }}
          </p>
        </div>

        <div v-else class="space-y-4">
          <!-- Liste des candidatures -->
          <div
            v-for="application in applications"
            :key="application.id"
            class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div class="flex items-start justify-between gap-4">
              <!-- Info principale -->
              <div class="flex items-start gap-4 flex-1">
                <UiUserAvatar :user="application.user" size="lg" />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <h3 class="font-semibold text-gray-900 dark:text-white">
                      {{ application.showTitle }}
                    </h3>
                    <UBadge :color="getStatusColor(application.status)" variant="soft" size="sm">
                      {{ $t(`gestion.shows_call.status_${application.status.toLowerCase()}`) }}
                    </UBadge>
                  </div>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('gestion.shows_call.by_artist') }}
                    <span class="font-medium">{{ application.artistName }}</span>
                  </p>
                  <p class="text-sm text-gray-500 mt-1">
                    {{ $t('gestion.shows_call.duration') }}: {{ application.showDuration }} min
                    <span v-if="application.showCategory" class="ml-2">
                      | {{ application.showCategory }}
                    </span>
                  </p>
                  <div v-if="application.show" class="mt-1">
                    <UBadge color="warning" variant="subtle" size="sm">
                      <UIcon name="i-heroicons-sparkles" class="mr-1" />
                      {{ application.show.title }}
                    </UBadge>
                  </div>
                  <p class="text-xs text-gray-400 mt-1">
                    {{ $t('gestion.shows_call.submitted_at') }}
                    {{ formatDate(application.createdAt) }}
                  </p>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-2">
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-heroicons-eye"
                  size="sm"
                  @click="openApplicationDetails(application)"
                >
                  {{ $t('common.view') }}
                </UButton>

                <UDropdownMenu
                  v-if="application.status === 'PENDING'"
                  :items="getActionItems(application)"
                >
                  <UButton
                    color="neutral"
                    variant="soft"
                    icon="i-heroicons-ellipsis-vertical"
                    size="sm"
                  />
                </UDropdownMenu>
              </div>
            </div>

            <!-- Description courte -->
            <p
              v-if="application.showDescription"
              class="mt-3 text-sm text-gray-600 dark:text-gray-400 line-clamp-2"
            >
              {{ application.showDescription }}
            </p>
          </div>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="flex justify-center pt-4">
            <UPagination
              v-model:page="currentPage"
              :total="total"
              :items-per-page="pageSize"
              @update:page="fetchApplications()"
            />
          </div>
        </div>
      </UCard>
    </div>

    <!-- Drawer de détails -->
    <UDrawer
      v-model:open="showDetailsModal"
      :title="selectedApplication?.showTitle"
      direction="bottom"
    >
      <template v-if="selectedApplication" #body>
        <div class="space-y-6">
          <!-- Statut actuel -->
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-500">{{ $t('common.status') }}</span>
            <UBadge :color="getStatusColor(selectedApplication.status)" variant="soft">
              {{ $t(`gestion.shows_call.status_${selectedApplication.status.toLowerCase()}`) }}
            </UBadge>
          </div>

          <!-- Info artiste -->
          <div class="space-y-3">
            <h4 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <UIcon name="i-heroicons-user" class="text-amber-500" />
              {{ $t('gestion.shows_call.artist_info') }}
            </h4>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-gray-500">{{ $t('gestion.shows_call.form.artist_name') }}</span>
                <p class="font-medium">{{ selectedApplication.artistName }}</p>
              </div>
              <div>
                <span class="text-gray-500">{{ $t('gestion.shows_call.submitted_by') }}</span>
                <div class="flex items-center gap-2 mt-1">
                  <UiUserAvatar :user="selectedApplication.user" size="sm" />
                  <span class="font-medium">
                    {{ selectedApplication.user?.prenom }} {{ selectedApplication.user?.nom }}
                  </span>
                </div>
              </div>
            </div>
            <div v-if="selectedApplication.artistBio">
              <span class="text-gray-500 text-sm">{{
                $t('gestion.shows_call.form.artist_bio')
              }}</span>
              <p class="mt-1 text-sm">{{ selectedApplication.artistBio }}</p>
            </div>
            <div class="flex flex-wrap gap-4 text-sm">
              <a
                v-if="selectedApplication.portfolioUrl"
                :href="selectedApplication.portfolioUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary-500 hover:underline flex items-center gap-1"
              >
                <UIcon name="i-heroicons-globe-alt" />
                Portfolio
              </a>
              <a
                v-if="selectedApplication.videoUrl"
                :href="selectedApplication.videoUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary-500 hover:underline flex items-center gap-1"
              >
                <UIcon name="i-heroicons-play-circle" />
                {{ $t('gestion.shows_call.form.video_url') }}
              </a>
            </div>
            <div v-if="selectedApplication.socialLinks" class="mt-2">
              <span class="text-gray-500 text-sm">{{
                $t('gestion.shows_call.form.social_links')
              }}</span>
              <div class="mt-1 flex flex-wrap gap-2">
                <a
                  v-for="(link, index) in parseSocialLinks(selectedApplication.socialLinks)"
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

          <!-- Info spectacle -->
          <div class="space-y-3">
            <h4 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <UIcon name="i-heroicons-sparkles" class="text-amber-500" />
              {{ $t('gestion.shows_call.show_info') }}
            </h4>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-gray-500">{{ $t('gestion.shows_call.form.show_title') }}</span>
                <p class="font-medium">{{ selectedApplication.showTitle }}</p>
              </div>
              <div>
                <span class="text-gray-500">{{ $t('gestion.shows_call.form.duration') }}</span>
                <p class="font-medium">{{ selectedApplication.showDuration }} min</p>
              </div>
              <div v-if="selectedApplication.showCategory">
                <span class="text-gray-500">{{ $t('gestion.shows_call.form.category') }}</span>
                <p class="font-medium">{{ selectedApplication.showCategory }}</p>
              </div>
            </div>
            <div>
              <span class="text-gray-500 text-sm">{{
                $t('gestion.shows_call.form.description')
              }}</span>
              <p class="mt-1 text-sm whitespace-pre-wrap">
                {{ selectedApplication.showDescription }}
              </p>
            </div>
            <div v-if="selectedApplication.technicalNeeds">
              <span class="text-gray-500 text-sm">{{
                $t('gestion.shows_call.form.technical_needs')
              }}</span>
              <p class="mt-1 text-sm whitespace-pre-wrap">
                {{ selectedApplication.technicalNeeds }}
              </p>
            </div>
          </div>

          <!-- Logistique -->
          <div v-if="selectedApplication.accommodationNeeded" class="space-y-3">
            <h4 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <UIcon name="i-heroicons-truck" class="text-amber-500" />
              {{ $t('gestion.shows_call.logistics') }}
            </h4>
            <div class="text-sm space-y-2">
              <div v-if="selectedApplication.accommodationNeeded">
                <UBadge color="info" variant="soft">
                  {{ $t('gestion.shows_call.accommodation_needed') }}
                </UBadge>
                <p v-if="selectedApplication.accommodationNotes" class="mt-1 text-sm">
                  {{ selectedApplication.accommodationNotes }}
                </p>
              </div>
            </div>
          </div>

          <!-- Contact -->
          <div
            v-if="selectedApplication.contactPhone || selectedApplication.user?.email"
            class="space-y-3"
          >
            <h4 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <UIcon name="i-heroicons-phone" class="text-amber-500" />
              {{ $t('gestion.shows_call.contact') }}
            </h4>
            <div class="text-sm space-y-1">
              <p v-if="selectedApplication.user?.email">
                <span class="text-gray-500">Email:</span>
                <a :href="`mailto:${selectedApplication.user.email}`" class="text-primary-500 ml-1">
                  {{ selectedApplication.user.email }}
                </a>
              </p>
              <p v-if="selectedApplication.contactPhone">
                <span class="text-gray-500">{{ $t('gestion.shows_call.form.phone') }}:</span>
                <span class="ml-1">{{ selectedApplication.contactPhone }}</span>
              </p>
            </div>
          </div>

          <!-- Spectacle associé -->
          <div class="space-y-3 border-t pt-4">
            <h4 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <UIcon name="i-heroicons-sparkles" class="text-amber-500" />
              {{ $t('gestion.shows_call.linked_show') }}
            </h4>
            <UFormField :label="$t('gestion.shows_call.linked_show_select')">
              <USelect
                v-model="linkedShowId"
                :items="showSelectItems"
                :placeholder="$t('gestion.shows_call.linked_show_placeholder')"
                :loading="loadingShows"
                class="w-full"
              />
            </UFormField>
          </div>

          <!-- Notes organisateur -->
          <div class="space-y-3 border-t pt-4">
            <h4 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <UIcon name="i-heroicons-pencil-square" class="text-amber-500" />
              {{ $t('gestion.shows_call.organizer_notes') }}
            </h4>
            <UTextarea
              v-model="organizerNotes"
              :placeholder="$t('gestion.shows_call.organizer_notes_placeholder')"
              :rows="3"
              class="w-full"
            />
          </div>

          <!-- Conversation avec l'artiste -->
          <div class="space-y-3 border-t pt-4">
            <ShowApplicationChat :application-id="selectedApplication.id" class="h-80" />
          </div>

          <!-- Décision -->
          <div v-if="selectedApplication.decidedAt" class="text-xs text-gray-400 border-t pt-3">
            {{ $t('gestion.shows_call.decided_info') }}
            {{ formatDate(selectedApplication.decidedAt) }}
            <span v-if="selectedApplication.decidedBy">
              {{ $t('common.by') }} {{ selectedApplication.decidedBy.pseudo }}
            </span>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-between gap-3">
          <UButton color="neutral" variant="ghost" @click="showDetailsModal = false">
            {{ $t('common.close') }}
          </UButton>

          <div class="flex gap-2">
            <UButton
              color="primary"
              variant="soft"
              icon="i-heroicons-document-check"
              :loading="updatingStatus"
              @click="saveApplicationDetails"
            >
              {{ $t('common.save') }}
            </UButton>
            <UButton
              v-if="selectedApplication?.status !== 'REJECTED'"
              color="error"
              variant="soft"
              icon="i-heroicons-x-mark"
              :loading="updatingStatus"
              @click="updateApplicationStatus('REJECTED')"
            >
              {{ $t('gestion.shows_call.reject') }}
            </UButton>
            <UButton
              v-if="selectedApplication?.status !== 'ACCEPTED'"
              color="success"
              icon="i-heroicons-check"
              :loading="updatingStatus"
              @click="updateApplicationStatus('ACCEPTED')"
            >
              {{ $t('gestion.shows_call.accept') }}
            </UButton>
          </div>
        </div>
      </template>
    </UDrawer>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import type { EditionShowCallBasic, ShowApplication, ShowApplicationStatus } from '~/types'

definePageMeta({
  middleware: ['authenticated'],
})

const route = useRoute()
const authStore = useAuthStore()
const editionStore = useEditionStore()
const toast = useToast()
const { t, locale } = useI18n()

const editionId = parseInt(route.params.id as string)
const showCallId = parseInt(route.params.showCallId as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// Show call data
const showCall = ref<EditionShowCallBasic | null>(null)
const loadingShowCall = ref(true)

// Applications state
const applications = ref<ShowApplication[]>([])
const total = ref(0)
const stats = ref<{ pending: number; accepted: number; rejected: number } | null>(null)
const loadingApplications = ref(false)
const currentPage = ref(1)
const pageSize = 20
const statusFilter = ref<string | null>(null)
const searchQuery = ref('')

// Modal
const showDetailsModal = ref(false)
const selectedApplication = ref<ShowApplication | null>(null)
const organizerNotes = ref('')

// Spectacle associé
const linkedShowId = ref<number | null>(null)
const loadingShows = ref(false)
const editionShows = ref<{ id: number; title: string }[]>([])

// Refs pour les actions useApiAction avec paramètres dynamiques
const quickUpdateTarget = ref<{ appId: number; status: ShowApplicationStatus } | null>(null)
const pendingStatus = ref<ShowApplicationStatus>('PENDING')

const totalPages = computed(() => Math.ceil(total.value / pageSize))

const showSelectItems = computed(() => [
  { label: t('gestion.shows_call.linked_show_none'), value: null },
  ...editionShows.value.map((s) => ({ label: s.title, value: s.id })),
])

const statusOptions = computed(() => [
  { value: null, label: t('gestion.shows_call.filter_all') },
  { value: 'PENDING', label: t('gestion.shows_call.status_pending') },
  { value: 'ACCEPTED', label: t('gestion.shows_call.status_accepted') },
  { value: 'REJECTED', label: t('gestion.shows_call.status_rejected') },
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

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Parse social links (one per line) with proper URL validation
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

// Get a readable label for a social link
const getSocialLinkLabel = (url: string): string => {
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    // Extract main domain name
    const parts = hostname.split('.')
    if (parts.length >= 2) {
      return parts[parts.length - 2]
    }
    return hostname
  } catch {
    return url
  }
}

const getActionItems = (application: ShowApplication) => [
  [
    {
      label: t('gestion.shows_call.accept'),
      icon: 'i-heroicons-check',
      onSelect: () => quickUpdateStatus(application, 'ACCEPTED'),
    },
    {
      label: t('gestion.shows_call.reject'),
      icon: 'i-heroicons-x-mark',
      onSelect: () => quickUpdateStatus(application, 'REJECTED'),
    },
  ],
]

// Charger les spectacles de l'édition
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

// Fetch show call info
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

// Charger les candidatures
const fetchApplications = async () => {
  loadingApplications.value = true
  try {
    const params: Record<string, string | number> = {
      page: currentPage.value,
      limit: pageSize,
    }
    if (statusFilter.value) {
      params.status = statusFilter.value
    }
    if (searchQuery.value.trim()) {
      params.search = searchQuery.value.trim()
    }

    const response = await $fetch<{
      applications: ShowApplication[]
      total: number
      stats: { pending: number; accepted: number; rejected: number }
    }>(`/api/editions/${editionId}/shows-call/${showCallId}/applications`, { params })

    applications.value = response.applications
    total.value = response.total
    stats.value = response.stats
  } catch (error) {
    console.error('Error fetching applications:', error)
    toast.add({
      title: t('common.error'),
      color: 'error',
    })
  } finally {
    loadingApplications.value = false
  }
}

// Ouvrir les détails
const openApplicationDetails = async (application: ShowApplication) => {
  try {
    // Charger les détails complets (avec email, téléphone, etc.)
    const details = await $fetch<ShowApplication>(
      `/api/editions/${editionId}/shows-call/${showCallId}/applications/${application.id}`
    )
    selectedApplication.value = details
    organizerNotes.value = details.organizerNotes || ''
    linkedShowId.value = details.showId ?? null
    if (editionShows.value.length === 0) {
      fetchEditionShows()
    }
    showDetailsModal.value = true
  } catch (error) {
    console.error('Error fetching application details:', error)
    toast.add({
      title: t('common.error'),
      color: 'error',
    })
  }
}

// Mise à jour rapide du statut
const { execute: executeQuickUpdate } = useApiAction(
  () =>
    `/api/editions/${editionId}/shows-call/${showCallId}/applications/${quickUpdateTarget.value?.appId}`,
  {
    method: 'PATCH',
    body: () => ({ status: quickUpdateTarget.value?.status }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('common.error') },
    onSuccess: () => fetchApplications(),
  }
)

const quickUpdateStatus = (application: ShowApplication, status: ShowApplicationStatus) => {
  quickUpdateTarget.value = { appId: application.id, status }
  executeQuickUpdate()
}

// Enregistrer les notes et le spectacle associé sans changer le statut
const { execute: executeSaveDetails, loading: savingDetails } = useApiAction(
  () =>
    `/api/editions/${editionId}/shows-call/${showCallId}/applications/${selectedApplication.value?.id}`,
  {
    method: 'PATCH',
    body: () => ({
      organizerNotes: organizerNotes.value || null,
      showId: linkedShowId.value,
    }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('common.error') },
    onSuccess: () => fetchApplications(),
  }
)

const saveApplicationDetails = () => {
  if (!selectedApplication.value) return
  executeSaveDetails()
}

// Mise à jour du statut depuis la modal
const { execute: executeUpdateStatus, loading: updatingStatusFromModal } = useApiAction(
  () =>
    `/api/editions/${editionId}/shows-call/${showCallId}/applications/${selectedApplication.value?.id}`,
  {
    method: 'PATCH',
    body: () => ({
      status: pendingStatus.value,
      organizerNotes: organizerNotes.value || null,
      showId: linkedShowId.value,
    }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('common.error') },
    onSuccess: () => {
      showDetailsModal.value = false
      fetchApplications()
    },
  }
)

const updateApplicationStatus = (status: ShowApplicationStatus) => {
  if (!selectedApplication.value) return
  pendingStatus.value = status
  executeUpdateStatus()
}

// Computed combiné pour le loading des actions dans le drawer
const updatingStatus = computed(() => savingDetails.value || updatingStatusFromModal.value)

// Charger les données au montage
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }

  await fetchShowCall()
  await fetchApplications()
})

useSeoMeta({
  title: () =>
    showCall.value
      ? `${showCall.value.name} - ${t('gestion.shows_call.applications_title')}`
      : t('gestion.shows_call.applications_title'),
})
</script>
