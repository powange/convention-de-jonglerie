<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('edition.not_found') }}</p>
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

      <!-- Contenu de la page -->
      <div class="space-y-6">
        <!-- Génération informations restauration -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-document-text" class="text-blue-500" />
              <h2 class="text-lg font-semibold">{{ t('edition.volunteers.catering_info') }}</h2>
            </div>
          </template>

          <div class="space-y-4">
            <UAlert
              icon="i-heroicons-information-circle"
              color="info"
              variant="soft"
              description="Générez des documents PDF avec les informations de restauration pour chaque jour de l'événement."
            />

            <!-- Le jour d'abord, les documents ensuite.
                 
                 Un seul bouton produisait un document unique : le résumé ET les listes de tous
                 les services. Or ces pages ne vont pas au même endroit — le résumé en cuisine,
                 chaque liste à son point de distribution. La personne du déjeuner tenait donc
                 une liasse contenant aussi le dîner, et devait tout imprimer ou chercher sa
                 page. Un bouton par document, un fichier par document. -->
            <div class="flex flex-col gap-2">
              <USelect
                v-model="selectedCateringDate"
                :items="cateringDateOptions"
                value-attribute="value"
                option-attribute="label"
                :placeholder="t('edition.volunteers.select_date')"
                :ui="{ content: 'min-w-fit' }"
                class="min-w-[200px]"
              />

              <div v-if="chargementDesRepas" class="flex items-center gap-2 text-sm text-gray-500">
                <UIcon name="i-heroicons-arrow-path" class="animate-spin size-4" />
                {{ t('common.loading') }}
              </div>

              <!-- Rien à proposer pour un jour sans repas : un bouton produirait un document
                   vide, qu'on croirait raté. -->
              <div
                v-else-if="selectedCateringDate && repasDuJour.length > 0"
                class="flex flex-wrap gap-2"
              >
                <UButton
                  color="primary"
                  icon="i-heroicons-document-chart-bar"
                  :loading="pdfEnCours === 'resume'"
                  :disabled="pdfEnCours !== null"
                  @click="genererResumePdf"
                >
                  {{ t('gestion.meals.pdf_summary_button') }}
                </UButton>

                <UButton
                  v-for="repas in repasDuJour"
                  :key="repas.id ?? libelleDuRepas(repas)"
                  color="neutral"
                  variant="outline"
                  icon="i-heroicons-list-bullet"
                  :loading="pdfEnCours === String(repas.id ?? libelleDuRepas(repas))"
                  :disabled="pdfEnCours !== null"
                  @click="genererListePdf(repas)"
                >
                  {{ t('gestion.meals.pdf_list_button', { repas: libelleDuRepas(repas) }) }}
                </UButton>
              </div>

              <p v-else-if="selectedCateringDate" class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('gestion.meals.catering_no_meal') }}
              </p>
            </div>
          </div>
        </UCard>

        <!-- Liste des repas -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="cbi:mealie" class="text-orange-500" />
                <h2 class="text-lg font-semibold">{{ $t('edition.meals.list_title') }}</h2>
              </div>
              <UButton
                icon="i-heroicons-arrow-left"
                color="neutral"
                variant="soft"
                :to="`/editions/${edition.id}/gestion`"
              >
                {{ $t('common.back') }}
              </UButton>
            </div>
          </template>

          <!-- Filtres -->
          <div class="mb-6 space-y-4">
            <!-- Recherche par nom/prénom/email -->
            <UInput
              v-model="searchQuery"
              icon="i-heroicons-magnifying-glass"
              :placeholder="$t('edition.meals.search_placeholder')"
              @input="debouncedSearch"
            />

            <!-- Autres filtres -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <!-- Filtre par phase -->
              <USelect
                v-model="selectedPhase"
                :items="phaseOptions"
                value-key="value"
                :placeholder="$t('edition.meals.filter_phase')"
              />

              <!-- Filtre par type de participant -->
              <USelect
                v-model="selectedType"
                :items="typeOptions"
                value-key="value"
                :placeholder="$t('edition.meals.filter_type')"
              />

              <!-- Filtre par date, AVANT le type de repas : on cherche d'abord un jour, puis le
                   service de ce jour-là. L'ordre inverse faisait choisir « Déjeuner » sans savoir
                   lequel. -->
              <USelect
                v-model="selectedDate"
                :items="dateOptions"
                value-key="value"
                :placeholder="$t('edition.meals.filter_date')"
              />

              <!-- Filtre par type de repas -->
              <USelect
                v-model="selectedMealType"
                :items="mealTypeOptions"
                value-key="value"
                :placeholder="$t('edition.meals.filter_meal_type')"
              />
            </div>
          </div>

          <!-- Statistiques -->
          <div v-if="stats" class="mb-6 space-y-4">
            <!-- Statistiques principales -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <!-- Le total reste NEUTRE : il n'appartient à aucun type, et le vert qu'il
                   portait est précisément celui des bénévoles — on lisait donc « bénévoles » sur
                   la carte qui les additionne tous.

                   `text-gray-900 dark:text-white` plutôt qu'un blanc sec : sur le thème clair,
                   du blanc sur une carte blanche ne s'afficherait pas. C'est la paire qu'emploie
                   déjà la carte « Total » des statistiques d'entrée. -->
              <UCard>
                <div class="text-center">
                  <div class="text-2xl font-bold text-gray-900 dark:text-white">
                    {{ stats.total }}
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('edition.meals.stats.total') }}
                  </div>
                </div>
              </UCard>
              <!-- Les couleurs viennent de `useParticipantTypes`, comme les statistiques
                   d'entrée du contrôle d'accès. Elles étaient posées à la main ici, et TROIS des
                   quatre contredisaient le reste du site : bénévoles en bleu — la couleur de la
                   billetterie —, artistes en violet — celle des organisateurs — et organisateurs
                   en indigo, qui n'appartenait à personne. Un code couleur qui change de sens
                   d'une page à l'autre est pire que pas de couleur du tout. -->
              <UCard v-if="stats.ticketingParticipants > 0">
                <div class="text-center">
                  <div
                    class="text-2xl font-bold"
                    :class="[couleurBillet.textClass, couleurBillet.darkTextClass]"
                  >
                    {{ stats.ticketingParticipants }}
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('edition.meals.stats.participants') }}
                  </div>
                </div>
              </UCard>
              <UCard v-if="stats.volunteers > 0">
                <div class="text-center">
                  <div
                    class="text-2xl font-bold"
                    :class="[couleurBenevole.textClass, couleurBenevole.darkTextClass]"
                  >
                    {{ stats.volunteers }}
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('edition.meals.stats.volunteers') }}
                  </div>
                </div>
              </UCard>
              <UCard v-if="stats.artists > 0">
                <div class="text-center">
                  <div
                    class="text-2xl font-bold"
                    :class="[couleurArtiste.textClass, couleurArtiste.darkTextClass]"
                  >
                    {{ stats.artists }}
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('edition.meals.stats.artists') }}
                  </div>
                </div>
              </UCard>
              <UCard v-if="stats.organizers > 0">
                <div class="text-center">
                  <div
                    class="text-2xl font-bold"
                    :class="[couleurOrganisateur.textClass, couleurOrganisateur.darkTextClass]"
                  >
                    {{ stats.organizers }}
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('edition.meals.stats.organizers') }}
                  </div>
                </div>
              </UCard>
            </div>

            <!-- Statistiques détaillées -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <!-- Par type de repas -->
              <UCard v-if="stats.byMealType">
                <template #header>
                  <div class="text-sm font-medium">
                    {{ $t('edition.meals.stats.by_meal_type') }}
                  </div>
                </template>
                <div class="space-y-2 text-sm">
                  <div v-if="stats.byMealType.BREAKFAST > 0" class="flex justify-between">
                    <span>{{ $t('common.breakfast') }}</span>
                    <span class="font-medium">{{ stats.byMealType.BREAKFAST }}</span>
                  </div>
                  <div v-if="stats.byMealType.LUNCH > 0" class="flex justify-between">
                    <span>{{ $t('common.lunch') }}</span>
                    <span class="font-medium">{{ stats.byMealType.LUNCH }}</span>
                  </div>
                  <div v-if="stats.byMealType.DINNER > 0" class="flex justify-between">
                    <span>{{ $t('common.dinner') }}</span>
                    <span class="font-medium">{{ stats.byMealType.DINNER }}</span>
                  </div>
                </div>
              </UCard>

              <!-- Par régime alimentaire -->
              <UCard v-if="stats.byDiet">
                <template #header>
                  <div class="text-sm font-medium">{{ $t('edition.meals.stats.by_diet') }}</div>
                </template>
                <div class="space-y-2 text-sm">
                  <div v-if="stats.byDiet.standard > 0" class="flex justify-between">
                    <span>{{ $t('edition.meals.stats.standard') }}</span>
                    <span class="font-medium">{{ stats.byDiet.standard }}</span>
                  </div>
                  <div v-if="stats.byDiet.VEGETARIAN > 0" class="flex justify-between">
                    <span>{{ $t('common.vegetarian') }}</span>
                    <span class="font-medium">{{ stats.byDiet.VEGETARIAN }}</span>
                  </div>
                  <div v-if="stats.byDiet.VEGAN > 0" class="flex justify-between">
                    <span>{{ $t('common.vegan') }}</span>
                    <span class="font-medium">{{ stats.byDiet.VEGAN }}</span>
                  </div>
                </div>
              </UCard>

              <!-- Allergies -->
              <UCard v-if="stats.withAllergies > 0">
                <div class="text-center">
                  <div class="text-2xl font-bold text-orange-500">{{ stats.withAllergies }}</div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('edition.meals.stats.with_allergies') }}
                  </div>
                </div>
              </UCard>

              <!-- Après spectacle -->
              <UCard v-if="stats.afterShow > 0">
                <div class="text-center">
                  <div class="text-2xl font-bold text-green-500">{{ stats.afterShow }}</div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('edition.meals.stats.after_show') }}
                  </div>
                </div>
              </UCard>
            </div>
          </div>

          <!-- Tableau -->
          <div v-if="loading" class="flex items-center justify-center py-8">
            <UIcon name="i-heroicons-arrow-path" class="animate-spin h-6 w-6 text-primary-500" />
          </div>

          <div v-else-if="formattedParticipants.length === 0" class="text-center py-8">
            <p class="text-gray-500 dark:text-gray-400">
              {{ $t('edition.meals.no_participants') }}
            </p>
          </div>

          <template v-else>
            <!-- La barre appartient à CE tableau. Le bouton de la carte du dessus, lui, ne
                 produit pas un export mais la feuille de service d'une journée : c'est une
                 fonctionnalité à part, et les accoler laisserait croire que décocher une colonne
                 la change. -->
            <div class="mb-2 flex items-center justify-end gap-2">
              <UBadge color="neutral" variant="soft">
                {{ $t('common.total') }}: {{ pagination.total }}
              </UBadge>

              <UiColumnsMenu
                :table-api="tableParticipants?.tableApi"
                :libelle="libelleColonneParticipant"
              />

              <UiExportMenu
                :on-csv="() => exporterParticipants('csv')"
                :on-pdf="() => exporterParticipants('pdf')"
              />
            </div>

            <UTable
              ref="tableParticipants"
              v-model:column-visibility="colonnesVisibles"
              :data="formattedParticipants"
              :columns="columns"
              class="w-full"
            />
          </template>

          <!-- Pagination -->
          <div v-if="pagination.totalPages > 1" class="flex justify-center mt-6">
            <UPagination
              :default-page="pagination.page"
              :total="pagination.total"
              :items-per-page="pagination.pageSize"
              @update:page="onPageChange"
            />
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { exporterTableauEnPdf } from '~/utils/export-pdf-tableau'
import {
  dessinerCaseACocher,
  LARGEUR_COLONNE_COCHE,
  styleColonneCoche,
} from '~/utils/pdf-case-a-cocher'
import { telechargerFichier } from '~/utils/telechargement'

