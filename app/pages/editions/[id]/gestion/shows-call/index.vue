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

      <div v-else class="space-y-4">
        <UCard
          v-for="showCall in showCalls"
          :key="showCall.id"
          class="hover:shadow-md transition-shadow"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3 mb-2">
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

              <p
                v-if="showCall.description"
                class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3"
              >
                {{ showCall.description }}
              </p>

              <div
                class="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400"
              >
                <div v-if="showCall.deadline" class="flex items-center gap-1">
                  <UIcon name="i-heroicons-calendar" />
                  <span
                    >{{ $t('gestion.shows_call.deadline_label') }}:
                    {{ formatDate(showCall.deadline) }}</span
                  >
                </div>
                <div class="flex items-center gap-1">
                  <UIcon name="i-heroicons-document-text" />
                  <span
                    >{{ showCall.stats?.total || 0 }}
                    {{ $t('gestion.shows_call.applications_count') }}</span
                  >
                </div>
                <div v-if="showCall.stats?.pending" class="flex items-center gap-1">
                  <UBadge color="warning" variant="soft" size="xs">
                    {{ showCall.stats.pending }} {{ $t('gestion.shows_call.pending_short') }}
                  </UBadge>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <UButton
                icon="i-heroicons-document-text"
                variant="soft"
                color="neutral"
                size="sm"
                :to="`/editions/${editionId}/gestion/shows-call/${showCall.id}/applications`"
              >
                {{ $t('gestion.shows_call.applications_title') }}
              </UButton>
              <UButton
                icon="i-heroicons-cog-6-tooth"
                variant="soft"
                color="primary"
                size="sm"
                :to="`/editions/${editionId}/gestion/shows-call/${showCall.id}`"
              >
                {{ $t('common.configure') }}
              </UButton>
              <UDropdownMenu :items="getActionItems(showCall)">
                <UButton
                  icon="i-heroicons-ellipsis-vertical"
                  variant="ghost"
                  color="neutral"
                  size="sm"
                />
              </UDropdownMenu>
            </div>
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
    <UModal v-model:open="deleteModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-exclamation-triangle" class="text-red-500" />
              <h3 class="text-lg font-semibold">
                {{ $t('gestion.shows_call.delete_confirm_title') }}
              </h3>
            </div>
          </template>

          <p class="text-gray-600 dark:text-gray-400">
            {{ $t('gestion.shows_call.delete_confirm_message', { name: showCallToDelete?.name }) }}
          </p>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton variant="ghost" color="neutral" @click="deleteModalOpen = false">
                {{ $t('common.cancel') }}
              </UButton>
              <UButton color="error" :loading="deleting" @click="confirmDelete">
                {{ $t('common.delete') }}
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
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
const creating = ref(false)
const deleting = ref(false)
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

// Actions du dropdown
const getActionItems = (showCall: EditionShowCallWithStats) => [
  [
    {
      label: t('common.configure'),
      icon: 'i-heroicons-cog-6-tooth',
      to: `/editions/${editionId}/gestion/shows-call/${showCall.id}`,
    },
    {
      label: t('gestion.shows_call.applications_title'),
      icon: 'i-heroicons-document-text',
      to: `/editions/${editionId}/gestion/shows-call/${showCall.id}/applications`,
    },
  ],
  [
    {
      label: t('common.delete'),
      icon: 'i-heroicons-trash',
      color: 'error' as const,
      onSelect: () => openDeleteModal(showCall),
    },
  ],
]

// Ouvrir la modal de création
const openCreateModal = () => {
  createForm.value = { name: '', description: '' }
  createErrors.value = {}
  createModalOpen.value = true
}

// Créer un appel
const createShowCall = async () => {
  createErrors.value = {}

  if (!createForm.value.name.trim()) {
    createErrors.value.name = t('common.required')
    return
  }

  creating.value = true
  try {
    await $fetch(`/api/editions/${editionId}/shows-call`, {
      method: 'POST',
      body: {
        name: createForm.value.name.trim(),
        description: createForm.value.description.trim() || null,
      },
    })

    toast.add({
      title: t('common.created'),
      color: 'success',
    })

    createModalOpen.value = false
    await fetchShowCalls()
  } catch (error: any) {
    if (error?.data?.message) {
      toast.add({
        title: error.data.message,
        color: 'error',
      })
    } else {
      toast.add({
        title: t('common.error'),
        color: 'error',
      })
    }
  } finally {
    creating.value = false
  }
}

// Ouvrir la modal de suppression
const openDeleteModal = (showCall: EditionShowCallWithStats) => {
  showCallToDelete.value = showCall
  deleteModalOpen.value = true
}

// Confirmer la suppression
const confirmDelete = async () => {
  if (!showCallToDelete.value) return

  deleting.value = true
  try {
    await $fetch(`/api/editions/${editionId}/shows-call/${showCallToDelete.value.id}`, {
      method: 'DELETE',
    })

    toast.add({
      title: t('common.deleted'),
      color: 'success',
    })

    deleteModalOpen.value = false
    showCallToDelete.value = null
    await fetchShowCalls()
  } catch (error: any) {
    toast.add({
      title: error?.data?.message || t('common.error'),
      color: 'error',
    })
  } finally {
    deleting.value = false
  }
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
