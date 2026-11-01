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

      <div class="flex flex-wrap items-center gap-2 shrink-0">
        <!-- Le nombre de restants vient de l'API, et c'est ce qui rend le bouton honnête : sans
             lui, on ne saurait pas s'il reste du travail — le nombre de lignes affichées est
             filtré, donc sans rapport avec la file réelle. -->
        <UTooltip
          :text="
            restantsAClasser > 0
              ? t('admin.veille.ia.classify_hint', {
                  restants: restantsAClasser,
                  lot: LOT_CLASSEMENT,
                })
              : t('admin.veille.ia.nothing_to_classify')
          "
        >
          <UButton
            color="primary"
            variant="soft"
            icon="i-heroicons-sparkles"
            :loading="classementEnCours"
            :disabled="restantsAClasser === 0"
            @click="classer()"
          >
            {{ t('admin.veille.ia.classify') }}
            <UBadge v-if="restantsAClasser > 0" color="neutral" variant="subtle" size="sm">
              {{ restantsAClasser }}
            </UBadge>
          </UButton>
        </UTooltip>

        <UButton icon="i-heroicons-arrow-path" :loading="rafraichissement" @click="rafraichir()">
          {{ t('admin.veille.refresh') }}
        </UButton>
      </div>
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
            data-filtre="source"
            :items="choixDeSource"
            value-key="value"
            class="w-full"
            @update:model-value="recharger"
          />
        </UFormField>

        <UFormField :label="t('admin.veille.filter.country')" class="flex-1">
          <USelect
            v-model="filtres.pays"
            data-filtre="pays"
            :items="choixDePays"
            value-key="value"
            class="w-full"
            @update:model-value="recharger"
          />
        </UFormField>

        <!-- Le filtre par avis du modèle. C'est lui qui rend un faux négatif RATTRAPABLE : les
             candidats que l'IA écarte restent « à examiner », et cette entrée est le chemin pour
             aller les relire. Sans elle, l'avis masquerait au lieu de trier. -->
        <UFormField :label="t('admin.veille.filter.ai_opinion')" class="flex-1">
          <USelect
            v-model="filtres.avisIa"
            data-filtre="avisIa"
            :items="choixDAvis"
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
          <!-- Désactivé au-delà de la limite, plutôt que d'envoyer « les cinq premiers » : un
               choix arbitraire ferait disparaître le reste sans que rien ne le dise. L'infobulle
               nomme la limite, l'opérateur réduit sa sélection, et rien n'est perdu. -->
          <UTooltip
            :text="
              selection.length > MAX_URLS_IMPORT
                ? t('admin.veille.selection.import_limit', {
                    max: MAX_URLS_IMPORT,
                    count: selection.length,
                  })
                : t('admin.veille.selection.import')
            "
          >
            <UButton
              color="primary"
              variant="soft"
              icon="i-heroicons-arrow-down-tray"
              :disabled="selection.length > MAX_URLS_IMPORT"
              :to="lienImport([...selection])"
            >
              {{ t('admin.veille.selection.import') }}
            </UButton>
          </UTooltip>
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
                  <!-- L'avis du modèle, avec son MOTIF en infobulle. Le motif n'est pas de la
                       décoration : c'est ce qui permet de juger un faux négatif sans rouvrir la
                       page d'origine. Un avis sans motif oblige à tout revérifier, donc annule le
                       gain de la classification. -->
                  <UTooltip v-if="candidat.avisIa" :text="candidat.motifIa || '—'">
                    <UBadge
                      data-avis-ia="true"
                      :color="couleurDeLAvis(candidat.avisIa)"
                      variant="outline"
                      icon="i-heroicons-sparkles"
                      :label="t(`admin.veille.ia.opinion.${candidat.avisIa}`)"
                    />
                  </UTooltip>
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

              <!-- Les quatre actions EN LIGNE.
                   `shrink-0` : sans lui ce bloc se fait comprimer par le texte de gauche et les
                   boutons se chevauchent.
                   `flex-wrap` + `justify-end` : quatre boutons côte à côte tiennent au large, mais
                   pas sur un téléphone étroit — ils passent alors sur deux rangs plutôt que de
                   pousser la ligne au-delà de l'écran. -->
              <div class="flex flex-row flex-wrap justify-end gap-2 shrink-0">
                <!-- `data-importer` : visé par identité dans les tests, comme les autres repères
                     de cet écran. Un lien et non un bouton : la cible est une autre page, donc
                     ouvrable dans un nouvel onglet par un clic du milieu. -->
                <UTooltip :text="t('admin.veille.import_one')">
                  <UButton
                    data-importer="true"
                    color="primary"
                    variant="soft"
                    size="sm"
                    icon="i-heroicons-arrow-down-tray"
                    :aria-label="t('admin.veille.import_one')"
                    :to="lienImport([candidat.url])"
                  />
                </UTooltip>
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