// Import explicite : plusieurs layers exportent un `filtresDepuisUrl`, et l'auto-import ne
// saurait pas lequel prendre.
import {
  dateConnue,
  filtresDepuisUrl,
  requeteListeDeRepas,
} from '../../../../../utils/filtres-liste-repas'
import {
  couleurDuType,
  cleLibelleDePopulation,
  colonnesDePopulation,
  colonnesDeRegime,
  lignesDeParticipants,
  nombrePourCle,
  motLePlusLong,
  nomFichierRestauration,
  resumerRepas,
} from '../../../../../utils/restauration-pdf'

import { nomDeFichierCsv, versCsv } from '~~/shared/utils/csv'

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const { t } = useI18n()
// Les dates passent par le composable : il force Europe/Paris et suit la langue choisie. Formatées
// à la main, elles reculaient d'un jour pour qui lit depuis l'ouest — un repas est stocké à minuit
// UTC, et « samedi 15 » devenait « vendredi 14 » à New York.
const { formatDateFull, formatDateWeekdayMonth, formatDateWeekdayMonthShort } = useDateFormat()
const toast = useToast()

const editionId = computed(() => parseInt(route.params.id as string))

// Utiliser le composable pour les paramètres des bénévoles
const {
  settings: volunteersInfo,
  error: volunteersInfoError,
  fetchSettings: fetchVolunteersInfo,
} = useVolunteerSettings(editionId.value)

