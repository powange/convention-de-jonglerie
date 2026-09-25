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
        <ManagementPageHeader :titre="$t('gestion.shows.add_show')" />
      </div>

      <ShowsShowForm
        ref="formRef"
        :edition-id="editionId"
        @saved="goBackToShows"
        @cancel="goBackToShows"
      />
    </template>

    <!-- Prévient avant de quitter la page avec un formulaire modifié. -->
    <UiConfirmationDemandee :confirmation="confirmation" />
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

/*
 * La demande passe par la modale de l'application, et non plus par `confirm()`.
 *
 * La boîte native ne suit pas la langue choisie, ne se style pas, et certains navigateurs laissent
 * l'utilisateur la désactiver — auquel cas on quittait la page sans que rien ne soit demandé.
 * `useGardeDeSortie` attend la réponse de la modale, ce que `confirm()` obtenait en bloquant.
 */
const { confirmation } = useGardeDeSortie(() => !!formRef.value?.isDirty)

onMounted(async () => {
  if (!edition.value || edition.value.id !== editionId.value) {
    await editionStore.fetchEditionById(editionId.value)
  }
})

useSeoMeta({ title: () => t('gestion.shows.add_show') })
</script>
