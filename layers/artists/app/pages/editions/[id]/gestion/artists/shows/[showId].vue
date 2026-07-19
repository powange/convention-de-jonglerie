<template>
  <div>
    <div v-if="!edition || loadingShow">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!canAccess">
      <p class="text-red-500">{{ $t('errors.access_denied') }}</p>
    </div>
    <div v-else-if="!show">
      <p class="text-red-500">{{ $t('gestion.shows.show_not_found') }}</p>
    </div>

    <template v-else>
      <div class="mb-6">
        <UButton
          icon="i-heroicons-arrow-left"
          color="neutral"
          variant="ghost"
          size="sm"
          :to="showsPath"
        >
          {{ $t('gestion.shows.back_to_shows') }}
        </UButton>
        <h1 class="text-2xl font-bold mt-2">{{ show.title }}</h1>
      </div>

      <ShowsShowForm
        ref="formRef"
        :edition-id="editionId"
        :show="show"
        @saved="goBackToShows"
        @cancel="goBackToShows"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth-protected'],
})

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const editionStore = useEditionStore()
const authStore = useAuthStore()

const editionId = computed(() => parseInt(route.params.id as string))
const showId = computed(() => parseInt(route.params.showId as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))
const showsPath = computed(() => `/editions/${editionId.value}/gestion/artists/shows`)

const canAccess = computed(() => {
  if (!edition.value || !authStore.user) return false
  return editionStore.canManageArtists(edition.value, authStore.user.id)
})

const show = ref<any>(null)
const loadingShow = ref(true)
const formRef = ref<{ isDirty: boolean } | null>(null)

const goBackToShows = () => router.push(showsPath.value)

onBeforeRouteLeave(() => {
  if (!formRef.value?.isDirty) return true
  return confirm(t('gestion.shows.leave_confirm'))
})

// Il n'existe pas d'endpoint unitaire pour un spectacle : on prend celui de la liste,
// qui renvoie déjà la composition complète (artistes et numéros).
const { execute: fetchShow } = useApiAction(() => `/api/editions/${editionId.value}/shows`, {
  method: 'GET',
  silentSuccess: true,
  errorMessages: { default: t('gestion.shows.error_loading') },
  onSuccess: (result: any) => {
    const shows = result?.shows ?? []
    show.value = shows.find((s: any) => s.id === showId.value) ?? null
  },
})

onMounted(async () => {
  if (!edition.value || edition.value.id !== editionId.value) {
    await editionStore.fetchEditionById(editionId.value)
  }
  await fetchShow()
  loadingShow.value = false
})

useSeoMeta({ title: () => show.value?.title || t('gestion.shows.edit_show') })
</script>