const edition = computed(() => editionStore.getEditionById(editionId.value))

const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  // Droit « gérer les repas » (édition ou convention) uniquement.
  return editionStore.canManageMeals(edition.value, authStore.user.id)
})

// Filtres conservés dans l'URL — cf. `filtres-liste-repas.ts` pour la règle.
const router = useRouter()
const filtresInitiaux = filtresDepuisUrl(route.query)

// État
const loading = ref(false)
const participants = ref<any[]>([])
const pagination = ref({
  page: filtresInitiaux.page,
  pageSize: 20,
  total: 0,
  totalPages: 0,
})

const searchQuery = ref(filtresInitiaux.recherche)
const selectedPhase = ref(filtresInitiaux.phase)
const selectedType = ref(filtresInitiaux.typeDePersonne)
const selectedMealType = ref(filtresInitiaux.typeDeRepas)
const selectedDate = ref(filtresInitiaux.date)
const availableDates = ref<string[]>([])

// Variables pour la génération des PDFs de restauration
const selectedCateringDate = ref<string | undefined>(undefined)

// Options de filtres
const phaseOptions = computed(() => [
  { value: 'all', label: t('edition.meals.all_phases') },
  { value: 'SETUP', label: t('common.setup') },
  { value: 'EVENT', label: t('common.event') },
  { value: 'TEARDOWN', label: t('common.teardown') },
])

const typeOptions = computed(() => [
  { value: 'all', label: t('edition.meals.all_types') },
  { value: 'participant', label: t('common.participant') },
  { value: 'volunteer', label: t('common.volunteer') },
  { value: 'artist', label: t('common.artist') },
  { value: 'organizer', label: t('common.organizer') },
])

const mealTypeOptions = computed(() => [
  { value: 'all', label: t('edition.meals.all_meal_types') },
  { value: 'BREAKFAST', label: t('common.breakfast') },
  { value: 'LUNCH', label: t('common.lunch') },
  { value: 'DINNER', label: t('common.dinner') },
])

const dateOptions = computed(() => [
  { value: 'all', label: t('edition.meals.all_dates') },
  ...availableDates.value.map((date) => ({
    value: date,
    label: formatDateWeekdayMonth(date),
  })),
])

// Colonnes du tableau
/**
 * Les couleurs par type, servies par le composable partagé.
 *
 * Résolues une fois plutôt qu'appelées dans le gabarit : les quatre cartes sont conditionnelles,
 * et un appel par carte se relirait à quatre endroits pour vérifier qu'ils disent la même chose.
 */
const { getParticipantTypeConfig } = useParticipantTypes()
const couleurBillet = getParticipantTypeConfig('ticket')
const couleurBenevole = getParticipantTypeConfig('volunteer')
const couleurArtiste = getParticipantTypeConfig('artist')
const couleurOrganisateur = getParticipantTypeConfig('organizer')

const tableParticipants = ref<{ tableApi?: unknown } | null>(null)

/**
 * Aucune colonne masquée au départ.
 *
 * Neuf colonnes tiennent encore à l'écran, et chacune répond à une question du service : qui,
 * quel repas, quel régime. Ce menu sert à en RETIRER quand on prépare une impression ou qu'on
 * travaille sur un portable, pas à réparer un tableau illisible d'emblée.
 */
/** Le nom lisible d'une colonne, pour le menu qui les propose. */
const libelleColonneParticipant = (id: string): string => {
  const libelles: Record<string, string> = {
    nom: t('common.name'),
    prenom: t('common.first_name'),
    email: t('common.email'),
    type: t('common.type'),
    mealDate: t('common.date'),
    mealType: t('gestion.meals.meal_type'),
    mealPhase: t('gestion.meals.phase'),
    dietaryPreference: t('gestion.meals.diet'),
    afterShow: t('gestion.meals.after_show'),
  }
  return libelles[id] ?? id
}

const columns = [
  // Sans le nom, une ligne ne désigne plus personne.
  { accessorKey: 'nom', header: t('common.name'), enableHiding: false },
  { accessorKey: 'prenom', header: t('common.first_name') },
  { accessorKey: 'email', header: t('common.email') },
  { accessorKey: 'type', header: t('common.type') },
  { accessorKey: 'mealDate', header: t('common.date') },
  { accessorKey: 'mealType', header: t('gestion.meals.meal_type') },
  { accessorKey: 'mealPhase', header: t('gestion.meals.phase') },
  { accessorKey: 'dietaryPreference', header: t('gestion.meals.diet') },
  { accessorKey: 'afterShow', header: t('gestion.meals.after_show') },
]

/** Les colonnes que le lecteur a le droit de masquer — l'URL ne peut pas en cacher d'autres. */
const colonnesMasquables = (columns as { accessorKey?: string; enableHiding?: boolean }[])
  .filter((c) => c.enableHiding !== false)
  .map((c) => c.accessorKey as string)
  .filter(Boolean)

/*
 * Le choix des colonnes survit au rechargement, et se partage par le lien.
 *
 * L'URL ne porte que l'ÉCART à l'état d'arrivée : rien tant qu'on n'a rien réglé.
 */
const { visibilite: colonnesVisibles } = useColonnesDansUrl(colonnesMasquables)

// Utiliser les utilitaires meals
const { getMealTypeLabel } = useMealTypeLabel()
const { getPhasesLabel } = useMealPhaseLabel()

// Labels pour les régimes alimentaires
const dietLabels: Record<string, string> = {
  VEGETARIAN: t('common.vegetarian'),
  VEGAN: t('common.vegan'),
}

