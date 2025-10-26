<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('editions.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('editions.not_found') }}</p>
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
      <!-- En-tête avec navigation -->
      <EditionHeader :edition="edition" current-page="gestion" />

      <!-- Titre de la page -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-sparkles" class="text-purple-600 dark:text-purple-400" />
          {{ $t('edition.shows.list_title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('edition.shows.manage_shows_description') }}
        </p>
      </div>

      <!-- Contenu -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">{{ $t('edition.shows.title') }}</h2>
            <UButton
              v-if="canEdit"
              color="primary"
              icon="i-heroicons-plus"
              @click="openAddShowModal"
            >
              {{ $t('edition.shows.add_show') }}
            </UButton>
          </div>
        </template>

        <!-- Statistiques -->
        <div v-if="shows.length > 0" class="mb-4 flex gap-2">
          <UBadge color="neutral" variant="soft">
            {{ $t('common.total') }}: {{ shows.length }}
          </UBadge>
        </div>

        <!-- Liste des spectacles -->
        <div v-if="loading" class="text-center py-8">
          <p class="text-gray-500">{{ $t('common.loading') }}</p>
        </div>

        <div v-else-if="shows.length === 0" class="text-center py-8">
          <UIcon name="i-heroicons-sparkles" class="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p class="text-gray-500">{{ $t('edition.shows.no_shows') }}</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('edition.shows.show_title') }}
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('edition.shows.start_datetime') }}
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('edition.shows.duration') }}
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('edition.shows.location') }}
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('edition.shows.artists') }}
                </th>
                <th
                  v-if="canEdit"
                  class="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="show in sortedShows"
                :key="show.id"
                class="hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <td class="px-4 py-3 text-sm">
                  <div>
                    <div class="font-medium">{{ show.title }}</div>
                    <div
                      v-if="show.description"
                      class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1"
                    >
                      {{ show.description }}
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {{ formatDateTime(show.startDateTime) }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {{ show.duration ? `${show.duration} min` : '-' }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {{ show.location || '-' }}
                </td>
                <td class="px-4 py-3 text-sm">
                  <div v-if="show.artists && show.artists.length > 0" class="flex flex-wrap gap-1">
                    <UBadge
                      v-for="showArtist in show.artists"
                      :key="showArtist.artist.id"
                      color="yellow"
                      variant="subtle"
                      size="sm"
                    >
                      {{ showArtist.artist.user.prenom }} {{ showArtist.artist.user.nom }}
                    </UBadge>
                  </div>
                  <span v-else class="text-gray-400">{{
                    $t('edition.shows.no_artists_selected')
                  }}</span>
                </td>
                <td v-if="canEdit" class="px-4 py-3 text-sm text-right">
                  <div class="flex items-center justify-end gap-2">
                    <UButton
                      icon="i-heroicons-pencil"
                      color="primary"
                      variant="ghost"
                      size="sm"
                      @click="openEditShowModal(show)"
                    />
                    <UButton
                      icon="i-heroicons-trash"
                      color="error"
                      variant="ghost"
                      size="sm"
                      @click="confirmDeleteShow(show)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </div>

    <!-- Modal spectacle -->
    <ShowsShowModal
      v-model="showShowModal"
      :show="selectedShow"
      :edition-id="editionId"
      @show-saved="handleShowSaved"
    />

    <!-- Modal confirmation suppression -->
    <UiConfirmModal
      v-model="showDeleteConfirm"
      :title="$t('edition.shows.delete_show')"
      :message="$t('edition.shows.delete_confirm')"
      confirm-color="error"
      @confirm="deleteShow"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['authenticated'],
})

const route = useRoute()
const { t } = useI18n()
const toast = useToast()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const { formatDateTime } = useDateFormat()

const editionId = computed(() => parseInt(route.params.id as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))

// Permissions
const canAccess = computed(() => {
  if (!edition.value || !authStore.user) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const canEdit = computed(() => {
  if (!edition.value || !authStore.user) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

// Données
const shows = ref<any[]>([])
const loading = ref(false)
const showShowModal = ref(false)
const selectedShow = ref<any>(null)
const showDeleteConfirm = ref(false)
const showToDelete = ref<any>(null)

// Spectacles triés par date
const sortedShows = computed(() => {
  return [...shows.value].sort((a, b) => {
    return new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
  })
})

// Charger l'édition
onMounted(async () => {
  if (!edition.value || edition.value.id !== editionId.value) {
    await editionStore.fetchEditionById(editionId.value)
  }
  await fetchShows()
})

// Récupérer les spectacles
const fetchShows = async () => {
  loading.value = true
  try {
    const response = await $fetch(`/api/editions/${editionId.value}/shows`)
    shows.value = response.shows || []
  } catch (error) {
    console.error('Error fetching shows:', error)
    toast.add({
      title: 'Erreur lors du chargement des spectacles',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

// Ouvrir le modal d'ajout
const openAddShowModal = () => {
  selectedShow.value = null
  showShowModal.value = true
}

// Ouvrir le modal d'édition
const openEditShowModal = (show: any) => {
  selectedShow.value = show
  showShowModal.value = true
}

// Gérer la sauvegarde
const handleShowSaved = () => {
  fetchShows()
}

// Confirmer la suppression
const confirmDeleteShow = (show: any) => {
  showToDelete.value = show
  showDeleteConfirm.value = true
}

// Supprimer le spectacle
const deleteShow = async () => {
  if (!showToDelete.value) return

  try {
    await $fetch(`/api/editions/${editionId.value}/shows/${showToDelete.value.id}`, {
      method: 'DELETE',
    })
    toast.add({
      title: t('edition.shows.show_deleted'),
      color: 'success',
    })
    await fetchShows()
  } catch (error) {
    console.error('Error deleting show:', error)
    toast.add({
      title: t('edition.shows.error_delete'),
      color: 'error',
    })
  } finally {
    showToDelete.value = null
  }
}
</script>
