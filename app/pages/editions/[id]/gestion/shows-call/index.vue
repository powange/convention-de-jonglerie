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
    <div v-else>
      <!-- Titre de la page -->
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UIcon name="i-heroicons-sparkles" class="text-amber-500" />
            {{ $t('gestion.shows_call.title') }}
          </h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">
            {{ $t('gestion.shows_call.list_description') }}
          </p>
        </div>
        <UButton icon="i-heroicons-plus" color="primary" @click="openCreateModal">
          {{ $t('gestion.shows_call.create') }}
        </UButton>
      </div>

      <!-- Liste des appels -->
      <div v-if="showCallsLoading" class="flex justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin text-2xl text-gray-400" />
      </div>

      <div v-else-if="showCalls.length === 0" class="py-12">
        <UCard>
          <div class="text-center py-8">
            <UIcon
              name="i-heroicons-sparkles"
              class="text-4xl text-gray-300 dark:text-gray-600 mb-4"
            />
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {{ $t('gestion.shows_call.no_calls') }}
            </h3>
            <p class="text-gray-500 dark:text-gray-400 mb-4">
              {{ $t('gestion.shows_call.no_calls_desc') }}
            </p>
            <UButton icon="i-heroicons-plus" color="primary" @click="openCreateModal">
              {{ $t('gestion.shows_call.create_first') }}
            </UButton>
          </div>
        </UCard>
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
        <UCard
          v-for="showCall in showCalls"
          :key="showCall.id"
          class="hover:shadow-md transition-shadow"
          :ui="{ root: 'flex flex-col h-full', body: 'flex flex-col flex-1' }"
        >
          <div class="flex-1">
            <div class="flex flex-wrap items-center gap-2 mb-3">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {{ showCall.name }}
              </h3>
              <UBadge :color="getVisibilityColor(showCall.visibility)" variant="soft" size="sm">
                {{ getVisibilityLabel(showCall.visibility) }}
              </UBadge>
              <UBadge
                :color="showCall.mode === 'INTERNAL' ? 'primary' : 'warning'"
                variant="subtle"
                size="sm"
              >
                {{
                  showCall.mode === 'INTERNAL'
                    ? $t('gestion.shows_call.mode_internal_badge')
                    : $t('gestion.shows_call.mode_external_badge')
                }}
              </UBadge>
            </div>

            <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <div v-if="showCall.deadline" class="flex items-center gap-1">
                <UIcon name="i-heroicons-calendar" />
                <span
                  >{{ $t('gestion.shows_call.deadline_label') }}:
                  {{ formatDate(showCall.deadline) }}</span
                >
              </div>
              <div v-if="showCall.stats?.pending" class="flex items-center gap-1">
                <UBadge color="warning" variant="soft" size="xs">
                  {{ showCall.stats.pending }} {{ $t('gestion.shows_call.pending_short') }}
                </UBadge>
              </div>
            </div>
          </div>

          <div
            class="flex items-center gap-2 mt-auto pt-4 border-t border-gray-200 dark:border-gray-700"
          >
            <UButton
              icon="i-heroicons-cog-6-tooth"
              :aria-label="$t('common.configure')"
              variant="soft"
              color="neutral"
              size="sm"
              :to="`/editions/${editionId}/gestion/shows-call/${showCall.id}`"
            />
            <UButton
              icon="i-heroicons-trash"
              :aria-label="$t('common.delete')"
              variant="soft"
              color="error"
              size="sm"
              @click="openDeleteModal(showCall)"
            />
            <UButton
              icon="i-heroicons-document-text"
              variant="soft"
              color="primary"
              size="sm"
              class="ml-auto"
              :to="`/editions/${editionId}/gestion/shows-call/${showCall.id}/applications`"
            >
              {{ showCall.stats?.total || 0 }} {{ $t('gestion.shows_call.applications_count') }}
            </UButton>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Modal de création -->
    <UModal v-model:open="createModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-plus-circle" class="text-amber-500" />
              <h3 class="text-lg font-semibold">{{ $t('gestion.shows_call.create') }}</h3>
            </div>
          </template>

          <div class="space-y-4">
            <UFormField
              :label="$t('gestion.shows_call.name_label')"
              :error="createErrors.name"
              required
            >
              <UInput
                v-model="createForm.name"
                :placeholder="$t('gestion.shows_call.name_placeholder')"
                class="w-full"
              />
            </UFormField>

            <UFormField :label="$t('gestion.shows_call.description_label')">
              <UTextarea
                v-model="createForm.description"
                :placeholder="$t('gestion.shows_call.description_placeholder')"
                :rows="3"
                class="w-full"
              />
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton variant="ghost" color="neutral" @click="createModalOpen = false">
                {{ $t('common.cancel') }}
              </UButton>
              <UButton color="primary" :loading="creating" @click="createShowCall">
                {{ $t('common.create') }}
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Modal de confirmation de suppression -->
    <UiConfirmModal
      v-model="deleteModalOpen"
      :title="$t('gestion.shows_call.delete_confirm_title')"
      :description="
        $t('gestion.shows_call.delete_confirm_message', { name: showCallToDelete?.name })
      "
      :confirm-label="$t('common.delete')"
      confirm-color="error"
      icon-name="i-heroicons-exclamation-triangle"
      icon-color="text-red-500"
      :loading="deleting"
      require-name-confirmation
      :expected-name="showCallToDelete?.name"
      @confirm="confirmDelete"
      @cancel="deleteModalOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import type { EditionShowCallWithStats, ShowCallVisibility } from '~/types'