const getDietLabel = (diet: string) => dietLabels[diet] || diet

/** Ce que porte la colonne « Régime » : rien à signaler devient un tiret, pas `NONE`. */
const regimeAAfficher = (regime: string | null) =>
  regime && regime !== 'NONE' ? getDietLabel(regime) : '-'

// Formatage de date, en abrégé : la colonne est étroite.
const formatDate = formatDateWeekdayMonthShort

// Données formatées pour le tableau
/**
 * Un participant, mis en forme pour le tableau.
 *
 * Fonction et non boucle dans le `computed` : l'export doit produire EXACTEMENT les mêmes
 * cellules que l'écran, sur une autre liste — celle de toutes les pages et non de la page
 * affichée. Recopier la mise en forme serait la première occasion de les faire diverger.
 */
const formaterParticipant = (p: any) => {
  let typeLabel = ''
  if (p.type === 'volunteer') typeLabel = t('common.volunteer')
  else if (p.type === 'artist') typeLabel = t('common.artist')
  else if (p.type === 'participant') typeLabel = t('common.participant')
  else if (p.type === 'organizer') typeLabel = t('common.organizer')

  return {
    nom: p.nom,
    prenom: p.prenom,
    email: p.email,
    type: typeLabel,
    mealDate: formatDate(p.mealDate),
    mealType: getMealTypeLabel(p.mealType),
    mealPhase: getPhasesLabel(p.mealPhases),
    // `'NONE'` n'est pas un régime à nommer : la colonne reste vide, comme pour qui n'a rien
    // déclaré. Sans ça, elle affichait le mot brut aux organisateurs et aux artistes.
    dietaryPreference: regimeAAfficher(p.dietaryPreference),
    // Plus de restriction aux artistes : bénévoles et organisateurs peuvent déclarer un repas
    // d'après spectacle. La carte de statistiques, elle, les comptait déjà — le tableau affichait
    // « - » là où elle annonçait un de plus, et c'est la carte qu'on accusait d'être fausse.
    afterShow: p.afterShow ? '✓' : '-',
  }
}

const formattedParticipants = computed(() => participants.value.map(formaterParticipant))

/**
 * Toutes les lignes que les filtres laissent passer, et non la page affichée.
 *
 * Le tableau est paginé côté serveur : exporter `formattedParticipants` ne donnerait que les
 * vingt lignes sous les yeux. Personne ne s'en apercevrait tout de suite — le fichier a l'air
 * complet — et l'on compterait les repas sur un cinquième des convives.
 *
 * On redemande donc la liste entière, avec les mêmes filtres et un plafond fixé sur le total que
 * la pagination annonce.
 */
const toutesLesLignes = async () => {
  const reponse: any = await $fetch(`/api/editions/${editionId.value}/meals/participants`, {
    params: {
      ...parametresDesFiltres(),
      page: '1',
      pageSize: String(Math.max(pagination.value.total, 1)),
    },
  })
  return (reponse?.data ?? []).map(formaterParticipant)
}

/**
 * Les colonnes retenues pour un export : celles qui sont AFFICHÉES.
 *
 * Même source pour les deux formats — la table elle-même — sans quoi décocher une colonne
 * l'aurait retirée d'un fichier et pas de l'autre.
 */
const colonnesAExporter = () => {
  const visibles: string[] = (
    tableParticipants.value?.tableApi?.getVisibleLeafColumns?.() ?? []
  ).map((colonne: any) => colonne.id)
  const retenues =
    visibles.length > 0 ? visibles : columns.map((colonne: any) => colonne.accessorKey)
  return retenues.map((id: string) => ({ id, entete: libelleColonneParticipant(id) }))
}

/** La liste des repas, en fichier tableur ou en feuille à cocher. */
const exporterParticipants = async (format: 'csv' | 'pdf') => {
  const colonnes = colonnesAExporter()
  const lignes = (await toutesLesLignes()).map((participant: any) =>
    colonnes.map((colonne) => participant[colonne.id] ?? '')
  )

  if (lignes.length === 0) return

  const nomDeBase = `repas-edition-${editionId.value}`

  if (format === 'csv') {
    telechargerFichier(
      nomDeFichierCsv(nomDeBase),
      versCsv(
        colonnes.map((colonne) => colonne.entete),
        lignes
      ),
      'text/csv;charset=utf-8'
    )
  } else {
    await exporterTableauEnPdf({
      titre: t('edition.meals.list_title'),
      sousTitre: [edition.value?.convention?.name, edition.value?.name].filter(Boolean).join(' - '),
      mention: `${formatDate(new Date().toISOString())} — ${t('gestion.meals.export_count', {
        count: lignes.length,
      })}`,
      entetes: colonnes.map((colonne) => colonne.entete),
      lignes,
      nomFichier: nomDeBase,
    })
  }

  toast.add({ title: t('common.export_success'), color: 'success' })
}

// Statistiques (reçues de l'API)
const stats = ref<{
  total: number
  volunteers: number
  artists: number
  ticketingParticipants: number
  organizers: number
  byMealType: {
    BREAKFAST: number
    LUNCH: number
    DINNER: number
  }
  byDiet: {
    VEGETARIAN: number
    VEGAN: number
    standard: number
  }
  withAllergies: number
  afterShow: number
} | null>(null)

// Recherche avec debounce
const debouncedSearch = useDebounceFn(() => {
  pagination.value.page = 1
  fetchParticipants()
}, 300)

// Gestion du changement de page
const onPageChange = (page: number) => {
  pagination.value.page = page
  fetchParticipants()
}

// Charger les données
/**
 * Les filtres posés, en paramètres de requête.
 *
 * Partagés entre l'affichage et l'export : ce qu'on exporte est ce qu'on voit, et le seul moyen
 * d'en être sûr est de ne les écrire qu'une fois.
 */
const parametresDesFiltres = (): Record<string, string> => {
  const params: Record<string, string> = {}

  if (searchQuery.value.trim()) params.search = searchQuery.value.trim()
  if (selectedPhase.value && selectedPhase.value !== 'all') params.phase = selectedPhase.value
  if (selectedType.value && selectedType.value !== 'all') params.type = selectedType.value
  if (selectedMealType.value && selectedMealType.value !== 'all') {
    params.mealType = selectedMealType.value
  }
  if (selectedDate.value && selectedDate.value !== 'all') params.date = selectedDate.value

  return params
}

