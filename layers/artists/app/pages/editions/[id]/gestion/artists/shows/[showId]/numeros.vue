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
    <div v-else-if="show.type !== 'CABARET'">
      <p class="text-red-500">{{ $t('gestion.shows.not_a_cabaret') }}</p>
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
        <h1 class="text-2xl font-bold mt-2">
          {{ $t('gestion.shows.acts_of', { title: show.title }) }}
        </h1>
      </div>

      <UCard>
        <ShowsShowActsEditor v-model="acts" :artists="artists" />
        <template #footer>
          <div class="flex justify-end">
            <UButton icon="i-heroicons-check" :loading="saving" @click="save">
              {{ $t('common.save') }}
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
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

const editionId = computed(() => parseInt(route.params.id as string))
const showId = computed(() => parseInt(route.params.showId as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))
const showsPath = computed(() => `/editions/${editionId.value}/gestion/artists/shows`)

const canAccess = computed(() => {
  if (!edition.value || !authStore.user) return false
  return editionStore.canManageArtists(edition.value, authStore.user.id)
})

interface ActInput {
  title: string
  duration: number | string | null
  description: string | null
  technicalNeeds: string | null
  stageSetup: string | null
  artistIds: number[]
}

const show = ref<any>(null)
const loadingShow = ref(true)
const artists = ref<any[]>([])
const acts = ref<ActInput[]>([])

const mapActsFromShow = (s: any): ActInput[] =>
  (s.acts || []).map((act: any) => ({
    title: act.title || '',
    duration: act.duration ?? null,
    description: act.description ?? null,
    technicalNeeds: act.technicalNeeds ?? null,
    stageSetup: act.stageSetup ?? null,
    artistIds: act.artists?.map((sa: any) => sa.artistId) || [],
  }))

const { execute: fetchShow } = useApiAction(
  () => `/api/editions/${editionId.value}/shows/${showId.value}`,
  {
    method: 'GET',
    silentSuccess: true,
    errorMessages: { default: t('gestion.shows.error_loading') },
    onSuccess: (result: any) => {
      show.value = result?.show ?? null
      if (show.value) acts.value = mapActsFromShow(show.value)
    },
  }
)

const fetchArtists = async () => {
  try {
    const res = await $fetch<{ data?: { artists?: any[] } }>(
      `/api/editions/${editionId.value}/artists`
    )
    artists.value = res.data?.artists || []
  } catch {
    artists.value = []
  }
}

// Enregistre UNIQUEMENT les numéros : le PUT partiel recompose la composition du cabaret
// (numéros + leurs artistes) sans toucher au reste du spectacle (titre, dates, etc.).
const { execute: save, loading: saving } = useApiAction(
  () => `/api/editions/${editionId.value}/shows/${showId.value}`,
  {
    method: 'PUT',
    body: () => ({
      acts: acts.value
        .filter((a) => a.title.trim().length > 0)
        .map((a) => ({
          title: a.title.trim(),
          duration: a.duration ? Number(a.duration) : null,
          description: a.description || null,
          technicalNeeds: a.technicalNeeds || null,
          stageSetup: a.stageSetup || null,
          artistIds: a.artistIds,
        })),
    }),
    successMessage: { title: t('gestion.shows.show_updated') },
    errorMessages: { default: t('gestion.shows.error_update') },
    // On reste sur la page ; on resynchronise depuis la base.
    onSuccess: () => fetchShow(),
  }
)

onMounted(async () => {
  if (!edition.value || edition.value.id !== editionId.value) {
    await editionStore.fetchEditionById(editionId.value)
  }
  await Promise.all([fetchShow(), fetchArtists()])
  loadingShow.value = false
})

useSeoMeta({
  title: () =>
    show.value ? t('gestion.shows.acts_of', { title: show.value.title }) : t('gestion.shows.acts'),
})
</script>