/** L'avis du modèle. Un AVIS, jamais une décision : il ne remplace pas `verdict`. */
type AvisIa = 'CONVENTION' | 'HORS_SUJET' | 'INCERTAIN'

/** Le filtre « tous les avis », et celui des candidats que le modèle n'a pas encore vus. */
const TOUS_AVIS = '*'
const SANS_AVIS = 'AUCUN'

/** Le nombre de candidats qu'un clic soumet au modèle, aligné sur le défaut du point d'API. */
const LOT_CLASSEMENT = 20

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
  /** L'avis du modèle, ou `null` s'il ne l'a pas encore vu. */
  avisIa: AvisIa | null
  avisIaLe: string | null
  motifIa: string | null
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
/**
 * Les comptes par avis, pour le filtre, et `AUCUN` = ce qui reste à soumettre au modèle.
 *
 * 📍 Rendus par l'API et pris sur toute la table, restreints aux candidats encore à examiner :
 * déduits de la liste affichée, ils compteraient ce qu'on a déjà sous les yeux et le « reste à
 * classer » du bouton serait faux.
 */
const comptesAvis = ref<Record<AvisIa | 'AUCUN', number>>({
  CONVENTION: 0,
  HORS_SUJET: 0,
  INCERTAIN: 0,
  AUCUN: 0,
})
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
  // Tous les avis au départ : arriver filtré sur un avis cacherait les candidats que le modèle
  // n'a pas encore vus, qui sont justement ceux qu'il reste à traiter.
  avisIa: TOUS_AVIS as AvisIa | typeof TOUS_AVIS | typeof SANS_AVIS,
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

/**
 * Les entrées du filtre par avis du modèle, avec leur compte.
 *
 * ⚠️ `SANS_AVIS` est une entrée à PART, et non l'absence de filtre : c'est la file de ce qui reste
 * à soumettre, et la confondre avec « tous » rendrait le reste à faire inatteignable.
 *
 * 📍 `HORS_SUJET` est l'entrée qui rend un faux négatif rattrapable. Les candidats que le modèle
 * écarte restent « à examiner » ; c'est par là qu'on va les relire. Sans cette entrée, l'avis
 * masquerait au lieu de trier — et une convention écartée à tort ne serait jamais revue.
 */
const choixDAvis = computed(() => [
  { value: TOUS_AVIS, label: t('admin.veille.filter.all_opinions') },
  {
    value: SANS_AVIS,
    label: `${t('admin.veille.ia.opinion.AUCUN')} (${comptesAvis.value.AUCUN})`,
  },
  {
    value: 'CONVENTION',
    label: `${t('admin.veille.ia.opinion.CONVENTION')} (${comptesAvis.value.CONVENTION})`,
  },
  {
    value: 'INCERTAIN',
    label: `${t('admin.veille.ia.opinion.INCERTAIN')} (${comptesAvis.value.INCERTAIN})`,
  },
  {
    value: 'HORS_SUJET',
    label: `${t('admin.veille.ia.opinion.HORS_SUJET')} (${comptesAvis.value.HORS_SUJET})`,
  },
])

/** Ce qui reste à soumettre au modèle, parmi les candidats encore à examiner. */
const restantsAClasser = computed(() => comptesAvis.value.AUCUN)

function couleurDeLAvis(avis: AvisIa) {
  // Même forme que `couleurDuVerdict` : sans annotation, TypeScript infère l'union de littéraux
  // qu'attend `UBadge`, et la typer `Record<string, string>` casserait le contrôle.
  const couleurs = {
    CONVENTION: 'success',
    HORS_SUJET: 'error',
    // Ni vert ni rouge : c'est précisément l'avis sur lequel un humain doit se pencher.
    INCERTAIN: 'warning',
  } as const
  return couleurs[avis] ?? 'neutral'
}

function nomDeLaSource(cle: string) {
  // Une source retirée du registre laisse des candidats derrière elle : afficher sa clé brute
  // vaut mieux qu'une case vide, qui laisserait croire à une donnée manquante.
  return sources.value.find((source) => source.cle === cle)?.nom ?? cle
}

