<template>
  <div>
    <!-- Breadcrumb -->
    <nav class="flex mb-4" :aria-label="$t('navigation.breadcrumb')">
      <ol class="inline-flex items-center space-x-1 md:space-x-3">
        <li class="inline-flex items-center">
          <NuxtLink
            to="/admin"
            class="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white"
          >
            <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4 mr-2" />
            {{ $t('admin.dashboard') }}
          </NuxtLink>
        </li>
        <li>
          <div class="flex items-center">
            <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400" />
            <span class="ml-1 text-sm font-medium text-gray-500 md:ml-2 dark:text-gray-400">
              {{ $t('admin.conventions_management') }}
            </span>
          </div>
        </li>
      </ol>
    </nav>

    <!-- En-tête -->
    <div class="mb-6">
      <h1 class="text-3xl font-bold flex items-center gap-3">
        <UIcon name="i-heroicons-building-library" class="text-purple-600" />
        {{ $t('admin.conventions_management') }}
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mt-2">
        {{ $t('admin.conventions_management_description') }}
      </p>
    </div>

    <!-- Statistiques rapides -->
    <div class="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ $t('admin.total_conventions') }}
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ totalConventions }}
            </p>
          </div>
          <UIcon name="i-heroicons-building-library" class="h-8 w-8 text-purple-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ $t('admin.total_editions') }}
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ totalEditions }}
            </p>
          </div>
          <UIcon name="i-heroicons-calendar-days" class="h-8 w-8 text-blue-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ $t('admin.active_conventions') }}
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ activeConventions }}
            </p>
          </div>
          <UIcon name="i-heroicons-chart-bar-square" class="h-8 w-8 text-green-500" />
        </div>
      </UCard>
    </div>

    <!-- Filtres et recherche -->
    <div class="mb-6 space-y-4">
      <div class="flex flex-col sm:flex-row gap-4">
        <div class="flex-1">
          <UInput
            v-model="searchQuery"
            :placeholder="$t('admin.search_conventions_placeholder')"
            icon="i-heroicons-magnifying-glass"
          />
        </div>
        <USelect v-model="sortBy" :items="sortOptions" class="w-56" />
        <USelect v-model="archivedFilter" :items="archivedFilterOptions" class="w-48" />
      </div>
    </div>

    <!-- Liste des conventions -->
    <div v-if="pending" class="flex justify-center p-8">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin h-6 w-6" />
    </div>

    <div v-else-if="error" class="text-center p-8">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        :title="$t('errors.loading_error')"
        :description="error.data?.message || $t('errors.server_error')"
      />
    </div>

    <div v-else class="space-y-3">
      <UCard
        v-for="convention in sortedConventions"
        :key="convention.id"
        variant="subtle"
        :ui="{ root: 'overflow-hidden hover:shadow-md transition-shadow', body: 'p-0' }"
      >
        <div
          class="px-6 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
          @click="toggleConvention(convention.id)"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4 flex-1 min-w-0">
              <UIcon
                :name="
                  expandedConventions.includes(convention.id)
                    ? 'i-heroicons-chevron-down'
                    : 'i-heroicons-chevron-right'
                "
                class="w-5 h-5 text-gray-400 flex-shrink-0"
              />
              <div v-if="convention.logo" class="w-10 h-10 flex-shrink-0">
                <img
                  :src="getImageUrl(convention.logo, 'convention', convention.id) || ''"
                  :alt="convention.name"
                  class="w-10 h-10 object-cover rounded-lg"
                />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold text-gray-900 dark:text-white truncate">
                    {{ convention.name }}
                  </h3>
                  <UBadge
                    v-if="(convention as any).isArchived"
                    color="warning"
                    variant="soft"
                    size="xs"
                  >
                    {{ $t('common.archived') }}
                  </UBadge>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {{ $t('admin.created_at') }} {{ formatDate(convention.createdAt) }}
                  <span v-if="convention.updatedAt !== convention.createdAt">
                    • {{ $t('admin.updated_at') }} {{ formatDate(convention.updatedAt) }}
                  </span>
                </p>
              </div>
            </div>

            <div class="flex items-center gap-3 ml-4 shrink-0">
              <UBadge color="primary" variant="soft" size="md">
                {{ (convention as any)._count?.editions || 0 }}
                {{ $t('admin.editions').toLowerCase() }}
              </UBadge>
              <UBadge color="neutral" variant="soft" size="md">
                {{ (convention as any)._count?.organizers || 0 }}
                {{ $t('admin.organizers').toLowerCase() }}
              </UBadge>
              <UDropdownMenu
                :items="[
                  [
                    {
                      label: $t('common.edit'),
                      icon: 'i-heroicons-pencil-square',
                      to: `/conventions/${convention.id}/edit`,
                    },
                  ],
                  [
                    ...((convention as any).isArchived
                      ? [
                          {
                            label: $t('admin.unarchive_convention'),
                            icon: 'i-heroicons-arrow-up-tray',
                            color: 'success',
                            onSelect: () =>
                              toggleArchiveConvention(
                                convention.id,
                                (convention as any).isArchived
                              ),
                          },
                        ]
                      : [
                          {
                            label: $t('admin.archive_convention'),
                            icon: 'i-heroicons-archive-box',
                            color: 'warning',
                            onSelect: () =>
                              toggleArchiveConvention(
                                convention.id,
                                (convention as any).isArchived
                              ),
                          },
                        ]),
                    {
                      label: $t('admin.pages.conventions.delete_convention_permanently'),
                      icon: 'i-heroicons-trash',
                      color: 'error',
                      onSelect: () => deleteConventionPermanently(convention as any),
                    },
                  ],
                ]"
                @click.stop
              >
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-heroicons-ellipsis-horizontal"
                  size="xs"
                />
              </UDropdownMenu>
            </div>
          </div>
        </div>

        <!-- Contenu développé -->
        <div v-if="expandedConventions.includes(convention.id)" class="border-t">
          <div class="p-6 bg-gray-50 dark:bg-gray-800/50">
            <div v-if="convention.description" class="mb-4">
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ convention.description }}
              </p>
            </div>

            <!-- Organisateurs -->
            <div v-if="convention.organizers.length > 0" class="mb-4">
              <h5 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
                {{ $t('admin.organizers') }} ({{ convention.organizers.length }})
              </h5>
              <div class="flex flex-wrap gap-3">
                <div
                  v-for="organizer in convention.organizers"
                  :key="organizer.id"
                  class="bg-gray-100 dark:bg-gray-700/50 rounded-lg px-3 py-2"
                >
                  <UiUserDisplayForAdmin
                    :user="organizer.user"
                    size="xs"
                    :border="false"
                    :show-email="false"
                  >
                    <template v-if="organizer.title" #badge>
                      <UBadge color="neutral" variant="subtle" size="xs">
                        {{ organizer.title }}
                      </UBadge>
                    </template>
                  </UiUserDisplayForAdmin>
                </div>
              </div>
            </div>

            <!-- Éditions -->
            <div>
              <h5 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
                {{ $t('admin.editions') }} ({{ convention.editions.length }})
              </h5>
              <div v-if="convention.editions.length === 0" class="text-center py-4 text-gray-500">
                {{ $t('admin.no_editions') }}
              </div>
              <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                <UCard
                  v-for="edition in convention.editions"
                  :key="edition.id"
                  variant="outline"
                  :ui="{
                    root: 'overflow-hidden hover:shadow-sm transition-shadow',
                    body: 'flex gap-0 p-0',
                  }"
                >
                  <div class="flex">
                    <!-- Image de l'édition -->
                    <div v-if="edition.imageUrl" class="w-24 shrink-0 overflow-hidden">
                      <img
                        :src="getImageUrl(edition.imageUrl, 'edition', edition.id) || ''"
                        :alt="edition.name || convention.name"
                        class="w-full h-full object-cover"
                      />
                    </div>

                    <div class="p-3 min-w-0 flex-1">
                      <!-- Nom et statut -->
                      <div class="flex items-center gap-2 flex-wrap mb-2">
                        <h6 class="font-medium truncate">
                          {{ edition.name || convention.name }}
                        </h6>
                        <UBadge
                          :color="getEditionStatusColor(edition.status)"
                          variant="soft"
                          size="sm"
                        >
                          {{ $t(`edition.status.${edition.status?.toLowerCase()}`) }}
                        </UBadge>
                      </div>

                      <!-- Infos -->
                      <div class="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                        <p class="flex items-center gap-1">
                          <UIcon name="i-heroicons-calendar-days" class="w-4 h-4 shrink-0" />
                          {{ formatDateRange(edition.startDate, edition.endDate) }}
                        </p>
                        <p class="flex items-center gap-1">
                          <UIcon name="i-heroicons-map-pin" class="w-4 h-4 shrink-0" />
                          {{ edition.city }},
                          <FlagIcon :code="getCountryCode(edition.country)" />
                          {{ edition.country }}
                        </p>
                      </div>

                      <!-- Compteurs -->
                      <div class="flex items-center gap-2 mt-2">
                        <UBadge color="primary" variant="soft" size="sm">
                          <UIcon name="i-heroicons-hand-raised" class="w-4 h-4" />
                          {{ (edition as any)._count?.volunteerApplications || 0 }}
                        </UBadge>
                        <UBadge color="green" variant="soft" size="sm">
                          <UIcon name="i-heroicons-truck" class="w-4 h-4" />
                          {{ (edition as any)._count?.carpoolOffers || 0 }}
                        </UBadge>
                      </div>

                      <!-- Actions -->
                      <div
                        class="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800"
                      >
                        <UButton
                          :to="`/editions/${edition.id}`"
                          color="neutral"
                          variant="ghost"
                          icon="i-heroicons-eye"
                          size="sm"
                          :title="$t('common.view')"
                        />
                        <UButton
                          :to="`/editions/${edition.id}/gestion`"
                          color="neutral"
                          variant="ghost"
                          icon="i-heroicons-cog-6-tooth"
                          size="sm"
                          :title="$t('common.manage')"
                        />
                        <UDropdownMenu :items="getDropdownItems(edition.id)">
                          <UButton
                            color="neutral"
                            variant="ghost"
                            icon="i-heroicons-ellipsis-horizontal"
                            size="sm"
                          />
                        </UDropdownMenu>
                      </div>
                    </div>
                  </div>
                </UCard>
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <!-- État vide -->
      <div v-if="sortedConventions.length === 0" class="text-center py-12">
        <UIcon name="i-heroicons-building-library" class="mx-auto h-12 w-12 text-gray-400" />
        <h3 class="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
          {{ $t('admin.no_conventions_found') }}
        </h3>
        <p class="mt-1 text-sm text-gray-500">
          {{
            debouncedSearchQuery
              ? $t('admin.no_conventions_search')
              : $t('admin.no_conventions_yet')
          }}
        </p>
      </div>
    </div>

    <!-- Modal d'export JSON -->
    <UModal
      v-model:open="showExportModal"
      :title="$t('admin.export_json_title')"
      :description="$t('admin.export_json_description')"
    >
      <template #body>
        <div class="space-y-4">
          <UAlert
            icon="i-heroicons-information-circle"
            color="info"
            variant="soft"
            :title="$t('admin.export_format_title')"
            :description="$t('admin.export_format_description')"
          />

          <UTextarea
            v-model="exportedJson"
            :rows="15"
            readonly
            class="font-mono w-full"
            :placeholder="$t('admin.loading_placeholder')"
          />
          <UButton
            v-if="exportedJson"
            icon="i-heroicons-clipboard-document"
            color="primary"
            variant="soft"
            @click="copyToClipboard"
          >
            {{ copied ? $t('common.copied') : $t('common.copy') }}
          </UButton>

          <div v-if="exportError" class="mt-4">
            <UAlert icon="i-heroicons-exclamation-triangle" color="error" variant="soft">
              <template #title>{{ $t('admin.export_error') }}</template>
              <template #description>{{ exportError }}</template>
            </UAlert>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Modal de confirmation pour archiver/désarchiver -->
    <UiConfirmModal
      v-model="showArchiveModal"
      :title="t('admin.confirm_action')"
      :description="
        conventionToArchive?.isArchived
          ? t('admin.confirm_unarchive_convention')
          : t('admin.confirm_archive_convention')
      "
      :confirm-label="conventionToArchive?.isArchived ? t('admin.unarchive') : t('admin.archive')"
      :cancel-label="t('common.cancel')"
      confirm-color="warning"
      icon-name="i-heroicons-archive-box"
      icon-color="text-yellow-500"
      @confirm="executeToggleArchive"
      @cancel="showArchiveModal = false"
    />

    <!-- Modal de confirmation pour suppression avec validation par nom -->
    <UiConfirmModal
      v-model="showDeleteModal"
      :title="t('admin.confirm_delete')"
      :description="
        conventionToDelete
          ? t('admin.pages.conventions.confirm_delete_convention_permanently', {
              name: conventionToDelete.name,
              editionsCount: conventionToDelete.editions?.length || 0,
              organizersCount: (conventionToDelete as any)?._count?.organizers || 0,
            })
          : ''
      "
      :confirm-label="t('admin.delete_permanently')"
      :cancel-label="t('common.cancel')"
      confirm-color="error"
      icon-name="i-heroicons-trash"
      icon-color="text-red-600"
      :require-name-confirmation="true"
      :expected-name="conventionToDelete?.name"
      @confirm="executeDeleteConvention"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { useDebounce } from '~/composables/useDebounce'
