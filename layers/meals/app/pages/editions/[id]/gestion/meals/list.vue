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

            <UFieldGroup>
              <USelect
                v-model="selectedCateringDate"
                :items="cateringDateOptions"
                value-attribute="value"
                option-attribute="label"
                :placeholder="t('edition.volunteers.select_date')"
                :ui="{ content: 'min-w-fit' }"
                class="min-w-[200px]"
              />
              <UButton
                color="primary"
                :disabled="!selectedCateringDate"
                :loading="generatingCateringPdf"
                @click="generateCateringPdf"
              >
                {{ t('edition.volunteers.generate') }}
              </UButton>
            </UFieldGroup>
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

              <!-- Filtre par type de repas -->
              <USelect
                v-model="selectedMealType"
                :items="mealTypeOptions"
                value-key="value"
                :placeholder="$t('edition.meals.filter_meal_type')"
              />

              <!-- Filtre par date -->
              <USelect
                v-model="selectedDate"
                :items="dateOptions"
                value-key="value"
                :placeholder="$t('edition.meals.filter_date')"
              />
            </div>
          </div>

          <!-- Statistiques -->
          <div v-if="stats" class="mb-6 space-y-4">
            <!-- Statistiques principales -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <UCard>
                <div class="text-center">
                  <div class="text-2xl font-bold text-primary-500">{{ stats.total }}</div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('edition.meals.stats.total') }}
                  </div>
                </div>
              </UCard>
              <UCard v-if="stats.ticketingParticipants > 0">
                <div class="text-center">
                  <div class="text-2xl font-bold text-green-500">
                    {{ stats.ticketingParticipants }}
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('edition.meals.stats.participants') }}
                  </div>
                </div>
              </UCard>
              <UCard v-if="stats.volunteers > 0">
                <div class="text-center">
                  <div class="text-2xl font-bold text-blue-500">{{ stats.volunteers }}</div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('edition.meals.stats.volunteers') }}
                  </div>
                </div>
              </UCard>
              <UCard v-if="stats.artists > 0">
                <div class="text-center">
                  <div class="text-2xl font-bold text-purple-500">{{ stats.artists }}</div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('edition.meals.stats.artists') }}
                  </div>
                </div>
              </UCard>
              <UCard v-if="stats.organizers > 0">
                <div class="text-center">
                  <div class="text-2xl font-bold text-indigo-500">{{ stats.organizers }}</div>
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

          <UTable v-else :data="formattedParticipants" :columns="columns" class="w-full" />

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
// Import explicite : plusieurs layers exportent un `filtresDepuisUrl`, et l'auto-import ne
// saurait pas lequel prendre.
import {
  dateConnue,
  filtresDepuisUrl,
  requeteListeDeRepas,
} from '../../../../../utils/filtres-liste-repas'
import { resumerRepas, lignesDeParticipants } from '../../../../../utils/restauration-pdf'

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
const generatingCateringPdf = ref(false)

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
const columns = [
  { accessorKey: 'nom', header: t('common.name') },
  { accessorKey: 'prenom', header: t('common.first_name') },
  { accessorKey: 'email', header: t('common.email') },
  { accessorKey: 'type', header: t('common.type') },
  { accessorKey: 'mealDate', header: t('common.date') },
  { accessorKey: 'mealType', header: t('gestion.meals.meal_type') },
  { accessorKey: 'mealPhase', header: t('gestion.meals.phase') },
  { accessorKey: 'dietaryPreference', header: t('gestion.meals.diet') },
  { accessorKey: 'afterShow', header: t('gestion.meals.after_show') },
]

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
const formattedParticipants = computed(() => {
  return participants.value.map((p) => {
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
      afterShow: p.type === 'artist' && p.afterShow ? '✓' : '-',
    }
  })
})

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
const fetchParticipants = async () => {
  loading.value = true
  try {
    const params: Record<string, string> = {
      page: pagination.value.page.toString(),
      pageSize: pagination.value.pageSize.toString(),
    }

    if (searchQuery.value.trim()) {
      params.search = searchQuery.value.trim()
    }

    if (selectedPhase.value && selectedPhase.value !== 'all') {
      params.phase = selectedPhase.value
    }

    if (selectedType.value && selectedType.value !== 'all') {
      params.type = selectedType.value
    }

    if (selectedMealType.value && selectedMealType.value !== 'all') {
      params.mealType = selectedMealType.value
    }

    if (selectedDate.value && selectedDate.value !== 'all') {
      params.date = selectedDate.value
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

const generateCateringPdf = async () => {
  if (!selectedCateringDate.value) return

  generatingCateringPdf.value = true
  try {
    // Importer jsPDF et autoTable dynamiquement
    const { jsPDF } = await import('jspdf')
    const { applyPlugin } = await import('jspdf-autotable')

    applyPlugin(jsPDF)

    // Récupérer les données depuis l'API
    const cateringData = (await $fetch(
      `/api/editions/${editionId.value}/volunteers/catering/${selectedCateringDate.value}`
    )) as any

    // Créer le PDF en format portrait pour la première page
    const doc = new jsPDF()

    // === PAGE 1: RÉSUMÉ ===
    let yPosition = 20

    // Titre du document
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(
      `${t('gestion.meals.catering_pdf_title')} - ${formatDateFull(selectedCateringDate.value)}`,
      105,
      yPosition,
      { align: 'center' }
    )
    yPosition += 15

    // Informations générales
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `${t('gestion.meals.pdf_convention')} : ${edition.value?.convention?.name || t('common.unknown')}`,
      20,
      yPosition
    )
    yPosition += 7
    doc.text(
      `${t('gestion.meals.pdf_edition')} : ${edition.value?.name || t('common.unknown')}`,
      20,
      yPosition
    )
    yPosition += 15

    // Résumé des repas
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(t('gestion.meals.pdf_summary'), 20, yPosition)
    yPosition += 10

    // Afficher chaque repas avec ses détails
    for (const meal of cateringData.meals) {
      // Vérifier si on a besoin d'une nouvelle page
      if (yPosition > 240) {
        doc.addPage()
        yPosition = 20
      }

      // Ce qui sort de la fiche est décidé dans `restauration-pdf`, éprouvé à part ; ici, il
      // n'y a plus que du placement et de la traduction.
      const resume = resumerRepas(meal)

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      const phasesLisibles = resume.clesPhases.map((cle) => t(cle)).join(' + ')
      doc.text(`${t(resume.cleTypeRepas)} (${phasesLisibles})`, 25, yPosition)
      yPosition += 7

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const populations = resume.populations.map((p) => t(p.cle, p.nombre)).join(', ')
      doc.text(`${t('gestion.meals.pdf_total')} : ${resume.total} (${populations})`, 30, yPosition)
      yPosition += 5

      if (resume.apresSpectacle > 0) {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'italic')
        doc.text(`  ${t('gestion.meals.pdf_after_show', resume.apresSpectacle)}`, 30, yPosition)
        yPosition += 5
      } else {
        yPosition += 1
      }

      if (resume.regimes.length > 0) {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'italic')
        doc.text(t('gestion.meals.pdf_diets'), 30, yPosition)
        yPosition += 5

        for (const regime of resume.regimes) {
          doc.text(`  ${t(regime.cle)} : ${regime.nombre}`, 32, yPosition)
          yPosition += 4
        }
      }

      if (resume.allergies.length > 0) {
        yPosition += 2
        doc.setFontSize(9)
        doc.setFont('helvetica', 'italic')
        doc.text(t('gestion.meals.pdf_allergies'), 30, yPosition)
        yPosition += 5

        for (const personne of resume.allergies) {
          const gravite = personne.cleGravite ? ` (${t(personne.cleGravite)})` : ''

          doc.setFontSize(8)
          doc.text(`  • ${personne.nom}${gravite} : ${personne.allergies}`, 32, yPosition)
          yPosition += 4

          if (personne.telephoneUrgence) {
            doc.text(
              `    ${t('gestion.meals.pdf_emergency_phone')} : ${personne.telephoneUrgence}`,
              34,
              yPosition
            )
            yPosition += 4
          }

          if (yPosition > 270) {
            doc.addPage()
            yPosition = 20
          }
        }
      }

      yPosition += 5
    }

    // === PAGES SUIVANTES: TABLEAUX PAR REPAS (FORMAT PORTRAIT) ===
    for (const meal of cateringData.meals) {
      // Ajouter une nouvelle page en format portrait
      doc.addPage('a4', 'portrait')

      const resumeDuRepas = resumerRepas(meal)
      const phasesDuTableau = resumeDuRepas.clesPhases.map((cle) => t(cle)).join(' + ')

      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text(`${t(resumeDuRepas.cleTypeRepas)} - ${phasesDuTableau}`, 20, 20)

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(
        `${t('gestion.meals.pdf_total')} : ${t('gestion.meals.count_participants', meal.totalParticipants)}`,
        20,
        28
      )

      // Un tiret plutôt qu'une case vide : sur une fiche imprimée, on doit voir qu'il n'y a rien
      // à signaler, et non se demander si la colonne a été oubliée.
      const RIEN = '-'
      const tableData = lignesDeParticipants(meal).map((ligne) => [
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

      // Générer le tableau
      // @ts-expect-error - autoTable est ajouté dynamiquement au prototype de jsPDF
      doc.autoTable({
        startY: 35,
        head: [
          [
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
          ],
        ],
        body: tableData,
        styles: {
          fontSize: 7,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [66, 139, 202],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 7,
        },
        columnStyles: {
          0: { cellWidth: 6 }, // Case à cocher
          1: { cellWidth: 20 }, // Nom
          2: { cellWidth: 20 }, // Prénom
          3: { cellWidth: 16 }, // Type
          4: { cellWidth: 14 }, // Après spectacle
          5: { cellWidth: 35 }, // Email
          6: { cellWidth: 20 }, // Téléphone
          7: { cellWidth: 15 }, // Régime
          8: { cellWidth: 'auto' }, // Allergies (prend l'espace restant)
          9: { cellWidth: 14 }, // Sévérité
        },
        margin: { left: 20, right: 20 },
        didDrawCell: (data: any) => {
          // Dessiner un carré dans la première colonne pour chaque ligne de données
          if (data.column.index === 0 && data.section === 'body') {
            const squareSize = 4
            const x = data.cell.x + (data.cell.width - squareSize) / 2
            const y = data.cell.y + (data.cell.height - squareSize) / 2
            doc.rect(x, y, squareSize, squareSize, 'S')
          }
        },
      })
    }

    // Télécharger le PDF
    const fileName = `restauration-${edition.value?.name?.replace(/[^a-zA-Z0-9]/g, '-') || 'edition'}-${selectedCateringDate.value}.pdf`
    doc.save(fileName)

    toast.add({
      title: t('common.export_success'),
      color: 'success',
    })
  } catch (e: any) {
    console.error('PDF generation error:', e)
    toast.add({
      title: e?.message || t('common.error'),
      color: 'error',
    })
  } finally {
    generatingCateringPdf.value = false
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
