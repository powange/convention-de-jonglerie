<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('edition.loading_details') }}</p>
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
      <!-- En-tête avec navigation -->

      <!-- Titre de la page -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-sparkles" class="text-purple-600 dark:text-purple-400" />
          {{ $t('gestion.shows.list_title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('gestion.shows.manage_shows_description') }}
        </p>
      </div>

      <!-- Contenu -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">{{ $t('gestion.shows.title') }}</h2>
            <UButton
              v-if="canEdit"
              color="primary"
              icon="i-heroicons-plus"
              @click="openAddShowModal"
            >
              {{ $t('gestion.shows.add_show') }}
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
          <p class="text-gray-500">{{ $t('gestion.shows.no_shows') }}</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('gestion.shows.show_title') }}
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('gestion.shows.start_datetime') }}
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('gestion.shows.duration') }}
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('gestion.shows.location') }}
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('gestion.shows.artists') }}
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('gestion.shows.artists_to_return') }}
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
                  <div class="flex items-center gap-3">
                    <img
                      v-if="show.imageUrl"
                      :src="getShowImageUrl(show)"
                      :alt="show.title"
                      class="w-12 h-12 object-cover rounded-lg shrink-0"
                    />
                    <div>
                      <div class="font-medium">{{ show.title }}</div>
                      <div
                        v-if="show.description"
                        class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1"
                      >
                        {{ show.description }}
                      </div>
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
                  <div>
                    <UBadge
                      v-if="show.zone"
                      :style="{ backgroundColor: show.zone.color + '20', color: show.zone.color }"
                      variant="subtle"
                      size="sm"
                    >
                      <UIcon name="i-heroicons-map" class="mr-1" />
                      {{ show.zone.name }}
                    </UBadge>
                    <UBadge
                      v-else-if="show.marker"
                      :style="{
                        backgroundColor: (show.marker.color || '#6b7280') + '20',
                        color: show.marker.color || '#6b7280',
                      }"
                      variant="subtle"
                      size="sm"
                    >
                      <UIcon name="i-heroicons-map-pin" class="mr-1" />
                      {{ show.marker.name }}
                    </UBadge>
                    <span v-if="show.location" :class="{ 'mt-1 block': show.zone || show.marker }">
                      {{ show.location }}
                    </span>
                    <span v-if="!show.zone && !show.marker && !show.location">-</span>
                  </div>
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
                    $t('gestion.shows.no_artists_selected')
                  }}</span>
                </td>
                <td class="px-4 py-3 text-sm">
                  <div
                    v-if="show.returnableItems && show.returnableItems.length > 0"
                    class="flex flex-wrap gap-1"
                  >
                    <UBadge
                      v-for="item in show.returnableItems"
                      :key="item.returnableItem.id"
                      color="orange"
                      variant="subtle"
                      size="sm"
                    >
                      {{ item.returnableItem.name }}
                    </UBadge>
                  </div>
                  <span v-else class="text-gray-400 text-xs">
                    {{ $t('gestion.shows.no_returnable_items') }}
                  </span>
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
      :title="$t('gestion.shows.delete_show')"
      :message="$t('gestion.shows.delete_confirm')"
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
const editionStore = useEditionStore()
const authStore = useAuthStore()
const { formatDateTime } = useDateFormat()
const { getImageUrl } = useImageUrl()

const getShowImageUrl = (show: any) => {
  return getImageUrl(show.imageUrl, 'show', show.id)
}

const editionId = computed(() => parseInt(route.params.id as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))

// Permissions — page réservée aux organisateurs qui gèrent les artistes
const canAccess = computed(() => {
  if (!edition.value || !authStore.user) return false
  return editionStore.canManageArtists(edition.value, authStore.user.id)
})

const canEdit = computed(() => canAccess.value)

// Données
const shows = ref<any[]>([])
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
const { execute: fetchShows, loading } = useApiAction(
  () => `/api/editions/${editionId.value}/shows`,
  {
    method: 'GET',
    errorMessages: { default: 'Erreur lors du chargement des spectacles' },
    onSuccess: (response: any) => {
      shows.value = response?.shows || []
    },
  }
)

// Ouvrir le modal d'ajout
const openAddShowModal = () => {
  selectedShow.value = null
  showShowModal.value = true
}

// Ouvrir le modal d'édition
const openEditShowModal = (show: any) => {
  selectedShow.value = show
  console.log('Editing show:', show)
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
const { execute: deleteShow, loading: _deletingShow } = useApiAction(
  () => `/api/editions/${editionId.value}/shows/${showToDelete.value?.id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('gestion.shows.show_deleted') },
    errorMessages: { default: t('gestion.shows.error_delete') },
    onSuccess: () => {
      showToDelete.value = null
      fetchShows()
    },
    onError: () => {
      showToDelete.value = null
    },
  }
)
</script>