import type { Convention } from '~/types'

const { t } = useI18n()
const { getImageUrl } = useImageUrl()
const { $fetch } = useNuxtApp()

// Métadonnées de la page
definePageMeta({
  middleware: ['auth-protected', 'super-admin'],
})

// Head
useHead({
  title: computed(() => t('admin.conventions_management')),
})

// État local
const searchQuery = ref('')
const debouncedSearchQuery = useDebounce(searchQuery, 300)
const archivedFilter = ref('all')
const sortBy = ref('name-asc')
const expandedConventions = ref<number[]>([])

// État pour l'export JSON
const showExportModal = ref(false)
const exportedJson = ref('')
const exportError = ref('')
const copied = ref(false)

// Options de filtre
const archivedFilterOptions = computed(() => [
  { label: t('admin.filter_all_conventions'), value: 'all' },
  { label: t('admin.filter_active_conventions'), value: 'active' },
  { label: t('admin.filter_archived_conventions'), value: 'archived' },
])

// Options de tri
const sortOptions = computed(() => [
  { label: t('admin.sort.name_asc'), value: 'name-asc' },
  { label: t('admin.sort.name_desc'), value: 'name-desc' },
  { label: t('admin.sort.created_desc'), value: 'date-desc' },
  { label: t('admin.sort.created_asc'), value: 'date-asc' },
  { label: t('admin.sort.updated_desc'), value: 'updated-desc' },
  { label: t('admin.sort.updated_asc'), value: 'updated-asc' },
  { label: t('admin.sort.editions_desc'), value: 'editions-desc' },
  { label: t('admin.sort.editions_asc'), value: 'editions-asc' },
])