definePageMeta({
  middleware: ['authenticated'],
})

const route = useRoute()
const authStore = useAuthStore()
const editionStore = useEditionStore()
const toast = useToast()
const { t, locale } = useI18n()

const editionId = Number(route.params.id)

// Charger les données de l'édition
const { data: edition, pending: loading } = await useFetch(`/api/editions/${editionId}`, {
  key: `edition-${editionId}`,
})

// État
const showCalls = ref<EditionShowCallWithStats[]>([])
const showCallsLoading = ref(true)
const createModalOpen = ref(false)
const deleteModalOpen = ref(false)
const showCallToDelete = ref<EditionShowCallWithStats | null>(null)
const createForm = ref({
  name: '',
  description: '',
})
const createErrors = ref<Record<string, string>>({})

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

// Charger les appels à spectacles
const fetchShowCalls = async () => {
  showCallsLoading.value = true
  try {
    const response = await $fetch<{ showCalls: EditionShowCallWithStats[] }>(
      `/api/editions/${editionId}/shows-call`
    )
    showCalls.value = response.showCalls
  } catch (error) {
    console.error('Error fetching show calls:', error)
    toast.add({
      title: t('common.error'),
      color: 'error',
    })
  } finally {
    showCallsLoading.value = false
  }
}

// Couleur et label de visibilité
const getVisibilityColor = (
  visibility: ShowCallVisibility
): 'success' | 'warning' | 'neutral' | 'error' => {
  switch (visibility) {
    case 'PUBLIC':
      return 'success'
    case 'PRIVATE':
      return 'warning'
    case 'OFFLINE':
      return 'error'
    default:
      return 'neutral'
  }
}

const getVisibilityLabel = (visibility: ShowCallVisibility): string => {
  switch (visibility) {
    case 'PUBLIC':
      return t('gestion.shows_call.visibility_public')
    case 'PRIVATE':
      return t('gestion.shows_call.visibility_private')
    case 'OFFLINE':
      return t('gestion.shows_call.visibility_offline')
    default:
      return t('gestion.shows_call.visibility_closed')
  }
}

// Formater la date
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString(locale.value, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Ouvrir la modal de création
const openCreateModal = () => {
  createForm.value = { name: '', description: '' }
  createErrors.value = {}
  createModalOpen.value = true
}

// Créer un appel
const { execute: executeCreateShowCall, loading: creating } = useApiAction(
  () => `/api/editions/${editionId}/shows-call`,
  {
    method: 'POST',
    body: () => ({
      name: createForm.value.name.trim(),
      description: createForm.value.description.trim() || null,
    }),
    successMessage: { title: t('common.created') },
    errorMessages: { default: t('common.error') },
    onSuccess: () => {
      createModalOpen.value = false
      fetchShowCalls()
    },
  }
)

const createShowCall = () => {
  createErrors.value = {}

  if (!createForm.value.name.trim()) {
    createErrors.value.name = t('common.required')
    return
  }

  executeCreateShowCall()
}

// Ouvrir la modal de suppression
const openDeleteModal = (showCall: EditionShowCallWithStats) => {
  showCallToDelete.value = showCall
  deleteModalOpen.value = true
}

// Confirmer la suppression
const { execute: executeDeleteShowCall, loading: deleting } = useApiAction(
  () => `/api/editions/${editionId}/shows-call/${showCallToDelete.value?.id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('common.deleted') },
    errorMessages: { default: t('common.error') },
    onSuccess: () => {
      deleteModalOpen.value = false
      showCallToDelete.value = null
      fetchShowCalls()
    },
  }
)

const confirmDelete = () => {
  if (!showCallToDelete.value) return
  executeDeleteShowCall()
}

// Charger les données au montage
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }

  await fetchShowCalls()
})

useSeoMeta({
  title: () => t('gestion.shows_call.title'),
})
</script>