const fetchParticipants = async () => {
  loading.value = true
  try {
    const params: Record<string, string> = {
      ...parametresDesFiltres(),
      page: pagination.value.page.toString(),
      pageSize: pagination.value.pageSize.toString(),
    }

    const response = await $fetch(`/api/editions/${editionId.value}/meals/participants`, {
      params,
    })

    if (response.success) {
      participants.value = response.data || []
      // Mapper les propriétés de pagination (API: limit/totalCount -> Frontend: pageSize/total)
      pagination.value.page = response.pagination.page
      pagination.value.pageSize = response.pagination.limit
      pagination.value.total = response.pagination.totalCount
      pagination.value.totalPages = response.pagination.totalPages
      availableDates.value = response.availableDates || []
      // Une date venue de l'URL mais absente de cette édition — lien gardé d'une édition
      // précédente, jour retiré depuis — donnerait un tableau vide sans cause visible, le
      // sélecteur ne pouvant même pas afficher la valeur qui filtre. On ne peut trancher qu'ici :
      // les jours de l'édition n'arrivent qu'avec cette réponse.
      selectedDate.value = dateConnue(selectedDate.value, availableDates.value)
      stats.value = response.stats || null
    }
  } catch (error: any) {
    console.error('Failed to fetch participants:', error)
    participants.value = []
  } finally {
    loading.value = false
  }
}

