<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary" />
    </div>

    <div v-else-if="!edition">
      <UAlert
        icon="i-lucide-alert-triangle"
        color="error"
        variant="soft"
        :title="$t('edition.not_found')"
      />
    </div>

    <div v-else class="space-y-6">
      <EditionHeader :edition="edition" current-page="program" />

      <!-- Filtres par source, sur le modèle de ceux de la carte : aucune case cochée vaut « tout
           afficher », ce qui évite d'avoir à cocher les trois pour revenir à l'état de départ.
           Masqués quand une seule source est présente : filtrer n'y aurait aucun effet utile. -->
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
        <UCheckboxGroup
          v-if="sourcesPresentes.length > 1"
          v-model="filtresActifs"
          :items="itemsFiltre"
          orientation="horizontal"
          size="md"
        />

        <!-- Ce qui est terminé encombre la lecture au moment où elle sert le plus : sur place, le
             nez sur son téléphone. Proposé seulement s'il y a réellement quelque chose à révéler,
             et sous `ClientOnly` puisque « passé » se juge à l'heure qu'il est. -->
        <ClientOnly>
          <UCheckbox
            v-if="desMomentsPasses"
            v-model="afficherPasses"
            :label="$t('program.show_past')"
            size="md"
          />
        </ClientOnly>
      </div>

      <div v-if="chargementFrise" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary" />
      </div>

      <UAlert
        v-else-if="journees.length === 0"
        icon="i-heroicons-calendar-days"
        color="info"
        variant="soft"
        :title="rienNAPasse ? $t('program.empty') : $t('program.no_result')"
        :description="rienNAPasse ? undefined : $t('program.no_result_hint')"
      />

      <!-- Seul un organisateur peut voir cette page tant qu'elle n'est pas publiée : le lui dire
           évite qu'il la croie déjà visible de tous. -->
      <UAlert
        v-if="donneesFrise?.data && !donneesFrise.data.pagePublique"
        icon="i-lucide-eye-slash"
        color="warning"
        variant="subtle"
        :title="$t('program.not_public_preview')"
      />

      <!-- Les horaires sont ceux de la convention : un visiteur situé dans un autre fuseau doit
           le savoir, sans quoi il lirait ces heures à sa propre montre. Sous `ClientOnly`, car la
           comparaison porte sur le fuseau du lecteur, que le serveur ne connaît pas : rendue des
           deux côtés, elle aurait divergé du HTML envoyé. -->
      <ClientOnly>
        <UAlert
          v-if="fuseauADire"
          icon="i-lucide-clock"
          color="neutral"
          variant="subtle"
          :title="$t('program.local_times', { fuseau: nomFuseau })"
        />
      </ClientOnly>

      <div v-for="journee in journees" :key="journee.date" class="space-y-3">
        <h2 class="text-lg font-semibold capitalize">{{ formaterJour(journee.date) }}</h2>

        <UCard v-for="entree in journee.entrees" :key="entree.cle" :ui="{ body: 'p-4' }">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
            <!-- L'horaire d'abord : c'est ce qu'on cherche quand on parcourt un programme. -->
            <div
              class="shrink-0 font-mono text-sm text-gray-600 sm:w-28 dark:text-gray-400"
              :title="plageHoraireComplete(entree)"
            >
              {{ plageHoraire(entree) }}
            </div>

            <div class="min-w-0 flex-1 space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="font-medium">{{ entree.titre }}</h3>
                <UBadge :color="couleurSource(entree.source)" variant="subtle" size="sm">
                  {{ $t(`program.source.${entree.source}`) }}
                </UBadge>
              </div>

              <p
                v-if="entree.description"
                class="text-sm whitespace-pre-line text-gray-600 dark:text-gray-400"
              >
                {{ entree.description }}
              </p>

              <!-- Un lieu rattaché à la carte y renvoie directement, cadré sur le bon endroit :
                   c'est tout l'intérêt de les avoir liés. Sans carte publique, on n'affiche que
                   le nom, un lien mènerait à une page inaccessible. -->
              <ULink
                v-if="nomDuLieu(entree) && lienCarte(entree)"
                :to="lienCarte(entree)!"
                class="inline-flex items-center gap-1 text-sm text-primary"
              >
                <UIcon name="i-lucide-map-pin" class="h-4 w-4" />
                {{ nomDuLieu(entree) }}
              </ULink>
              <p
                v-else-if="nomDuLieu(entree)"
                class="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400"
              >
                <UIcon name="i-lucide-map-pin" class="h-4 w-4" />
                {{ nomDuLieu(entree) }}
              </p>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEditionStore } from '~/stores/editions'
