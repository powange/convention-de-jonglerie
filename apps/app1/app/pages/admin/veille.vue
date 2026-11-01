<template>
  <div>
    <!-- Breadcrumb -->
    <nav class="flex mb-4" :aria-label="$t('navigation.breadcrumb')">
      <ol class="inline-flex items-center space-x-1 md:space-x-3">
        <li class="inline-flex items-center">
          <NuxtLink
            to="/admin"
            class="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white"
          >
            <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4 mr-2" />
            {{ $t('admin.dashboard') }}
          </NuxtLink>
        </li>
        <li>
          <div class="flex items-center">
            <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400" />
            <span class="ml-1 text-sm font-medium text-gray-500 md:ml-2 dark:text-gray-400">{{
              t('admin.veille.title')
            }}</span>
          </div>
        </li>
      </ol>
    </nav>

    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-3xl font-bold flex items-center gap-3">
          <UIcon name="i-heroicons-magnifying-glass-circle" class="text-sky-600" />
          {{ t('admin.veille.title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-2">
          {{ t('admin.veille.description') }}
        </p>
      </div>

      <UButton
        icon="i-heroicons-arrow-path"
        :loading="rafraichissement"
        class="shrink-0"
        @click="rafraichir()"
      >
        {{ t('admin.veille.refresh') }}
      </UButton>
    </div>

    <!-- Les trois verdicts, qui font aussi office d'onglets. Les comptes viennent de l'API et
         portent sur TOUTE la table, pas sur la liste filtrée : un compte filtré par lui-même
         afficherait toujours le nombre de la liste courante. -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <UCard
        v-for="onglet in onglets"
        :key="onglet.verdict"
        :data-onglet="onglet.verdict"
        class="cursor-pointer transition-shadow hover:shadow-lg"
        :class="filtres.verdict === onglet.verdict ? 'ring-2 ring-primary-500' : 'ring-0'"
        @click="choisirOnglet(onglet.verdict)"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ onglet.libelle }}
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ comptes[onglet.verdict] ?? 0 }}
            </p>
          </div>
          <UIcon :name="onglet.icone" class="h-8 w-8" :class="onglet.couleurIcone" />
        </div>
      </UCard>
    </div>

    <!-- Filtres -->
    <UCard class="mb-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end">
        <UFormField :label="t('admin.veille.filter.source')" class="flex-1">
          <USelect
            v-model="filtres.source"
            :items="choixDeSource"
            value-key="value"
            class="w-full"
            @update:model-value="recharger"
          />
        </UFormField>

        <UFormField :label="t('admin.veille.filter.country')" class="flex-1">
          <USelect
            v-model="filtres.pays"
            :items="choixDePays"
            value-key="value"
            class="w-full"
            @update:model-value="recharger"
          />
        </UFormField>

        <!-- Un interrupteur, et non une case à cocher : c'est un état qui bascule, pas une
             sélection dans une liste. -->
        <USwitch
          v-model="filtres.masquerImportes"
          :label="t('admin.veille.filter.hide_imported')"
          class="sm:pb-2"
          @update:model-value="recharger"
        />
      </div>
    </UCard>

    <!-- Barre d'action groupée : n'apparaît qu'avec une sélection, pour ne pas occuper la place
         d'un bouton inactif le reste du temps. -->
    <UCard v-if="selection.length > 0" class="mb-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm font-medium">
          {{ t('admin.veille.selection.count', { count: selection.length }) }}
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            color="success"
            variant="soft"
            icon="i-heroicons-check-circle"
            :loading="verdictEnCours"
            @click="poserSurSelection('CONVENTION')"
          >
            {{ t('admin.veille.verdict.convention') }}
          </UButton>
          <UButton
            color="error"
            variant="soft"
            icon="i-heroicons-x-circle"
            :loading="verdictEnCours"
            @click="poserSurSelection('REFUSE')"
          >
            {{ t('admin.veille.verdict.refuse') }}
          </UButton>
          <UButton color="neutral" variant="outline" @click="selection = []">
            {{ t('admin.veille.selection.clear') }}
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- Liste des candidats -->
    <UCard>
      <div class="divide-y divide-gray-200 dark:divide-gray-700">
        <div v-if="chargement" class="p-8 text-center">
          <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p class="text-gray-500 mt-2">{{ t('common.loading') }}</p>
        </div>

        <div v-else-if="candidats.length === 0" class="p-8 text-center">
          <UIcon name="i-heroicons-inbox" class="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p class="text-gray-500">{{ t('admin.veille.empty') }}</p>
        </div>

        <div v-else>
          <div
            v-for="candidat in candidats"
            :key="candidat.url"
            class="p-4 sm:p-6 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <div class="flex items-start gap-3 sm:gap-4">
              <UCheckbox
                :model-value="selection.includes(candidat.url)"
                class="mt-1 shrink-0"
                :aria-label="candidat.titre"
                @update:model-value="basculerSelection(candidat.url)"
              />

              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2 mb-2">
                  <UBadge
                    :color="couleurDuVerdict(candidat.verdict)"
                    variant="soft"
                    :label="t(`admin.veille.verdict_label.${candidat.verdict}`)"
                  />
                  <!-- `data-deja-importe` : de quoi viser cette pastille par IDENTITÉ et non par
                       position ou par nom d'icône, qui changent sans prévenir. -->
                  <UBadge
                    v-if="candidat.dejaImporte"
                    data-deja-importe="true"
                    color="info"
                    variant="subtle"
                    icon="i-heroicons-check-badge"
                    :label="t('admin.veille.already_imported')"
                  />
                  <UBadge
                    color="neutral"
                    variant="outline"
                    :label="nomDeLaSource(candidat.source)"
                  />
                </div>

                <h3 class="text-lg font-semibold text-gray-900 dark:text-white break-words">
                  {{ candidat.titre }}
                </h3>

                <!-- min-w-0 sur les blocs porteurs de texte, sans quoi `truncate` reste sans
                     effet : un élément flex refuse par défaut de rétrécir sous son contenu. -->
                <div
                  class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400 mt-2"
                >
                  <div v-if="candidat.debut" class="flex items-center gap-1 shrink-0">
                    <UIcon name="i-heroicons-calendar" class="h-4 w-4 shrink-0" />
                    <time>{{ formatDate(candidat.debut, { format: 'medium' }) }}</time>
                    <span v-if="candidat.jours">
                      · {{ t('admin.veille.days', { count: candidat.jours }) }}
                    </span>
                  </div>
                  <div v-if="candidat.pays" class="flex items-center gap-1 shrink-0">
                    <UIcon name="i-heroicons-globe-europe-africa" class="h-4 w-4 shrink-0" />
                    <span>{{ candidat.pays }}</span>
                  </div>
                  <div v-if="candidat.lieu" class="flex items-center gap-1 min-w-0">
                    <UIcon name="i-heroicons-map-pin" class="h-4 w-4 shrink-0" />
                    <span class="truncate">{{ candidat.lieu }}</span>
                  </div>
                  <div class="flex items-center gap-1 min-w-0">
                    <UIcon name="i-heroicons-link" class="h-4 w-4 shrink-0" />
                    <a
                      :href="candidat.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="hover:underline truncate"
                    >
                      {{ t('admin.veille.open_source') }}
                    </a>
                  </div>
                </div>
              </div>

              <!-- shrink-0 : sans lui ce bloc se fait comprimer par le texte de gauche et les
                   boutons se chevauchent. -->
              <div class="flex flex-col gap-2 shrink-0">
                <UTooltip :text="t('admin.veille.verdict.convention')">
                  <UButton
                    color="success"
                    variant="soft"
                    size="sm"
                    icon="i-heroicons-check-circle"
                    :aria-label="t('admin.veille.verdict.convention')"
                    :disabled="candidat.verdict === 'CONVENTION'"
                    @click="poserUn(candidat.url, 'CONVENTION')"
                  />
                </UTooltip>
                <UTooltip :text="t('admin.veille.verdict.refuse')">
                  <UButton
                    color="error"
                    variant="soft"
                    size="sm"
                    icon="i-heroicons-x-circle"
                    :aria-label="t('admin.veille.verdict.refuse')"
                    :disabled="candidat.verdict === 'REFUSE'"
                    @click="poserUn(candidat.url, 'REFUSE')"
                  />
                </UTooltip>
                <UTooltip :text="t('admin.veille.verdict.reset')">
                  <UButton
                    color="neutral"
                    variant="outline"
                    size="sm"
                    icon="i-heroicons-arrow-uturn-left"
                    :aria-label="t('admin.veille.verdict.reset')"
                    :disabled="candidat.verdict === 'A_EXAMINER'"
                    @click="poserUn(candidat.url, 'A_EXAMINER')"
                  />
                </UTooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { formatDate } from '~/utils/date'