// Options pour le select de génération des informations restauration
const cateringDateOptions = computed(() => {
  if (!edition.value || !volunteersInfo.value) return []

  const options = []
  const formatDate = (date: Date) => formatDateFull(date.toISOString())

  const startDate = new Date(edition.value!.startDate)
  const endDate = new Date(edition.value!.endDate)

  // Ajouter les jours de montage si définis
  if (volunteersInfo.value?.setupStartDate) {
    const setupStart = new Date(volunteersInfo.value.setupStartDate)
    const currentDate = new Date(setupStart)

    while (
      currentDate &&
      startDate &&
      currentDate.toISOString().split('T')[0] < startDate.toISOString().split('T')[0]
    ) {
      const dateValue = currentDate.toISOString().split('T')[0]
      options.push({
        label: `${formatDate(currentDate)} (Montage)`,
        value: dateValue,
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }
  }

  // Ajouter les jours de l'événement
  const currentEventDate = new Date(startDate)
  while (currentEventDate.toISOString().split('T')[0] <= endDate.toISOString().split('T')[0]) {
    const dateValue = currentEventDate.toISOString().split('T')[0]
    options.push({
      label: `${formatDate(currentEventDate)} (Événement)`,
      value: dateValue,
    })
    currentEventDate.setDate(currentEventDate.getDate() + 1)
  }

  // Ajouter les jours de démontage si définis
  if (volunteersInfo.value?.teardownEndDate) {
    const teardownEnd = new Date(volunteersInfo.value.teardownEndDate)
    const currentDate = new Date(endDate)
    currentDate.setDate(currentDate.getDate() + 1)

    while (
      currentDate &&
      teardownEnd &&
      currentDate.toISOString().split('T')[0] <= teardownEnd.toISOString().split('T')[0]
    ) {
      const dateValue = currentDate.toISOString().split('T')[0]
      options.push({
        label: `${formatDate(currentDate)} (Démontage)`,
        value: dateValue,
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }
  }

  return options
})

/**
 * Les repas du jour choisi, chargés dès la sélection.
 *
 * Avant, ces données n'arrivaient qu'au clic sur « Générer » : un seul bouton, un seul document.
 * Maintenant qu'il y a un bouton par repas, il faut les connaître AVANT de dessiner la barre —
 * on ne peut pas proposer « Déjeuner » sans savoir qu'il y a un déjeuner ce jour-là.
 */
const repasDuJour = ref<any[]>([])
const chargementDesRepas = ref(false)

/** Quel bouton tourne. Un par document : celui du résumé, ou l'identifiant d'un repas. */
const pdfEnCours = ref<string | null>(null)

/**
 * Le jour change, la liste des boutons aussi.
 *
 * La liste est vidée AVANT la requête : sans cela, on verrait un instant les boutons de la
 * veille sous la nouvelle date, et rien ne dirait qu'ils ne correspondent plus.
 */
watch(selectedCateringDate, async (jour) => {
  repasDuJour.value = []
  if (!jour) return

  chargementDesRepas.value = true
  try {
    const donnees = (await $fetch(
      `/api/editions/${editionId.value}/volunteers/catering/${jour}`
    )) as any
    repasDuJour.value = donnees?.meals ?? []
  } catch (e: any) {
    toast.add({ title: e?.message || t('common.error'), color: 'error' })
  } finally {
    chargementDesRepas.value = false
  }
})

/** Le libellé d'un repas : son type et ses phases, comme la fiche les écrit. */
const libelleDuRepas = (repas: any): string => {
  const resume = resumerRepas(repas)
  const phases = resume.clesPhases.map((cle: string) => t(cle)).join(' + ')
  return phases ? `${t(resume.cleTypeRepas)} (${phases})` : t(resume.cleTypeRepas)
}

/** Le bandeau commun aux deux documents : de quoi on parle, et pour quelle édition. */
const enTeteDuDocument = (doc: any, titre: string, largeurPage: number) => {
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(titre, largeurPage / 2, 20, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `${t('gestion.meals.pdf_convention')} : ${edition.value?.convention?.name || t('common.unknown')}`,
    20,
    35
  )
  doc.text(
    `${t('gestion.meals.pdf_edition')} : ${edition.value?.name || t('common.unknown')}`,
    20,
    42
  )
}

/** Charge jsPDF et son greffon de tableaux, à la demande. */
const chargerJsPdf = async () => {
  const { jsPDF } = await import('jspdf')
  const { applyPlugin } = await import('jspdf-autotable')
  applyPlugin(jsPDF)
  return jsPDF
}

/**
 * Le résumé de la journée, en PDF — un document à lui seul.
 *
 * Il part en CUISINE : combien de couverts, quels régimes, quelles allergies et chez qui. Il ne
 * contient plus les listes nominatives, qui partent ailleurs et n'ont rien à faire sur le plan de
 * travail.
 *
 * Portrait : ce sont des paragraphes, pas un tableau.
 */
const genererResumePdf = async () => {
  if (!selectedCateringDate.value || repasDuJour.value.length === 0) return

  pdfEnCours.value = 'resume'
  try {
    const jsPDF = await chargerJsPdf()
    const doc = new jsPDF()

    enTeteDuDocument(
      doc,
      `${t('gestion.meals.catering_pdf_title')} - ${formatDateFull(selectedCateringDate.value)}`,
      210
    )

    // Ce qui sort de chaque fiche est décidé dans `restauration-pdf`, éprouvé à part ; ici, il
    // n'y a plus que du placement et de la traduction.
    const resumes = repasDuJour.value.map((repas) => resumerRepas(repas))

    /*
     * Les colonnes sont celles de la JOURNÉE, pas de chaque repas.
     *
     * Chaque service a désormais son propre tableau, et l'on pourrait n'y mettre que ses
     * populations. Mais on lit ce document en le parcourant : le nombre de véganes doit se
     * trouver au même endroit d'un service à l'autre, sans relire les en-têtes. Un service sans
     * billetterie laisse donc sa case vide plutôt que de décaler les colonnes suivantes.
     */
    const colonnesPopulation = colonnesDePopulation(resumes)
    const colonnesRegime = colonnesDeRegime(resumes)
    const aApresSpectacle = resumes.some((resume) => resume.apresSpectacle > 0)

    let y = 55

    const apresLeTableau = (marge: number) => {
      y = ((doc as any).lastAutoTable?.finalY ?? y) + marge
    }

    const sautSiBasDePage = (hauteurNecessaire: number) => {
      if (y > 297 - 20 - hauteurNecessaire) {
        doc.addPage()
        y = 20
      }
    }

    // « 0 » et non une case vide : sur une feuille de cuisine, une case vide fait douter — a-t-on
    // oublié de compter ? Un zéro tranche.
    const nombreOuZero = (comptes: readonly { cle: string; nombre: number }[], cle: string) =>
      String(nombrePourCle(comptes, cle) ?? 0)

    /*
     * Un service par section : son intitulé, ses chiffres, puis ses allergies.
     *
     * Les trois tableaux transversaux d'avant — volumes, régimes, allergies — obligeaient à
     * feuilleter : on lisait le nombre de couverts du dîner page 1, ses véganes page 2, ses
     * allergies page 3. La cuisine prépare UN service à la fois ; tout ce qui le concerne tient
     * désormais ensemble, et l'on passe au suivant.
     */
    for (const [rang, resume] of resumes.entries()) {
      /*
       * UNE PAGE PAR SERVICE.
       *
       * Ces feuilles ne se lisent pas, elles se distribuent : la personne du petit-déjeuner
       * emporte sa page, celle du dîner la sienne. Deux services sur une même feuille obligent
       * soit à photocopier deux fois, soit à faire circuler un document qui parle d'autre chose.
       *
       * Pas de saut avant le premier : il suit l'en-tête du document, sur la page de garde.
       */
      if (rang > 0) {
        doc.addPage()
        y = 20
      }

      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(79, 70, 229)
      doc.text(
        `${t(resume.cleTypeRepas)} — ${resume.clesPhases.map((cle) => t(cle)).join(' + ')}`,
        20,
        y
      )
      y += 7

      /*
       * Les chiffres du service, sur une seule ligne.
       *
       * Deux familles s'y côtoient : QUI mange — les populations, qui se somment pour faire le
       * total — et COMMENT — les régimes, qui répartissent ce même total autrement. Additionner
       * les unes aux autres n'aurait aucun sens, d'où l'en-tête des régimes teinté en vert : on
       * voit qu'il s'agit d'un second découpage sans avoir à y réfléchir.
       */
      const premiereColonneRegime = 1 + colonnesPopulation.length
      // @ts-expect-error - autoTable est ajouté dynamiquement au prototype de jsPDF
      doc.autoTable({
        startY: y,
        margin: { left: 20, right: 20 },
        styles: { fontSize: 9, cellPadding: 2.5, halign: 'center' },
        headStyles: { fillColor: [79, 70, 229], fontSize: 8 },
        bodyStyles: { fontStyle: 'bold', fontSize: 11 },
        head: [
          [
            t('common.total'),
            ...colonnesPopulation.map((cle) => t(cleLibelleDePopulation(cle))),
            ...colonnesRegime.map((cle) => t(cle)),
            ...(aApresSpectacle ? [t('gestion.meals.pdf_col_after_show')] : []),
          ],
        ],
        body: [
          [
            String(resume.total),
            ...colonnesPopulation.map((cle) => nombreOuZero(resume.populations, cle)),
            ...colonnesRegime.map((cle) => nombreOuZero(resume.regimes, cle)),
            ...(aApresSpectacle ? [String(resume.apresSpectacle)] : []),
          ],
        ],
        didParseCell: (donnees: any) => {
          if (donnees.section !== 'head') return
          const index = donnees.column.index
          if (
            index >= premiereColonneRegime &&
            index < premiereColonneRegime + colonnesRegime.length
          ) {
            donnees.cell.styles.fillColor = [21, 128, 61]
          }
        },
      })
      apresLeTableau(6)

      /*
       * Les allergies du service, juste en dessous.
       *
       * En rouge : c'est la seule partie de ce document où se tromper a des conséquences. Absentes
       * quand il n'y en a pas — une section « Allergies » vide se lit comme une donnée manquante,
       * et fait chercher ce qui n'existe pas.
       */
      if (resume.allergies.length) {
        // Le titre des allergies ne doit pas rester seul en bas de page ; `autoTable` reprend
        // ensuite tout seul si la liste déborde.
        sautSiBasDePage(30)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(185, 28, 28)
        doc.text(t('gestion.meals.pdf_allergies'), 20, y)
        y += 5

        // @ts-expect-error - autoTable est ajouté dynamiquement au prototype de jsPDF
        doc.autoTable({
          startY: y,
          margin: { left: 20, right: 20 },
          styles: { fontSize: 9, cellPadding: 2.5, overflow: 'linebreak', valign: 'top' },
          headStyles: { fillColor: [185, 28, 28], fontSize: 8 },
          columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 25 }, 3: { cellWidth: 32 } },
          head: [
            [
              t('gestion.meals.pdf_col_person'),
              t('gestion.meals.pdf_col_severity'),
              t('gestion.meals.pdf_col_allergies'),
              t('gestion.meals.pdf_emergency_phone'),
            ],
          ],
          body: resume.allergies.map((personne) => [
            personne.nom,
            personne.cleGravite ? t(personne.cleGravite) : '',
            personne.allergies,
            personne.contactUrgence ?? '',
          ]),
        })
        apresLeTableau(4)
      }

      /*
       * Les repas d'après spectacle, et QUI les attend.
       *
       * Le compte figure déjà dans la ligne de chiffres ; ce qui manquait, ce sont les noms. Ces
       * assiettes se gardent au chaud, et il faut pouvoir appeler la personne quand elle ne se
       * présente pas — un artiste qui finit tard ne revient pas toujours à l'heure dite.
       *
       * Le téléphone est celui du participant, non le contact d'urgence : on appelle pour
       * prévenir, pas pour secourir.
       */
      if (resume.personnesApresSpectacle.length) {
        sautSiBasDePage(30)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(161, 98, 7)
        doc.text(t('gestion.meals.pdf_after_show_title'), 20, y)
        y += 5

        // @ts-expect-error - autoTable est ajouté dynamiquement au prototype de jsPDF
        doc.autoTable({
          startY: y,
          margin: { left: 20, right: 20 },
          styles: { fontSize: 9, cellPadding: 2.5, overflow: 'linebreak' },
          headStyles: { fillColor: [161, 98, 7], fontSize: 8 },
          columnStyles: { 1: { cellWidth: 35 }, 2: { cellWidth: 45 } },
          head: [
            [
              t('gestion.meals.pdf_col_person'),
              t('gestion.meals.pdf_col_type'),
              t('gestion.meals.pdf_col_phone'),
            ],
          ],
          // Le type de personne : on ne s'adresse pas de la même façon à un artiste qu'on attend
          // en coulisses et à un bénévole de plateau qu'on croise au comptoir.
          body: resume.personnesApresSpectacle.map((personne) => [
            personne.nom,
            t(personne.cleType),
            personne.telephone ?? '',
          ]),
        })
        apresLeTableau(4)
      }
    }

    /*
     * La numérotation, posée en dernier : le total ne se connaît qu'une fois tous les tableaux
     * placés. Ces feuilles partent en cuisine et s'y mélangent — « sur 3 » dit qu'il en manque.
     */
    const pages = doc.internal.pages.length - 1
    for (let page = 1; page <= pages; page++) {
      doc.setPage(page)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(130, 130, 130)
      doc.text(t('common.page_of', { page, total: pages }), 190, 287, { align: 'right' })
    }

    doc.save(
      nomFichierRestauration(
        edition.value?.name,
        selectedCateringDate.value,
        t('gestion.meals.pdf_summary')
      )
    )
    toast.add({ title: t('common.export_success'), color: 'success' })
  } catch (e: any) {
    toast.add({ title: e?.message || t('common.error'), color: 'error' })
  } finally {
    pdfEnCours.value = null
  }
}

/**
 * La liste des personnes d'UN repas, en PDF — un document par service.
 *
 * Elle part au point de distribution et s'y coche au fil de la file. Un seul service par
 * document : la personne du déjeuner tenait jusqu'ici une liasse contenant aussi le dîner et le
 * petit-déjeuner, et devait soit tout imprimer, soit chercher sa page.
 *
 * PAYSAGE, à la différence du résumé. Les dix colonnes tiennent en portrait, mais seulement en
 * écrasant celle des allergies : les largeurs fixes en consomment 160 des 170 millimètres
 * utiles, et il en restait dix pour le texte le plus long de la fiche — celui qu'on lit
 * justement pour savoir quoi ne pas servir. Le paysage en laisse près de cent.
 */
const genererListePdf = async (meal: any) => {
  if (!selectedCateringDate.value) return

  pdfEnCours.value = String(meal.id ?? libelleDuRepas(meal))
  try {
    const jsPDF = await chargerJsPdf()
    const doc = new jsPDF({ orientation: 'landscape' })

    const resumeDuRepas = resumerRepas(meal)
    const phasesDuTableau = resumeDuRepas.clesPhases.map((cle) => t(cle)).join(' + ')

    enTeteDuDocument(
      doc,
      `${t(resumeDuRepas.cleTypeRepas)} - ${phasesDuTableau} - ${formatDateFull(selectedCateringDate.value)}`,
      297
    )

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `${t('gestion.meals.pdf_total')} : ${t('gestion.meals.count_participants', meal.totalParticipants)}`,
      20,
      49
    )

    // Un tiret plutôt qu'une case vide : sur une fiche imprimée, on doit voir qu'il n'y a rien
    // à signaler, et non se demander si la colonne a été oubliée.
    const RIEN = '-'
    const lignes = lignesDeParticipants(meal)
    const tableData = lignes.map((ligne) => [
      '', // Case à cocher vide en première position, pour pointer au service
      ligne.nom,
      ligne.prenom,
      t(ligne.cleType),
      ligne.apresSpectacle ? t('common.yes') : RIEN,
      ligne.email,
      ligne.telephone,
      ligne.cleRegime ? t(ligne.cleRegime) : RIEN,
      ligne.allergies ?? RIEN,
      ligne.cleGravite && ligne.allergies ? t(ligne.cleGravite) : RIEN,
    ])

    const entetes = [
      '',
      t('common.name'),
      t('common.first_name'),
      t('common.type'),
      t('gestion.meals.after_show'),
      t('common.email'),
      t('common.phone'),
      t('gestion.meals.diet'),
      t('gestion.meals.pdf_allergies_header'),
      t('gestion.meals.pdf_severity_header'),
    ]

    /**
     * La largeur qu'une colonne doit avoir pour ne jamais couper un mot en deux.
     *
     * Mesurée avec la police du document plutôt qu'estimée : une largeur moyenne par caractère se
     * trompe de plusieurs millimètres sur « Wüllenweber » comme sur « iii ». On prend le mot le
     * plus long de la colonne — en-tête compris, il déborde aussi bien que les valeurs — et on
     * ajoute la marge intérieure des deux côtés.
     *
     * La colonne « Allergies » est la seule exclue : c'est du texte libre, avec des espaces, donc
     * il s'y coupe proprement. Lui réserver la largeur de sa phrase entière mangerait la page.
     */
    const PADDING = 2
    const largeurPourColonne = (index: number) => {
      const valeurs = [entetes[index], ...tableData.map((ligne) => String(ligne[index] ?? ''))]
      return doc.getTextWidth(motLePlusLong(valeurs)) + PADDING * 2 + 1
    }

    /**
     * La police se réduit jusqu'à ce que tout tienne, plutôt que de laisser couper.
     *
     * Sur une édition aux adresses courtes, on reste à 8 points. Sur une autre où quelqu'un
     * s'appelle « leschapeauxpointus.association@gmail.com », on descend d'un cran ou deux — ce
     * qui se lit encore, là où « leschapeauxpointus.associa / tion@gmail.com » ne se lit pas.
     *
     * Le plancher à 6 points n'est pas un abandon : en dessous, la feuille cesse d'être lisible
     * au service, et il vaut mieux une coupure visible qu'une page qu'on renonce à déchiffrer.
     */
    const LARGEUR_UTILE = 297 - 40
    const INDEX_TYPE = 3
    const INDEX_ALLERGIES = 8
    let taillePolice = 8
    let largeurs: number[] = []

    while (taillePolice >= 6) {
      doc.setFontSize(taillePolice)
      largeurs = entetes.map((_, index) => {
        // La première colonne ne se mesure pas : c'est la case à cocher, dont la largeur est
        // fixée par l'util partagé. La calculer sur son en-tête vide donnerait un budget faux.
        if (index === 0) return LARGEUR_COLONNE_COCHE
        return index === INDEX_ALLERGIES ? 0 : largeurPourColonne(index)
      })
      const total = largeurs.reduce((somme, largeur) => somme + largeur, 0)
      // Il faut qu'il reste de quoi écrire les allergies : une colonne à zéro ne vaut rien.
      if (LARGEUR_UTILE - total >= 25) break
      taillePolice -= 1
    }

    // @ts-expect-error - autoTable est ajouté dynamiquement au prototype de jsPDF
    doc.autoTable({
      startY: 56,
      head: [entetes],
      body: tableData,
      styles: {
        fontSize: taillePolice,
        cellPadding: PADDING,
      },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: taillePolice,
      },
      // Chaque colonne à la largeur de son plus long mot ; « Allergies » prend le reste, et s'y
      // coupe aux espaces, ce qui est la seule coupure acceptable.
      columnStyles: {
        ...styleColonneCoche(),
        1: { cellWidth: largeurs[1] },
        2: { cellWidth: largeurs[2] },
        3: { cellWidth: largeurs[3] },
        4: { cellWidth: largeurs[4] },
        5: { cellWidth: largeurs[5] },
        6: { cellWidth: largeurs[6] },
        7: { cellWidth: largeurs[7] },
        8: { cellWidth: 'auto' },
        9: { cellWidth: largeurs[9] },
      },
      margin: { left: 20, right: 20 },
      /**
       * La colonne « Type » se colorise, aux teintes de l'écran.
       *
       * Sur une feuille de service, on cherche « les artistes » ou « les bénévoles » plus souvent
       * qu'une personne précise : la couleur donne le groupe d'un coup d'œil, là où il fallait
       * lire chaque ligne. Les teintes sont celles des statistiques d'entrée du contrôle
       * d'accès — un même code d'une page à l'autre.
       *
       * On retrouve le type par le RANG de la ligne et non par son libellé traduit : comparer des
       * textes affichés reviendrait à dépendre de la langue de qui imprime.
       */
      didParseCell: (donnees: any) => {
        if (donnees?.column?.index !== INDEX_TYPE || donnees?.section !== 'body') return

        const couleur = couleurDuType(lignes[donnees.row.index]?.type)
        if (!couleur) return

        donnees.cell.styles.fillColor = couleur.fond
        donnees.cell.styles.textColor = couleur.texte
        donnees.cell.styles.fontStyle = 'bold'
      },
      // Le tracé de la case vient de l'util partagé : ce PDF l'avait inventé pour lui seul,
      // et deux autres tableaux le réclamaient. Trois copies d'un carré à quatre millimètres
      // finissent par ne plus faire quatre millimètres partout.
      didDrawCell: (cellule: unknown) => dessinerCaseACocher(doc, cellule as never),
    })

    doc.save(
      nomFichierRestauration(
        edition.value?.name,
        selectedCateringDate.value,
        `${t(resumeDuRepas.cleTypeRepas)} ${phasesDuTableau}`
      )
    )
    toast.add({ title: t('common.export_success'), color: 'success' })
  } catch (e: any) {
    toast.add({ title: e?.message || t('common.error'), color: 'error' })
  } finally {
    pdfEnCours.value = null
  }
}