// Récupération des données
const { data, pending, error, refresh } = await useLazyFetch('/api/admin/conventions')

// Données calculées
const totalConventions = computed(() => {
  if (!data.value?.conventions) return 0
  return data.value.conventions.length
})

const totalEditions = computed(() => {
  if (!data.value?.conventions) return 0
  return data.value.conventions.reduce((total, conv) => total + conv.editions.length, 0)
})

const activeConventions = computed(() => {
  if (!data.value?.conventions) return 0
  return data.value.conventions.filter((conv) => !(conv as any).isArchived).length
})

const filteredConventions = computed(() => {
  if (!data.value?.conventions) return []

  let filtered = data.value.conventions

  // Filtre par statut archivé
  if (archivedFilter.value === 'active') {
    filtered = filtered.filter((conv) => !(conv as any).isArchived)
  } else if (archivedFilter.value === 'archived') {
    filtered = filtered.filter((conv) => (conv as any).isArchived)
  }

  // Filtre par recherche (avec debounce)
  if (debouncedSearchQuery.value.trim()) {
    const query = debouncedSearchQuery.value.toLowerCase().trim()
    filtered = filtered.filter((conv) => {
      return (
        conv.name.toLowerCase().includes(query) ||
        conv.description?.toLowerCase().includes(query) ||
        conv.author?.pseudo?.toLowerCase().includes(query) ||
        conv.author?.email?.toLowerCase().includes(query) ||
        conv.editions.some(
          (edition) =>
            edition.name?.toLowerCase().includes(query) ||
            edition.city.toLowerCase().includes(query) ||
            edition.country.toLowerCase().includes(query)
        )
      )
    })
  }

  return filtered
})

