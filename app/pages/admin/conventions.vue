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
            size="sm"
          />
        </div>
        <USelect v-model="archivedFilter" :items="archivedFilterOptions" size="sm" class="w-48" />
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

    <div v-else class="space-y-6">
      <div
        v-for="convention in filteredConventions"
        :key="convention.id"
        class="border rounded-lg overflow-hidden"
      >
        <!-- En-tête de la convention -->
        <div class="bg-gray-50 dark:bg-gray-800 px-6 py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div v-if="convention.logo" class="w-12 h-12">
                <img
                  :src="getImageUrl(convention.logo, 'convention', convention.id) || ''"
                  :alt="convention.name"
                  class="w-12 h-12 object-cover rounded-lg"
                />
              </div>
              <div>
                <h3 class="text-lg font-semibold flex items-center gap-2">
                  {{ convention.name }}
                  <UBadge v-if="convention.isArchived" color="amber" variant="soft" size="xs">
                    {{ $t('common.archived') }}
                  </UBadge>
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('admin.created_by') }} {{ formatAuthorName(convention.author) }} •
                  {{ $t('admin.created_at') }} {{ formatDate(convention.createdAt) }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <UBadge color="primary" variant="soft">
                {{ $t('admin.editions_count', { count: convention._count.editions }) }}
              </UBadge>
              <UBadge color="neutral" variant="soft">
                {{ $t('admin.collaborators_count', { count: convention._count.collaborators }) }}
              </UBadge>
              <UDropdownMenu
                :items="[
                  [
                    {
                      label: $t('common.edit'),
                      icon: 'i-heroicons-pencil-square',
                      to: `/conventions/${convention.id}/edit`,
                    },
                    ...(convention.isArchived
                      ? [
                          {
                            label: $t('admin.unarchive_convention'),
                            icon: 'i-heroicons-arrow-up-tray',
                            color: 'success',
                            click: () =>
                              toggleArchiveConvention(convention.id, convention.isArchived),
                          },
                        ]
                      : [
                          {
                            label: $t('admin.archive_convention'),
                            icon: 'i-heroicons-archive-box',
                            color: 'error',
                            click: () =>
                              toggleArchiveConvention(convention.id, convention.isArchived),
                          },
                        ]),
                  ],
                ]"
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

          <div v-if="convention.description" class="mt-3">
            <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {{ convention.description }}
            </p>
          </div>

          <!-- Liste des collaborateurs -->
          <div v-if="convention.collaborators.length > 0" class="mt-4">
            <h5 class="text-sm font-medium text-gray-900 dark:text-white mb-2">
              {{ $t('admin.collaborators') }} ({{ convention.collaborators.length }})
            </h5>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="collaborator in convention.collaborators"
                :key="collaborator.id"
                class="flex items-center gap-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2"
              >
                <UiUserAvatar :user="collaborator.user" size="xs" />
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {{ formatAuthorName(collaborator.user) }}
                  </div>
                  <div class="flex items-center gap-1 text-xs text-gray-500">
                    <UBadge v-if="collaborator.canEdit" color="blue" variant="soft" size="xs">
                      {{ $t('admin.can_edit') }}
                    </UBadge>
                    <UBadge
                      v-if="collaborator.canManageVolunteers"
                      color="green"
                      variant="soft"
                      size="xs"
                    >
                      {{ $t('admin.can_manage_volunteers') }}
                    </UBadge>
                    <UBadge
                      v-if="collaborator.canManageEditions"
                      color="purple"
                      variant="soft"
                      size="xs"
                    >
                      {{ $t('admin.can_manage_editions') }}
                    </UBadge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Éditions de la convention -->
        <div class="p-6">
          <div v-if="convention.editions.length === 0" class="text-center py-8 text-gray-500">
            {{ $t('admin.no_editions') }}
          </div>

          <div v-else class="space-y-4">
            <h4 class="font-medium text-gray-900 dark:text-white mb-4">
              {{ $t('admin.editions') }} ({{ convention.editions.length }})
            </h4>

            <div class="grid gap-4">
              <div
                v-for="edition in convention.editions"
                :key="edition.id"
                class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div class="flex items-start justify-between">
                  <div class="flex items-start gap-3 flex-1">
                    <div v-if="edition.imageUrl" class="w-16 h-16 flex-shrink-0">
                      <img
                        :src="getImageUrl(edition.imageUrl, 'edition', edition.id) || ''"
                        :alt="edition.name || convention.name"
                        class="w-16 h-16 object-cover rounded-lg"
                      />
                    </div>
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <h5 class="font-medium">
                          {{ edition.name || convention.name }}
                        </h5>
                        <UBadge v-if="edition.isOnline" color="success" variant="soft" size="xs">
                          {{ $t('editions.online_status') }}
                        </UBadge>
                        <UBadge v-else color="neutral" variant="soft" size="xs">
                          {{ $t('editions.offline_edition') }}
                        </UBadge>
                      </div>

                      <div class="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                        <div class="flex items-center gap-4">
                          <span class="flex items-center gap-1">
                            <UIcon name="i-heroicons-calendar-days" class="w-4 h-4" />
                            {{ formatDateRange(edition.startDate, edition.endDate) }}
                          </span>
                          <span class="flex items-center gap-1">
                            <UIcon name="i-heroicons-map-pin" class="w-4 h-4" />
                            {{ edition.city }}, {{ edition.country }}
                          </span>
                        </div>

                        <p class="flex items-center gap-1">
                          <UIcon name="i-heroicons-user" class="w-4 h-4" />
                          {{ $t('admin.created_by') }} {{ formatAuthorName(edition.creator) }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div class="flex flex-col items-end gap-2 ml-4">
                    <div class="flex items-center gap-3">
                      <div class="flex items-center gap-1.5">
                        <UIcon name="i-heroicons-hand-raised" class="w-4 h-4 text-primary-500" />
                        <span class="text-lg font-semibold text-primary-600 dark:text-primary-400">
                          {{ edition._count.volunteerApplications }}
                        </span>
                        <span class="text-sm text-gray-600 dark:text-gray-400">
                          {{
                            $t('admin.volunteers_count', {
                              count: edition._count.volunteerApplications,
                            })
                              .split(' ')
                              .slice(1)
                              .join(' ')
                          }}
                        </span>
                      </div>
                      <div class="flex items-center gap-1.5">
                        <UIcon name="i-heroicons-truck" class="w-4 h-4 text-green-500" />
                        <span class="text-lg font-semibold text-green-600 dark:text-green-400">
                          {{ edition._count.carpoolOffers }}
                        </span>
                        <span class="text-sm text-gray-600 dark:text-gray-400">
                          {{
                            $t('admin.carpool_offers_count', {
                              count: edition._count.carpoolOffers,
                            })
                              .split(' ')
                              .slice(1)
                              .join(' ')
                          }}
                        </span>
                      </div>
                    </div>

                    <UDropdownMenu :items="getDropdownItems(edition.id)">
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
            </div>
          </div>
        </div>
      </div>

      <!-- État vide -->
      <div v-if="filteredConventions.length === 0" class="text-center py-12">
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
      title="Export JSON"
      description="JSON formaté pour l'import d'édition"
    >
      <template #body>
        <div class="space-y-4">
          <UAlert
            icon="i-heroicons-information-circle"
            color="info"
            variant="soft"
            title="Format d'export"
            description="Ce JSON est formaté pour être réimporté via la page d'import d'édition."
          />

          <UTextarea
            v-model="exportedJson"
            :rows="15"
            readonly
            class="font-mono w-full"
            placeholder="Chargement..."
          />
          <UButton
            v-if="exportedJson"
            icon="i-heroicons-clipboard-document"
            color="primary"
            variant="soft"
            @click="copyToClipboard"
          >
            {{ copied ? 'Copié !' : 'Copier' }}
          </UButton>

          <div v-if="exportError" class="mt-4">
            <UAlert icon="i-heroicons-exclamation-triangle" color="error" variant="soft">
              <template #title>Erreur d'export</template>
              <template #description>{{ exportError }}</template>
            </UAlert>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup>
import { useDebounce } from '~/composables/useDebounce'

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
  return data.value.conventions.filter((conv) => !conv.isArchived).length
})

