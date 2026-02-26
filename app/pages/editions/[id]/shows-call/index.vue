<template>
  <div v-if="edition">
    <EditionHeader :edition="edition" current-page="shows-call" />

    <div class="space-y-6">
      <!-- Message si l'utilisateur n'est pas artiste -->
      <UAlert
        v-if="!authStore.isAuthenticated"
        icon="i-heroicons-information-circle"
        color="info"
        variant="soft"
        class="mb-4"
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
              :to="`/login?redirect=/editions/${editionId}/shows-call`"
            >
              {{ t('shows_call.login_button') }}
            </UButton>
          </div>
        </template>
      </UAlert>

      <UAlert
        v-else-if="!authStore.isArtist"
        icon="i-heroicons-exclamation-triangle"
        color="warning"
        variant="soft"
        class="mb-4"
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

      <!-- Contenu principal -->
      <UCard variant="soft">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-megaphone" class="text-amber-500" />
              {{ t('shows_call.title') }}
            </h3>
          </div>
        </template>

        <!-- État de chargement -->
        <div v-if="loading" class="flex justify-center py-8">
          <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
        </div>

        <!-- Liste des appels -->
        <div v-else-if="showCalls && showCalls.length > 0" class="space-y-4">
          <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">
            {{ t('shows_call.intro') }}
          </p>

          <div class="grid gap-4 md:grid-cols-2">
            <UCard
              v-for="call in showCalls"
              :key="call.id"
              variant="subtle"
              class="border border-gray-200 dark:border-gray-700"
            >
              <div class="space-y-3">
                <!-- En-tête avec nom et statut -->
                <div class="flex items-start justify-between gap-2">
                  <h4 class="font-semibold text-lg">{{ call.name }}</h4>
                  <div class="flex items-center gap-2">
                    <UBadge v-if="call.mode === 'EXTERNAL'" color="info" variant="soft" size="xs">
                      {{ t('gestion.shows_call.mode_external_badge') }}
                    </UBadge>
                    <UBadge
                      :color="
                        call.visibility === 'PUBLIC' || call.visibility === 'PRIVATE'
                          ? 'success'
                          : 'neutral'
                      "
                      variant="soft"
                      size="xs"
                    >
                      {{
                        call.visibility === 'PUBLIC' || call.visibility === 'PRIVATE'
                          ? t('shows_call.open')
                          : t('shows_call.closed')
                      }}
                    </UBadge>
                  </div>
                </div>

                <!-- Description -->
                <p
                  v-if="call.description"
                  class="text-sm text-gray-600 dark:text-gray-400 line-clamp-3"
                >
                  {{ call.description }}
                </p>

                <!-- Date limite -->
                <div v-if="call.deadline" class="flex items-center gap-2 text-sm">
                  <UIcon name="i-heroicons-clock" class="text-gray-400" />
                  <span class="text-gray-600 dark:text-gray-400">
                    {{ t('shows_call.deadline') }} :
                    <strong :class="isDeadlinePassed(call.deadline) ? 'text-red-500' : ''">
                      {{ formatDate(call.deadline) }}
                    </strong>
                  </span>
                </div>

                <!-- Champs demandés -->
                <div class="flex flex-wrap gap-1">
                  <UBadge v-if="call.askPortfolioUrl" color="neutral" variant="outline" size="xs">
                    {{ t('gestion.shows_call.field_portfolio') }}
                  </UBadge>
                  <UBadge v-if="call.askVideoUrl" color="neutral" variant="outline" size="xs">
                    {{ t('gestion.shows_call.field_video') }}
                  </UBadge>
                  <UBadge v-if="call.askTechnicalNeeds" color="neutral" variant="outline" size="xs">
                    {{ t('gestion.shows_call.field_technical') }}
                  </UBadge>
                  <UBadge v-if="call.askAccommodation" color="neutral" variant="outline" size="xs">
                    {{ t('gestion.shows_call.field_accommodation') }}
                  </UBadge>
                </div>

                <!-- Bouton d'action -->
                <div class="pt-2">
                  <!-- Mode externe : lien vers URL externe -->
                  <UButton
                    v-if="
                      call.mode === 'EXTERNAL' &&
                      call.externalUrl &&
                      (call.visibility === 'PUBLIC' || call.visibility === 'PRIVATE')
                    "
                    :to="call.externalUrl"
                    target="_blank"
                    color="primary"
                    icon="i-heroicons-arrow-top-right-on-square"
                    block
                  >
                    {{ t('shows_call.apply_external') }}
                  </UButton>

                  <!-- Mode interne : lien vers formulaire -->
                  <UButton
                    v-else-if="
                      call.mode === 'INTERNAL' &&
                      (call.visibility === 'PUBLIC' || call.visibility === 'PRIVATE') &&
                      authStore.isArtist
                    "
                    :to="`/editions/${editionId}/shows-call/${call.id}/apply`"
                    color="primary"
                    icon="i-heroicons-pencil-square"
                    block
                    :disabled="hasApplied(call.id) || isDeadlinePassed(call.deadline)"
                  >
                    <template v-if="hasApplied(call.id)">
                      {{ t('shows_call.already_applied') }}
                    </template>
                    <template v-else-if="isDeadlinePassed(call.deadline)">
                      {{ t('shows_call.deadline_passed') }}
                    </template>
                    <template v-else>
                      {{ t('shows_call.apply') }}
                    </template>
                  </UButton>

                  <!-- Appel fermé -->
                  <UButton
                    v-else-if="call.visibility === 'CLOSED'"
                    color="neutral"
                    variant="soft"
                    icon="i-heroicons-lock-closed"
                    block
                    disabled
                  >
                    {{ t('shows_call.closed') }}
                  </UButton>

                  <!-- Non artiste -->
                  <UButton
                    v-else-if="!authStore.isArtist && authStore.isAuthenticated"
                    color="neutral"
                    variant="soft"
                    icon="i-heroicons-exclamation-triangle"
                    block
                    disabled
                  >
                    {{ t('shows_call.artist_required_short') }}
                  </UButton>
                </div>
              </div>
            </UCard>
          </div>
        </div>

        <!-- Aucun appel -->
        <div v-else class="text-center py-8">
          <UIcon
            name="i-heroicons-megaphone"
            class="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600"
          />
          <p class="text-gray-500 dark:text-gray-400">
            {{ t('shows_call.no_calls') }}
          </p>
          <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">
            {{ t('shows_call.no_calls_desc') }}
          </p>
        </div>
      </UCard>

      <!-- Mes candidatures -->
      <ClientOnly>
        <UCard
          v-if="authStore.isAuthenticated && myApplications && myApplications.length > 0"
          variant="soft"
        >
          <template #header>
            <h3 class="text-lg font-semibold flex items-center gap-2">
              <UIcon name="i-heroicons-document-text" class="text-primary-500" />
              {{ t('shows_call.my_applications') }}
            </h3>
          </template>

          <div class="space-y-3">
            <div
              v-for="app in myApplications"
              :key="app.id"
              class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
            >
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ app.showTitle }}</span>
                  <UBadge :color="getStatusColor(app.status)" variant="soft" size="xs">
                    {{ getStatusLabel(app.status) }}
                  </UBadge>
                  <UBadge
                    v-if="app.additionalPerformersCount > 0"
                    color="info"
                    variant="soft"
                    size="xs"
                  >
                    <UIcon name="i-heroicons-users" class="mr-1" />
                    +{{ app.additionalPerformersCount }}
                  </UBadge>
                </div>
                <p class="text-sm text-gray-500">
                  {{ app.showCallName }} - {{ t('shows_call.submitted_at') }}
                  {{ formatDate(app.createdAt) }}
                </p>
              </div>
              <!-- Bouton modifier si candidature en attente -->
              <UButton
                v-if="app.status === 'PENDING' && canEditApplication(app.showCallId)"
                :to="`/editions/${editionId}/shows-call/${app.showCallId}/apply`"
                color="primary"
                variant="soft"
                size="sm"
                icon="i-heroicons-pencil-square"
              >
                {{ t('shows_call.edit_application') }}
              </UButton>
            </div>
          </div>
        </UCard>
      </ClientOnly>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import type {
  Edition,
  EditionShowCallPublic,
  ShowApplicationWithShowCallName,
  ShowApplicationStatus,
} from '~/types'
import { getEditionDisplayName } from '~/utils/editionName'