import { getEditionDisplayName } from '~/utils/editionName'

import {
  abreviationFuseau,
  differeDuFuseauLecteur,
  formaterHeure,
  formaterJournee,
} from '~~/shared/utils/fuseau-edition'
import {
  estTermine,
  grouperParJournee,
  nomDuLieu,
  type EntreeProgramme,
} from '~~/shared/utils/program-timeline'

const route = useRoute()
const { t, locale } = useI18n()
const editionStore = useEditionStore()

const editionId = computed(() => parseInt(route.params.id as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))
const loading = computed(() => editionStore.loading)

const editionName = computed(() => (edition.value ? getEditionDisplayName(edition.value) : ''))
useSeoMeta({
  title: () =>
    edition.value ? `${t('edition.program')} - ${editionName.value}` : t('edition.program'),
  description: () =>
    edition.value
      ? `${t('edition.program')} - ${editionName.value}, ${edition.value.city || ''}`
      : '',
})

/**
 * Même lecture que la page de gestion. Un visiteur n'y voit que le publié : le tri se fait côté
 * serveur, d'après la session, et non ici — un filtrage côté client aurait fait transiter des
 * brouillons jusqu'au navigateur.
 */
const {
  data: donneesFrise,
  pending: chargementFrise,
  error: erreurFrise,
} = await useFetch<{
  data: {
    entrees: EntreeProgramme[]
    carteConsultable: boolean
    fuseau: string | null
    pagePublique: boolean
  }
}>(() => `/api/editions/${editionId.value}/program`, {
  default: () => ({
    data: { entrees: [], carteConsultable: false, fuseau: null, pagePublique: true },
  }),
})

/**
 * Module éteint ou édition inconnue : la page n'existe pas.
 *
 * On s'appuie sur l'erreur de l'API plutôt que sur le drapeau de l'édition : celle-ci n'est
 * chargée qu'après le montage, si bien qu'une vérification côté client laissait le serveur
 * répondre 200 puis annonçait un programme vide — laissant croire qu'il n'y a rien à voir alors
 * que l'édition n'a simplement pas ouvert ce module.
 */
if (erreurFrise.value) {
  throw createError({
    statusCode: erreurFrise.value.statusCode ?? 500,
    statusMessage: erreurFrise.value.statusMessage,
    fatal: true,
  })
}

const entrees = computed(() => donneesFrise.value?.data?.entrees ?? [])

/**
 * Fuseau de la convention : c'est en lui que le programme se lit.
 *
 * Un horaire de programme est une heure de lieu — le gala est à 21 h sur place — et non un instant
 * à retraduire chez chaque lecteur. L'afficher dans le fuseau du visiteur donnerait une heure
 * juste et pourtant inutilisable : personne ne se présente à un spectacle à l'heure de son
 * domicile.
 */
const fuseau = computed(() => donneesFrise.value?.data?.fuseau ?? null)

/**
 * Instant de référence pour décider de ce qui est passé.
 *
 * Une valeur figée plutôt que `new Date()` relu à chaque calcul : les moments disparaîtraient
 * alors un par un au fil des recalculs, sans que rien ne le déclenche à l'écran. Elle avance
 * toutes les minutes, ce qui suffit pour un programme.
 */
const maintenant = ref(new Date())
let horloge: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  // Réaligné au montage : le rendu serveur a figé l'heure du serveur, qui a pu prendre de l'âge
  // dans le temps d'acheminement de la page.
  maintenant.value = new Date()
  horloge = setInterval(() => (maintenant.value = new Date()), 60_000)
})
onBeforeUnmount(() => clearInterval(horloge))

/**
 * Les moments terminés sont masqués par défaut.
 *
 * Un programme se consulte pour savoir où aller ensuite : ce qui est fini n'encombre la lecture
 * qu'au moment où elle est la plus utile, sur place, le nez sur son téléphone. Ils restent
 * accessibles d'une case à cocher, pour retrouver le nom d'un spectacle de la veille.
 */
const afficherPasses = ref(false)

const entreesVisibles = computed(() =>
  afficherPasses.value
    ? entrees.value
    : entrees.value.filter((e) => !estTermine(e, maintenant.value, fuseau.value))
)