/**
 * Le plafond d'URL de la page d'import.
 *
 * ⚠️ Ce n'est pas un choix d'affichage : c'est le défaut de `parseAndValidateUrls`
 * (`useUrlValidation.ts`), qui REJETTE tout le lot au-delà. Envoyer six URL ne ferait donc pas
 * importer cinq conventions, mais échouer les six — d'où le bouton désactivé plutôt qu'un envoi
 * tronqué en silence.
 *
 * 📍 Si la limite change là-bas, elle doit changer ici. Un test la verrouille des deux côtés.
 */
const MAX_URLS_IMPORT = 5

/**
 * Le lien vers la page d'import, pré-rempli.
 *
 * Le paramètre est RÉPÉTÉ (`?urls=…&urls=…`) et non joint par un séparateur : c'est la page
 * d'import qui joint par un retour à la ligne, parce que son champ attend une URL par ligne. Un
 * séparateur choisi ici — virgule, point-virgule — produirait une seule URL invalide.
 */
function lienImport(urls: string[]) {
  return { path: '/admin/import-edition', query: { urls } }
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
    // `SANS_AVIS` part tel quel vers l'API, qui l'accepte comme valeur : « pas de filtre » et
    // « filtrer sur l'absence d'avis » sont deux demandes différentes.
    ...(filtres.avisIa !== TOUS_AVIS ? { avisIa: filtres.avisIa } : {}),
    ...(filtres.masquerImportes ? { masquerImportes: 'true' } : {}),
  }),
  errorMessages: { default: t('admin.veille.error.load') },
  /*
   * ⚠️ PAS de `reponse.data.…` ici. `useApiAction` DÉBALLE la réponse avant de la passer :
   * `unwrapApiResponse` reconnaît la forme `{ success: true, data }` que rend
   * `createSuccessResponse`, et ne remet que le contenu de `data`. Lire `reponse.data` donnait
   * donc `undefined`, et l'accès suivant levait — dans le `try` de `useApiAction`, donc le toast
   * affiché était « Impossible de charger les candidats » ALORS QUE L'API AVAIT RÉPONDU.
   */
  onSuccess: (reponse: any) => {
    candidats.value = reponse.candidats
    sources.value = reponse.sources
    paysRencontres.value = reponse.pays
    comptes.value = reponse.comptes
    comptesAvis.value = reponse.comptesAvis
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
      // Déjà déballé par `useApiAction` : voir la note du chargement ci-dessus.
      const bilans: { source: string; lus: number; nouveaux: number; erreur: string | null }[] =
        reponse.bilans
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

const { execute: lancerClassement, loading: classementEnCours } = useApiAction(
  '/api/admin/veille/classer',
  {
    method: 'POST',
    body: () => ({ limite: LOT_CLASSEMENT }),
    silentSuccess: true, // Le compte rendu distingue trois issues, qu'un toast générique perdrait
    errorMessages: { default: t('admin.veille.error.classify') },
    onSuccess: (reponse: any) => {
      // Déjà déballé par `useApiAction` : voir la note du chargement.
      const bilan = reponse.bilan as {
        soumis: number
        classes: number
        illisibles: number
        echecs: number
        premiereErreur: string | null
      }

      /*
       * Trois issues, trois messages, et c'est voulu : « 0 classé » peut vouloir dire qu'il n'y
       * avait rien à faire, que le modèle a répondu hors format, ou qu'il n'a pas répondu du tout.
       * Les confondre enverrait chercher la panne du mauvais côté — ou n'enverrait chercher nulle
       * part, ce qui est pire.
       */
      if (bilan.echecs > 0) {
        toast.add({
          title: t('admin.veille.error.classify_partial', {
            classes: bilan.classes,
            echecs: bilan.echecs,
            erreur: bilan.premiereErreur ?? '',
          }),
          color: 'warning',
        })
      } else if (bilan.illisibles > 0) {
        toast.add({
          title: t('admin.veille.ia.unreadable', {
            classes: bilan.classes,
            illisibles: bilan.illisibles,
          }),
          color: 'warning',
        })
      } else {
        toast.add({
          title: t('admin.veille.ia.classified', { count: bilan.classes }),
          color: 'success',
        })
      }

      // Recharger dans tous les cas : les avis viennent d'être écrits, et les comptes du filtre
      // comme le « reste à classer » du bouton en dépendent.
      charger()
    },
  }
)

function classer() {
  lancerClassement()
}

// Au montage, jamais pendant le `setup` : un appel lancé pendant le `setup` interrompt le rendu
// et laisse une page blanche, sans message.
onMounted(() => {
  charger()
})
</script>
