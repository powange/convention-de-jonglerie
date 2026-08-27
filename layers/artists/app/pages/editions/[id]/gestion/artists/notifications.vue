<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('edition.not_found') }}</p>
    </div>
    <div v-else-if="!canManage">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="$t('pages.access_denied.description')"
      />
    </div>
    <div v-else>
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-bell" class="text-yellow-600 dark:text-yellow-400" />
          {{ $t('gestion.artists.notifications.title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('gestion.artists.notifications.description') }}
        </p>
      </div>

      <!-- Sans artiste inscrit, le formulaire n'aurait aucun destinataire -->
      <UCard v-if="!chargement && artistesCount === 0">
        <div class="text-center py-12">
          <UIcon name="i-heroicons-users" class="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 class="text-xl font-semibold mb-2">
            {{ $t('gestion.artists.notifications.no_artists_title') }}
          </h2>
          <p class="text-gray-600 dark:text-gray-400">
            {{ $t('gestion.artists.notifications.no_artists_description') }}
          </p>
        </div>
      </UCard>

      <EditionArtistNotificationsPanel v-else :edition-id="editionId" :shows="shows" />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth-protected'],
})

const route = useRoute()
const { t } = useI18n()
const editionStore = useEditionStore()
const authStore = useAuthStore()

const editionId = computed(() => Number(route.params.id))
const edition = computed(() => editionStore.getEditionById(editionId.value))

// Même règle que les autres pages artistes : le droit de gérer les artistes
const canManage = computed(() => {
  if (!edition.value || !authStore.user) return false
  return editionStore.canManageArtists(edition.value, authStore.user.id)
})

const shows = ref<{ id: number; title: string }[]>([])
const artistesCount = ref(0)
const chargement = ref(true)

const charger = async () => {
  chargement.value = true
  try {
    const [listeShows, listeArtistes] = await Promise.all([
      $fetch<{ data: { shows: { id: number; title: string }[] } }>(
        `/api/editions/${editionId.value}/shows`
      ),
      $fetch<{ data: { artists: unknown[] } }>(`/api/editions/${editionId.value}/artists`),
    ])
    shows.value = listeShows.data.shows.map((show) => ({ id: show.id, title: show.title }))
    artistesCount.value = listeArtistes.data.artists.length
  } finally {
    chargement.value = false
  }
}

onMounted(async () => {
  if (!edition.value) await editionStore.fetchEditionById(editionId.value)
  if (canManage.value) await charger()
  else chargement.value = false
})

useSeoMeta({ title: () => t('gestion.artists.notifications.title') })
</script>