// Réinitialiser la page lors du changement de filtres
watch([selectedPhase, selectedType, selectedMealType, selectedDate], () => {
  pagination.value.page = 1
  fetchParticipants()
})

/**
 * Report des filtres vers l'URL.
 *
 * Déclaré APRÈS la remise à zéro de la page ci-dessus : les observateurs se déclenchent dans leur
 * ordre de création, et celui-ci doit voir la page déjà revenue à 1, sans quoi l'URL garderait la
 * page d'avant le changement de filtre.
 *
 * `replace` et non `push` : choisir un filtre n'est pas un pas de navigation sur lequel revenir.
 */
watch(
  [
    selectedPhase,
    selectedType,
    selectedMealType,
    selectedDate,
    searchQuery,
    () => pagination.value.page,
  ],
  () => {
    router.replace({
      query: requeteListeDeRepas(route.query, {
        recherche: searchQuery.value,
        phase: selectedPhase.value,
        typeDePersonne: selectedType.value,
        typeDeRepas: selectedMealType.value,
        date: selectedDate.value,
        page: pagination.value.page,
      }),
    })
  }
)

onMounted(async () => {
  // Charger l'édition si nécessaire
  if (!edition.value) {
    await editionStore.fetchEditionById(editionId.value)
  }

  // Charger les participants et les informations des bénévoles en parallèle
  await Promise.all([fetchParticipants(), fetchVolunteersInfo()])

  // Afficher les erreurs de chargement si nécessaire
  if (volunteersInfoError.value) {
    toast.add({
      title: t('common.error'),
      description: volunteersInfoError.value,
      color: 'error',
    })
  }
})
</script>