definePageMeta({
  middleware: ['auth-protected', 'super-admin'],
})

const { t } = useI18n()
const toast = useToast()

type Verdict = 'A_EXAMINER' | 'CONVENTION' | 'REFUSE'

/**
 * Ce que rend `/api/admin/veille/candidats`. Décrit ici parce que le gabarit lit chaque champ :
 * sans cette forme, les références seraient inférées à `never[]` et la vingtaine d'accès du
 * gabarit passerait sans contrôle — renommer un champ côté serveur ne signalerait rien.
 */
interface CandidatVeille {
  id: number
  source: string
  url: string
  titre: string
  debut: string | null
  jours: number | null
  pays: string | null
  lieu: string | null
  adresse: string | null
  verdict: Verdict
  verdictLe: string | null
  decouvertLe: string
  /** Calculé par l'API à chaque appel, jamais rangé en base. */
  dejaImporte: boolean
}

interface SourceDeclaree {
  cle: string
  nom: string
  urlDeLaListe: string
}

const candidats = ref<CandidatVeille[]>([])
const sources = ref<SourceDeclaree[]>([])
const paysRencontres = ref<string[]>([])
const comptes = ref<Record<Verdict, number>>({ A_EXAMINER: 0, CONVENTION: 0, REFUSE: 0 })
const selection = ref<string[]>([])

