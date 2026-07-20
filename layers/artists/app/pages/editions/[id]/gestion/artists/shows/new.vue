<template>
  <div>
    <div v-if="!edition">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!canAccess">
      <p class="text-red-500">{{ $t('errors.access_denied') }}</p>
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
        <h1 class="text-2xl font-bold mt-2">{{ $t('gestion.shows.add_show') }}</h1>
      </div>

      <ShowsShowForm
        ref="formRef"
        :edition-id="editionId"
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
const edition = computed(() => editionStore.getEditionById(editionId.value))
const showsPath = computed(() => `/editions/${editionId.value}/gestion/artists/shows`)

const canAccess = computed(() => {
  if (!edition.value || !authStore.user) return false
  return editionStore.canManageArtists(edition.value, authStore.user.id)
})

const formRef = ref<{ isDirty: boolean } | null>(null)

// Une fois enregistré, plus rien à protéger : le formulaire remet isDirty à false lui-même
const goBackToShows = () => router.push(showsPath.value)

onBeforeRouteLeave(() => {
  if (!formRef.value?.isDirty) return true
  return confirm(t('gestion.shows.leave_confirm'))
})

onMounted(async () => {
  if (!edition.value || edition.value.id !== editionId.value) {
    await editionStore.fetchEditionById(editionId.value)
  }
})

useSeoMeta({ title: () => t('gestion.shows.add_show') })
</script>