// Conventions triées
const sortedConventions = computed(() => {
  const conventions = [...filteredConventions.value]

  switch (sortBy.value) {
    case 'name-asc':
      return conventions.sort((a, b) => a.name.localeCompare(b.name))
    case 'name-desc':
      return conventions.sort((a, b) => b.name.localeCompare(a.name))
    case 'date-desc':
      return conventions.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    case 'date-asc':
      return conventions.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    case 'updated-desc':
      return conventions.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
    case 'updated-asc':
      return conventions.sort(
        (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      )
    case 'editions-desc':
      return conventions.sort(
        (a, b) => ((b as any)._count?.editions || 0) - ((a as any)._count?.editions || 0)
      )
    case 'editions-asc':
      return conventions.sort(
        (a, b) => ((a as any)._count?.editions || 0) - ((b as any)._count?.editions || 0)
      )
    default:
      return conventions
  }
})

// Fonctions utilitaires
const getEditionStatusColor = (status: string) => {
  switch (status) {
    case 'PUBLISHED':
      return 'success'
    case 'PLANNED':
      return 'warning'
    case 'CANCELLED':
      return 'error'
    default:
      return 'neutral'
  }
}

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const formatDateRange = (startDate: string | Date, endDate: string | Date) => {
  const start = new Date(startDate)
  const end = new Date(endDate)

  const startStr = start.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })

  const endStr = end.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return `${startStr} - ${endStr}`
}

