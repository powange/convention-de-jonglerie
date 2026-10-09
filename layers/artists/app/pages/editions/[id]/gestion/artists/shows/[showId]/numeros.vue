<template>
  <div>
    <!-- La garde de sortie, comme sur « nouveau spectacle » et « modifier ». -->
    <UiConfirmationDemandee :confirmation="confirmation" />

    <div v-if="!edition || loadingShow">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!canAccess">
      <UiAccesRefuse />
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
        <ManagementPageHeader :titre="$t('gestion.shows.acts_of', { title: show.title })">
          <p v-if="acts.length > 0" class="text-sm text-gray-500 mt-1">
            {{ $t('gestion.shows.acts_count', { count: acts.length }) }}
          </p>
        </ManagementPageHeader>
      </div>

      <ShowsShowActsEditor
        v-model="acts"
        :artists="artists"
        :validation-demandee="validationDemandee"
      />

      <!-- Barre d'enregistrement collante -->
      <div class="sticky bottom-4 mt-6 flex justify-end">
        <UButton
          icon="i-heroicons-check"
          size="lg"
          :loading="saving"
          class="shadow-lg"
          @click="save"
        >
          {{ $t('common.save') }}
        </UButton>
      </div>
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
const { avertir } = useNotificateur()

const editionId = computed(() => parseInt(route.params.id as string))
const showId = computed(() => parseInt(route.params.showId as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))
const showsPath = computed(() => `/editions/${editionId.value}/gestion/artists/shows`)

const canAccess = computed(() => {
  if (!edition.value || !authStore.user) return false
  return editionStore.canManageArtists(edition.value, authStore.user.id)
})

interface ActInput {
  id?: number
  title: string
  companyName: string
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
    // Renvoyé tel quel à l'enregistrement : c'est lui qui permet au serveur de mettre le numéro
    // à jour plutôt que de le remplacer, et donc de ne pas le faire disparaître sous un artiste
    // en train d'y saisir ses besoins techniques.
    id: act.id,
    title: act.title || '',
    // Vide et non `null` : `UInput` refuse `null`, et l'enregistrement reconvertit.
    companyName: act.companyName ?? '',
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
      if (show.value) {
        acts.value = mapActsFromShow(show.value)
        // L'état de référence de la garde de sortie : ce que porte la base, à cet instant.
        empreinteEnregistree.value = empreinteDuDeroule(acts.value)
      }
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

/**
 * Vrai dès qu'un enregistrement a été TENTÉ : c'est ce qui autorise l'éditeur à marquer en rouge
 * les titres manquants. Avant cela, un numéro qu'on vient d'ajouter n'est pas « en faute ».
 */
const validationDemandee = ref(false)

/**
 * L'empreinte du déroulé au dernier état CONNU DE LA BASE.
 *
 * Posée au chargement et après chaque enregistrement réussi — la page se resynchronise alors
 * depuis la base, donc l'état de référence change aussi.
 */
const empreinteEnregistree = ref('')

const derouleModifie = () => empreinteDuDeroule(acts.value) !== empreinteEnregistree.value

/*
 * ⚠️ LA GARDE DE SORTIE MANQUAIT SUR CETTE SEULE PAGE. « Nouveau spectacle » et « modifier » la
 * posent ; celle du déroulé, non — quitter avec des numéros modifiés ne demandait rien, et le
 * travail partait sans un mot. C'est d'autant plus sensible ici que la saisie d'un cabaret est
 * longue : plusieurs numéros, leurs artistes, leurs besoins techniques.
 */
const { confirmation } = useGardeDeSortie(derouleModifie)

// Enregistre UNIQUEMENT les numéros : le PUT partiel recompose la composition du cabaret
// (numéros + leurs artistes) sans toucher au reste du spectacle (titre, dates, etc.).
const { execute: enregistrer, loading: saving } = useApiAction(
  () => `/api/editions/${editionId.value}/shows/${showId.value}`,
  {
    method: 'PUT',
    body: () => ({
      /*
       * ⚠️ PLUS DE `.filter()` ICI, ET C'EST TOUT L'OBJET DU LOT. Il écartait les numéros sans
       * titre — et comme le serveur REMPLACE l'ensemble du déroulé, les numéros absents du corps
       * étaient SUPPRIMÉS. Un titre effacé par mégarde, ou un numéro renseigné avant d'être nommé,
       * disparaissait pendant que l'écran annonçait « spectacle mis à jour ».
       *
       * Le refus se fait désormais AVANT l'envoi, dans `save` ci-dessous.
       */
      acts: acts.value.map((a) => ({
        id: a.id,
        title: a.title.trim(),
        // ⚠️ Indispensable : la recomposition côté serveur écrit `companyName` à chaque
        // enregistrement. Omettre ce champ ici l'y poserait à `null` — et effacerait, au premier
        // enregistrement, le nom que l'import venait de reprendre de la candidature.
        companyName: a.companyName.trim() || null,
        duration: a.duration ? Number(a.duration) : null,
        description: a.description || null,
        technicalNeeds: a.technicalNeeds || null,
        stageSetup: a.stageSetup || null,
        artistIds: a.artistIds,
      })),
    }),
    successMessage: { title: t('gestion.shows.show_updated') },
    errorMessages: { default: t('gestion.shows.error_update') },
    // On reste sur la page ; on resynchronise depuis la base. `fetchShow` repose l'empreinte,
    // donc la garde de sortie ne réclame plus rien après un enregistrement réussi.
    onSuccess: async () => {
      validationDemandee.value = false
      await fetchShow()
    },
  }
)

/**
 * Refuse l'enregistrement tant qu'un numéro n'est pas nommé, au lieu de le faire disparaître.
 *
 * 📍 Le numéro fautif est DÉPLIÉ et amené à l'écran : sur un cabaret de dix numéros tous repliés,
 * marquer le champ en rouge sans l'ouvrir reviendrait à signaler une erreur invisible.
 */
const save = async () => {
  validationDemandee.value = true
  const fautifs = numerosSansTitre(acts.value)
  if (fautifs.length > 0) {
    avertir(t('gestion.shows.act_title_required'))
    return
  }
  await enregistrer()
}

onMounted(async () => {
  if (!edition.value || edition.value.id !== editionId.value) {
    await editionStore.fetchEditionById(editionId.value)
  }

  /*
   * Les deux appels ne partent que si l'on a le droit de les faire.
   *
   * Ils partaient sans condition, et le serveur répondait deux 403 « Droits insuffisants » que le
   * journal de production enregistrait — avant que la page n'affiche « accès refusé ». Rien ne
   * cassait à l'écran, mais deux requêtes partaient en sachant qu'elles échoueraient.
   *
   * L'édition vient d'être chargée juste au-dessus : `canAccess` est donc connu ici, ce qui n'était
   * pas le cas au montage.
   */
  if (canAccess.value) {
    await Promise.all([fetchShow(), fetchArtists()])
  }
  loadingShow.value = false
})

useSeoMeta({
  title: () =>
    show.value ? t('gestion.shows.acts_of', { title: show.value.title }) : t('gestion.shows.acts'),
})
</script>