const filteredConventions = computed(() => {
  if (!data.value?.conventions) return []

  let filtered = data.value.conventions

  // Filtre par statut archivé
  if (archivedFilter.value === 'active') {
    filtered = filtered.filter((conv) => !conv.isArchived)
  } else if (archivedFilter.value === 'archived') {
    filtered = filtered.filter((conv) => conv.isArchived)
  }

  // Filtre par recherche (avec debounce)
  if (debouncedSearchQuery.value.trim()) {
    const query = debouncedSearchQuery.value.toLowerCase().trim()
    filtered = filtered.filter((conv) => {
      return (
        conv.name.toLowerCase().includes(query) ||
        conv.description?.toLowerCase().includes(query) ||
        conv.author.pseudo.toLowerCase().includes(query) ||
        conv.author.email.toLowerCase().includes(query) ||
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

// Fonctions utilitaires
const formatAuthorName = (author) => {
  if (!author) {
    return 'Auteur inconnu'
  }
  if (author.prenom && author.nom) {
    return `${author.prenom} ${author.nom} (${author.pseudo})`
  }
  return author.pseudo || 'Utilisateur anonyme'
}

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const formatDateRange = (startDate, endDate) => {
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

// Fonction pour archiver/désarchiver une convention
const toggleArchiveConvention = async (conventionId, isArchived) => {
  try {
    const confirmMessage = isArchived
      ? t('admin.confirm_unarchive_convention')
      : t('admin.confirm_archive_convention')

    if (confirm(confirmMessage)) {
      await $fetch(`/api/conventions/${conventionId}/archive`, {
        method: 'PATCH',
        body: { archived: !isArchived },
      })

      // Rafraîchir les données
      refresh()

      // Message de succès
      const successMessage = !isArchived
        ? t('admin.convention_archived')
        : t('admin.convention_unarchived')

      // Note: Dans une vraie app, on utiliserait un toast/notification
      alert(successMessage)
    }
  } catch (error) {
    console.error("Erreur lors de l'archivage:", error)
    alert("Erreur lors de l'opération")
  }
}

// Fonction pour exporter une édition en JSON
const exportEdition = async (editionId) => {
  console.log('exportEdition appelée avec ID:', editionId)

  try {
    exportedJson.value = ''
    exportError.value = ''
    copied.value = false

    showExportModal.value = true

    const data = await $fetch(`/api/admin/editions/${editionId}/export`)

    exportedJson.value = JSON.stringify(data, null, 2)
  } catch (error) {
    exportError.value =
      error.data?.message || error.message || "Erreur lors de l'export de l'édition"
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
    alert('Erreur lors de la copie dans le presse-papiers')
  }
}

// Fonction pour générer les items du dropdown menu
const getDropdownItems = (editionId) => {
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
        label: 'Exporter JSON',
        icon: 'i-heroicons-arrow-down-tray',
        onSelect: () => exportEdition(editionId),
      },
    ],
  ]
}
</script>