// Fonction pour toggler l'accordéon
const toggleConvention = (conventionId: number) => {
  const index = expandedConventions.value.indexOf(conventionId)
  if (index > -1) {
    expandedConventions.value.splice(index, 1)
  } else {
    expandedConventions.value.push(conventionId)
  }
}

// Modals de confirmation
const showArchiveModal = ref(false)
const showDeleteModal = ref(false)
const conventionToArchive = ref<{ id: number; isArchived: boolean } | null>(null)
const conventionToDelete = ref<Convention | null>(null)

// Fonction pour archiver/désarchiver une convention
const toggleArchiveConvention = (conventionId: number, isArchived: boolean) => {
  conventionToArchive.value = { id: conventionId, isArchived }
  showArchiveModal.value = true
}

const executeToggleArchive = async () => {
  if (!conventionToArchive.value) return

  try {
    await ($fetch as any)(`/api/conventions/${conventionToArchive.value.id}/archive`, {
      method: 'PATCH',
      body: { archived: !conventionToArchive.value.isArchived },
    })

    // Rafraîchir les données
    refresh()

    // Message de succès
    const successMessage = !conventionToArchive.value.isArchived
      ? t('admin.convention_archived')
      : t('admin.convention_unarchived')

    useToast().add({
      title: successMessage,
      color: 'success',
    })
  } catch (error) {
    console.error("Erreur lors de l'archivage:", error)
    useToast().add({
      title: t('common.error'),
      description: t('admin.archive_error'),
      color: 'error',
    })
  } finally {
    showArchiveModal.value = false
    conventionToArchive.value = null
  }
}

// Fonction pour supprimer définitivement une convention
const deleteConventionPermanently = (convention: Convention) => {
  conventionToDelete.value = convention
  showDeleteModal.value = true
}

const executeDeleteConvention = async () => {
  if (!conventionToDelete.value) return

  try {
    await ($fetch as any)(`/api/admin/conventions/${conventionToDelete.value.id}`, {
      method: 'DELETE',
    })

    // Rafraîchir les données
    refresh()

    // Message de succès
    useToast().add({
      title: t('admin.pages.conventions.convention_deleted_permanently'),
      color: 'success',
    })
  } catch (error: any) {
    console.error('Erreur lors de la suppression définitive:', error)
    const errorMessage =
      error?.data?.message || t('admin.pages.conventions.error_deleting_convention')

    useToast().add({
      title: t('common.error'),
      description: errorMessage,
      color: 'error',
    })
  } finally {
    showDeleteModal.value = false
    conventionToDelete.value = null
  }
}

// Fonction pour exporter une édition en JSON
const exportEdition = async (editionId: number) => {
  try {
    exportedJson.value = ''
    exportError.value = ''
    copied.value = false

    showExportModal.value = true

    const data = (await $fetch(`/api/admin/editions/${editionId}/export`)) as any

    exportedJson.value = JSON.stringify(data, null, 2)
  } catch (error: any) {
    exportError.value = error?.data?.message || error?.message || t('admin.export_error')
  }
}

// Fonction pour copier dans le presse-papiers
const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(exportedJson.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (error) {
    console.error('Erreur lors de la copie:', error)
    useToast().add({ title: t('admin.copy_error'), color: 'error' })
  }
}

// Fonction pour générer les items du dropdown menu
const getDropdownItems = (editionId: number) => {
  return [
    [
      {
        label: t('common.view'),
        icon: 'i-heroicons-eye',
        to: `/editions/${editionId}`,
      },
      {
        label: t('common.edit'),
        icon: 'i-heroicons-pencil-square',
        to: `/editions/${editionId}/edit`,
      },
      {
        label: t('common.manage'),
        icon: 'i-heroicons-cog-6-tooth',
        to: `/editions/${editionId}/gestion`,
      },
    ],
    [
      {
        label: t('admin.export_json_title'),
        icon: 'i-heroicons-arrow-down-tray',
        onSelect: () => exportEdition(editionId),
      },
    ],
  ]
}
</script>