/**
 * La valeur de l'entrée « tous » des deux filtres.
 *
 * ⚠️ PAS la chaîne vide. Reka UI, sous `USelect`, la REFUSE comme valeur d'option — elle est
 * réservée à l'effacement de la sélection, qui fait réapparaître le `placeholder` :
 *
 *     A <SelectItem /> must have a value prop that is not an empty string.
 *
 * Et ce n'est pas une broutille de test : l'erreur est levée pendant le `setup` de l'item, donc
 * elle emportait le RENDU de la page. Ni le lint, ni le typage, ni la suite unitaire ne la
 * voyaient — seul le test de page l'a attrapée.
 */
const TOUS = '*'

const filtres = reactive({
  // On arrive sur ce qui demande une décision : c'est le seul onglet où il y a quelque chose à
  // faire, et les deux autres servent à revenir sur un verdict.
  verdict: 'A_EXAMINER' as Verdict,
  source: TOUS,
  pays: TOUS,
  masquerImportes: false,
})

const onglets = computed(() => [
  {
    verdict: 'A_EXAMINER' as Verdict,
    libelle: t('admin.veille.stats.to_review'),
    icone: 'i-heroicons-question-mark-circle',
    couleurIcone: 'text-amber-500',
  },
  {
    verdict: 'CONVENTION' as Verdict,
    libelle: t('admin.veille.stats.retained'),
    icone: 'i-heroicons-check-circle',
    couleurIcone: 'text-green-500',
  },
  {
    verdict: 'REFUSE' as Verdict,
    libelle: t('admin.veille.stats.refused'),
    icone: 'i-heroicons-x-circle',
    couleurIcone: 'text-red-500',
  },
])

const choixDeSource = computed(() => [
  { value: TOUS, label: t('admin.veille.filter.all_sources') },
  ...sources.value.map((source) => ({ value: source.cle, label: source.nom })),
])

const choixDePays = computed(() => [
  { value: TOUS, label: t('admin.veille.filter.all_countries') },
  ...paysRencontres.value.map((pays) => ({ value: pays, label: pays })),
])

function nomDeLaSource(cle: string) {
  // Une source retirée du registre laisse des candidats derrière elle : afficher sa clé brute
  // vaut mieux qu'une case vide, qui laisserait croire à une donnée manquante.
  return sources.value.find((source) => source.cle === cle)?.nom ?? cle
}

function couleurDuVerdict(verdict: Verdict) {
  // Sans annotation, TypeScript infère l'union de littéraux qu'attend `UBadge` : la typer
  // `Record<string, string>` la ramènerait à `string` et casserait le contrôle.
  const couleurs = {
    A_EXAMINER: 'warning',
    CONVENTION: 'success',
    REFUSE: 'neutral',
  } as const
  return couleurs[verdict] ?? 'neutral'
}