/** Vrai s'il y a réellement quelque chose à révéler : proposer une case sans effet égare. */
const desMomentsPasses = computed(() =>
  entrees.value.some((e) => estTermine(e, maintenant.value, fuseau.value))
)

/**
 * Distingue « le programme est vide » de « tout est masqué ».
 *
 * Annoncer un programme non publié à qui vient de décocher une source, ou de laisser passer la
 * dernière soirée, ferait croire que l'organisateur n'a rien saisi.
 */
const rienNAPasse = computed(() => entrees.value.length === 0)

/**
 * Filtres par source.
 *
 * Même convention que les filtres de la carte : une sélection vide signifie « tout afficher ».
 * Sans cette règle, décocher la dernière case viderait la page, et il faudrait recocher les trois
 * pour revenir à l'état initial.
 */
const filtresActifs = ref<EntreeProgramme['source'][]>([])

/** Seules les sources réellement présentes sont proposées : filtrer sur du vide n'aide personne. */
const sourcesPresentes = computed(() => {
  const ordre: EntreeProgramme['source'][] = ['workshop', 'spectacle', 'element']
  const vues = new Set(entreesVisibles.value.map((e) => e.source))
  return ordre.filter((s) => vues.has(s))
})

const iconeSource = (source: EntreeProgramme['source']) =>
  source === 'workshop'
    ? 'i-heroicons-academic-cap'
    : source === 'spectacle'
      ? 'i-heroicons-sparkles'
      : 'i-heroicons-calendar-days'

const itemsFiltre = computed(() =>
  sourcesPresentes.value.map((source) => ({
    label: t(`program.source.${source}`),
    value: source,
    icon: iconeSource(source),
  }))
)

const entreesFiltrees = computed(() =>
  filtresActifs.value.length === 0
    ? entreesVisibles.value
    : entreesVisibles.value.filter((e) => filtresActifs.value.includes(e.source))
)

const journees = computed(() => grouperParJournee(entreesFiltrees.value, fuseau.value))

/**
 * Prévenir seulement quand la pendule du lecteur dira autre chose que la frise.
 *
 * Le dire toujours serait du bruit pour les visiteurs sur place, qui sont la majorité ; ne jamais
 * le dire laisserait un visiteur lointain croire à des heures qu'il n'aura pas.
 */
const fuseauADire = computed(
  () =>
    journees.value.length > 0 &&
    differeDuFuseauLecteur(journees.value[0]!.entrees[0]!.debut, fuseau.value)
)

const nomFuseau = computed(() =>
  journees.value.length > 0
    ? abreviationFuseau(journees.value[0]!.entrees[0]!.debut, fuseau.value, locale.value)
    : ''
)

const couleurSource = (source: EntreeProgramme['source']) =>
  source === 'workshop' ? 'info' : source === 'spectacle' ? 'primary' : 'neutral'

const formatHeure = (iso: string) => formaterHeure(iso, fuseau.value, locale.value)

/** Sans heure de fin, on n'affiche que le début — plutôt qu'un tiret suivi du vide. */
const plageHoraire = (entree: EntreeProgramme) =>
  entree.fin
    ? `${formatHeure(entree.debut)} – ${formatHeure(entree.fin)}`
    : formatHeure(entree.debut)

const plageHoraireComplete = (entree: EntreeProgramme) =>
  entree.fin ? plageHoraire(entree) : t('program.no_end_time')

// Sans l'année : toutes les journées d'une frise appartiennent à la même édition.
const formaterJour = (date: string) =>
  formaterJournee(date, fuseau.value, locale.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

/**
 * Lien vers la carte du site, cadré sur le lieu de l'entrée.
 *
 * Rendu seulement si la carte est réellement consultable : activée et rendue publique. Un lien
 * vers une page qui n'existe pas pour le visiteur serait pire que pas de lien du tout.
 */
const lienCarte = (entree: EntreeProgramme): string | null => {
  if (!donneesFrise.value?.data?.carteConsultable) return null
  if (entree.zone) return `/editions/${editionId.value}/map?focusZone=${entree.zone.id}`
  if (entree.repere) return `/editions/${editionId.value}/map?focusMarker=${entree.repere.id}`
  return null
}

onMounted(async () => {
  if (!edition.value) await editionStore.fetchEditionById(editionId.value)
})
</script>