const route = useRoute()
const authStore = useAuthStore()
const editionStore = useEditionStore()
const { t } = useI18n()
const { formatDate } = useDateFormat()

const editionId = parseInt(route.params.id as string)

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

// Charger les appels à spectacles publics
const {
  data: showCallsResponse,
  pending: loading,
  error: _showCallsError,
} = await useFetch<{ showCalls: EditionShowCallPublic[]; hasOpenCalls: boolean }>(
  `/api/editions/${editionId}/shows-call/public`
)

const showCalls = computed(() => showCallsResponse.value?.showCalls || [])

// Charger mes candidatures (si authentifié)
const myApplications = ref<ShowApplicationWithShowCallName[]>([])

onMounted(async () => {
  if (authStore.isAuthenticated) {
    await loadMyApplications()
  }
})

async function loadMyApplications() {
  try {
    const response = await $fetch<{ applications: ShowApplicationWithShowCallName[] }>(
      `/api/editions/${editionId}/shows-call/my-applications`
    )
    myApplications.value = response.applications
  } catch {
    // Silencieux - les candidatures ne sont pas critiques
  }
}

function hasApplied(showCallId: number): boolean {
  return myApplications.value.some((app) => app.showCallId === showCallId)
}

function canEditApplication(showCallId: number): boolean {
  const call = showCalls.value.find((c) => c.id === showCallId)
  if (!call) return false
  if (call.visibility === 'CLOSED' || call.visibility === 'OFFLINE') return false
  if (call.deadline && new Date() > new Date(call.deadline)) return false
  return true
}

function isDeadlinePassed(deadline: string | null): boolean {
  if (!deadline) return false
  return new Date() > new Date(deadline)
}

function getStatusColor(status: ShowApplicationStatus): 'warning' | 'success' | 'error' {
  switch (status) {
    case 'ACCEPTED':
      return 'success'
    case 'REJECTED':
      return 'error'
    default:
      return 'warning'
  }
}

function getStatusLabel(status: ShowApplicationStatus): string {
  switch (status) {
    case 'ACCEPTED':
      return t('gestion.shows_call.status_accepted')
    case 'REJECTED':
      return t('gestion.shows_call.status_rejected')
    default:
      return t('gestion.shows_call.status_pending')
  }
}

// SEO
const editionName = computed(() => (edition.value ? getEditionDisplayName(edition.value) : ''))
useSeoMeta({
  title: computed(() => `${t('shows_call.title')} - ${editionName.value}`),
  description: computed(() => t('shows_call.seo_description', { name: editionName.value })),
})
</script>