const { execute: charger, loading: chargement } = useApiAction('/api/admin/veille/candidats', {
  method: 'GET',
  query: () => ({
    verdict: filtres.verdict,
    // Comparer à `TOUS` et non tester la véracité : la sentinelle est une chaîne non vide, donc
    // vraie — on enverrait `source=*`, que le serveur refuserait en 400 comme source inconnue.
    ...(filtres.source !== TOUS ? { source: filtres.source } : {}),
    ...(filtres.pays !== TOUS ? { pays: filtres.pays } : {}),
    ...(filtres.masquerImportes ? { masquerImportes: 'true' } : {}),
  }),
  errorMessages: { default: t('admin.veille.error.load') },
  onSuccess: (reponse: any) => {
    candidats.value = reponse.data.candidats
    sources.value = reponse.data.sources
    paysRencontres.value = reponse.data.pays
    comptes.value = reponse.data.comptes
    // Une sélection qui survit à un rechargement désignerait des lignes absentes de l'écran, et
    // un verdict groupé porterait alors sur ce que l'opérateur ne voit plus.
    selection.value = []
  },
})

function recharger() {
  charger()
}

function choisirOnglet(verdict: Verdict) {
  if (filtres.verdict === verdict) return
  filtres.verdict = verdict
  charger()
}

function basculerSelection(url: string) {
  const index = selection.value.indexOf(url)
  if (index === -1) selection.value.push(url)
  else selection.value.splice(index, 1)
}

const verdictEnCours = ref(false)

/**
 * Pose un verdict sur une ou plusieurs URL.
 *
 * Le point d'API traite une URL à la fois, et c'est volontaire : il adresse par URL, qui porte
 * l'identité du candidat. Un verdict groupé fait donc N appels — acceptable au volume d'un écran
 * d'administration, et cela évite un second point d'API dont le contrat serait à tenir en plus.
 *
 * ⚠️ `Promise.allSettled` et non `Promise.all` : un échec isolé ne doit pas masquer les verdicts
 * qui sont bel et bien passés. Le compte rendu dit combien ont abouti.
 */
async function poser(urls: string[], verdict: Verdict) {
  if (urls.length === 0) return
  verdictEnCours.value = true
  try {
    const resultats = await Promise.allSettled(
      urls.map((url) =>
        $fetch('/api/admin/veille/verdict', { method: 'POST', body: { url, verdict } })
      )
    )
    const echecs = resultats.filter((resultat) => resultat.status === 'rejected').length
    const reussis = urls.length - echecs

    if (echecs === 0) {
      toast.add({ title: t('admin.veille.success.verdict', { count: reussis }), color: 'success' })
    } else {
      toast.add({
        title: t('admin.veille.error.verdict_partial', { reussis, echecs }),
        color: 'warning',
      })
    }
  } finally {
    verdictEnCours.value = false
    // Rechargement dans tous les cas : après un échec partiel, l'écran doit montrer l'état réel
    // de la base, pas celui qu'on espérait.
    charger()
  }
}

function poserUn(url: string, verdict: Verdict) {
  poser([url], verdict)
}

function poserSurSelection(verdict: Verdict) {
  poser([...selection.value], verdict)
}

const { execute: lancerRafraichissement, loading: rafraichissement } = useApiAction(
  '/api/admin/veille/rafraichir',
  {
    method: 'POST',
    // Même raison qu'au chargement : `TOUS` est une chaîne non vide, donc vraie. Sans cette
    // comparaison, on demanderait à relire la source `*`, que le serveur refuse en 400.
    body: () => (filtres.source !== TOUS ? { source: filtres.source } : {}),
    silentSuccess: true, // Le compte rendu nomme les sources en échec, ce qu'un toast générique perdrait
    errorMessages: { default: t('admin.veille.error.refresh') },
    onSuccess: (reponse: any) => {
      const bilans: { source: string; lus: number; nouveaux: number; erreur: string | null }[] =
        reponse.data.bilans
      const enEchec = bilans.filter((bilan) => bilan.erreur)
      const nouveaux = bilans.reduce((total, bilan) => total + bilan.nouveaux, 0)

      if (enEchec.length > 0) {
        // Nommer la source illisible : « 0 nouveau » sur un agenda injoignable se lit sinon
        // comme « plus aucun événement », ce qui est faux et invisible.
        toast.add({
          title: t('admin.veille.error.refresh_partial', {
            sources: enEchec.map((bilan) => nomDeLaSource(bilan.source)).join(', '),
          }),
          color: 'warning',
        })
      } else {
        toast.add({
          title: t('admin.veille.success.refresh', { count: nouveaux }),
          color: 'success',
        })
      }
      charger()
    },
  }
)

function rafraichir() {
  lancerRafraichissement()
}

// Au montage, jamais pendant le `setup` : un appel lancé pendant le `setup` interrompt le rendu
// et laisse une page blanche, sans message.
onMounted(() => {
  charger()
})
</script>
