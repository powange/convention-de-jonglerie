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
          <UIcon name="i-heroicons-star" class="text-yellow-600 dark:text-yellow-400" />
          {{ $t('edition.artists.list_title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('edition.artists.manage_artists_description') }}
        </p>
      </div>

      <!-- Contenu -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">{{ $t('edition.artists.title') }}</h2>
            <UButton
              v-if="canEdit"
              color="primary"
              icon="i-heroicons-plus"
              @click="openAddArtistModal"
            >
              {{ $t('edition.artists.add_artist') }}
            </UButton>
          </div>
        </template>

        <!-- Statistiques -->
        <div v-if="artists.length > 0" class="mb-4 flex gap-2">
          <UBadge color="neutral" variant="soft">
            {{ $t('common.total') }}: {{ artists.length }}
          </UBadge>
        </div>

        <!-- Liste des artistes -->
        <div v-if="loading" class="text-center py-8">
          <p class="text-gray-500">{{ $t('common.loading') }}</p>
        </div>

        <div v-else-if="artists.length === 0" class="text-center py-8">
          <UIcon name="i-heroicons-user-group" class="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p class="text-gray-500">{{ $t('edition.artists.no_artists') }}</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Nom
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Email
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('edition.artists.arrival') }}
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('edition.artists.departure') }}
                </th>
                <th
                  class="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ $t('edition.artists.shows') }}
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
                v-for="artist in artists"
                :key="artist.id"
                class="hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <td class="px-4 py-3 text-sm">
                  <div class="flex items-center gap-2">
                    <UiUserAvatar :user="artist.user" size="sm" />
                    <span class="font-medium">
                      {{ artist.user.prenom }} {{ artist.user.nom }}
                    </span>
                  </div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {{ artist.user.email }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {{ artist.arrivalDateTime || '-' }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {{ artist.departureDateTime || '-' }}
                </td>
                <td class="px-4 py-3 text-sm">
                  <div v-if="artist.shows && artist.shows.length > 0" class="flex flex-wrap gap-1">
                    <UBadge
                      v-for="showArtist in artist.shows"
                      :key="showArtist.show.id"
                      color="purple"
                      variant="subtle"
                      size="sm"
                    >
                      {{ showArtist.show.title }}
                    </UBadge>
                  </div>
                  <span v-else class="text-gray-400">{{ $t('edition.artists.no_shows') }}</span>
                </td>
                <td v-if="canEdit" class="px-4 py-3 text-sm text-right">
                  <div class="flex items-center justify-end gap-2">
                    <UButton
                      icon="i-heroicons-pencil"
                      color="primary"
                      variant="ghost"
                      size="sm"
                      @click="openEditArtistModal(artist)"
                    />
                    <UButton
                      icon="i-heroicons-trash"
                      color="error"
                      variant="ghost"
                      size="sm"
                      @click="confirmDeleteArtist(artist)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </div>

    <!-- Modal artiste -->
    <ArtistsArtistModal
      v-model="showArtistModal"
      :artist="selectedArtist"
      :edition-id="editionId"
      @artist-saved="handleArtistSaved"
    />

    <!-- Modal confirmation suppression -->
    <UiConfirmModal
      v-model="showDeleteConfirm"
      :title="$t('edition.artists.delete_artist')"
      :message="$t('edition.artists.delete_confirm')"
      confirm-color="error"
      @confirm="deleteArtist"
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
const artists = ref<any[]>([])
const loading = ref(false)
const showArtistModal = ref(false)
const selectedArtist = ref<any>(null)
const showDeleteConfirm = ref(false)
const artistToDelete = ref<any>(null)

// Charger l'édition
onMounted(async () => {
  if (!edition.value || edition.value.id !== editionId.value) {
    await editionStore.fetchEditionById(editionId.value)
  }
  await fetchArtists()
})

// Récupérer les artistes
const fetchArtists = async () => {
  loading.value = true
  try {
    const response = await $fetch(`/api/editions/${editionId.value}/artists`)
    artists.value = response.artists || []
  } catch (error) {
    console.error('Error fetching artists:', error)
    toast.add({
      title: 'Erreur lors du chargement des artistes',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

// Ouvrir le modal d'ajout
const openAddArtistModal = () => {
  selectedArtist.value = null
  showArtistModal.value = true
}

// Ouvrir le modal d'édition
const openEditArtistModal = (artist: any) => {
  selectedArtist.value = artist
  showArtistModal.value = true
}

// Gérer la sauvegarde
const handleArtistSaved = () => {
  fetchArtists()
}

// Confirmer la suppression
const confirmDeleteArtist = (artist: any) => {
  artistToDelete.value = artist
  showDeleteConfirm.value = true
}

// Supprimer l'artiste
const deleteArtist = async () => {
  if (!artistToDelete.value) return

  try {
    await $fetch(`/api/editions/${editionId.value}/artists/${artistToDelete.value.id}`, {
      method: 'DELETE',
    })
    toast.add({
      title: t('edition.artists.artist_deleted'),
      color: 'success',
    })
    await fetchArtists()
  } catch (error) {
    console.error('Error deleting artist:', error)
    toast.add({
      title: t('edition.artists.error_delete'),
      color: 'error',
    })
  } finally {
    artistToDelete.value = null
  }
}
</script>
