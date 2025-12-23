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
definePageMeta({
  layout: 'edition-dashboard',
})

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const { t } = useI18n()
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

  // Créateur de l'édition
  if (authStore.user.id === edition.value.creatorId) return true

  // Utilisateurs avec droits d'édition
  if (editionStore.canEditEdition(edition.value, authStore.user.id)) return true

  // Tous les organisateurs de la convention
  if (edition.value.convention?.organizers) {
    return edition.value.convention.organizers.some(
      (collab) => collab.user.id === authStore.user?.id
    )
  }

  return false
})

// État
const loading = ref(false)
const participants = ref<any[]>([])
const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0,
})
const searchQuery = ref('')
const selectedPhase = ref('all')
const selectedType = ref('all')
const selectedMealType = ref('all')
const selectedDate = ref('all')
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
    label: new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
  })),
])

// Colonnes du tableau
const columns = [
  { accessorKey: 'nom', header: 'Nom' },
  { accessorKey: 'prenom', header: 'Prénom' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'type', header: 'Type' },
  { accessorKey: 'mealDate', header: 'Date' },
  { accessorKey: 'mealType', header: 'Type de repas' },
  { accessorKey: 'mealPhase', header: 'Phase' },
  { accessorKey: 'dietaryPreference', header: 'Régime' },
  { accessorKey: 'afterShow', header: 'Après spectacle' },
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

// Formatage de date
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

// Données formatées pour le tableau
const formattedParticipants = computed(() => {
  return participants.value.map((p) => {
    let typeLabel = ''
    if (p.type === 'volunteer') typeLabel = t('common.volunteer')
    else if (p.type === 'artist') typeLabel = t('common.artist')
    else if (p.type === 'participant') typeLabel = t('common.participant')

    return {
      nom: p.nom,
      prenom: p.prenom,
      email: p.email,
      type: typeLabel,
      mealDate: formatDate(p.mealDate),
      mealType: getMealTypeLabel(p.mealType),
      mealPhase: getPhasesLabel(p.mealPhases),
      dietaryPreference: p.dietaryPreference ? getDietLabel(p.dietaryPreference) : '-',
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
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

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
      `Restauration - ${new Date(selectedCateringDate.value).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`,
      105,
      yPosition,
      { align: 'center' }
    )
    yPosition += 15

    // Informations générales
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(`Convention: ${edition.value?.convention?.name || 'N/A'}`, 20, yPosition)
    yPosition += 7
    doc.text(`Édition: ${edition.value?.name || 'N/A'}`, 20, yPosition)
    yPosition += 15

    // Résumé des repas
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Résumé des repas', 20, yPosition)
    yPosition += 10

    const mealTypeLabels = { BREAKFAST: 'Matin', LUNCH: 'Midi', DINNER: 'Soir' }
    const phaseLabels = { SETUP: 'Montage', EVENT: 'Édition', TEARDOWN: 'Démontage' }
    const dietLabels = {
      NONE: 'Aucun régime spécial',
      VEGETARIAN: 'Végétarien',
      VEGAN: 'Végan',
    }
    const severityLabels = {
      LIGHT: 'légère',
      MODERATE: 'modérée',
      SEVERE: 'sévère',
      CRITICAL: 'critique',
    }

    // Afficher chaque repas avec ses détails
    for (const meal of cateringData.meals) {
      // Vérifier si on a besoin d'une nouvelle page
      if (yPosition > 240) {
        doc.addPage()
        yPosition = 20
      }

      const mealLabel =
        mealTypeLabels[meal.mealType as keyof typeof mealTypeLabels] || meal.mealType
      const phaseLabel = meal.phases
        .map((phase: string) => phaseLabels[phase as keyof typeof phaseLabels] || phase)
        .join(' + ')

      // Calculer le nombre d'artistes qui mangent après le spectacle
      const artistsAfterShowCount = meal.participants.filter(
        (p: any) => p.type === 'artist' && p.afterShow
      ).length

      // Titre du repas
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(`${mealLabel} (${phaseLabel})`, 25, yPosition)
      yPosition += 7

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')

      // Construire le texte avec les différents types de participants
      const participantsParts = [
        `${meal.volunteerCount} bénévole${meal.volunteerCount > 1 ? 's' : ''}`,
        `${meal.artistCount} artiste${meal.artistCount > 1 ? 's' : ''}`,
      ]

      if (meal.ticketParticipantCount > 0) {
        participantsParts.push(
          `${meal.ticketParticipantCount} participant${meal.ticketParticipantCount > 1 ? 's' : ''}`
        )
      }

      doc.text(`Total: ${meal.totalParticipants} (${participantsParts.join(', ')})`, 30, yPosition)
      yPosition += 5

      // Afficher le nombre d'artistes qui mangent après le spectacle
      if (artistsAfterShowCount > 0) {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'italic')
        doc.text(`  dont ${artistsAfterShowCount} artiste(s) après spectacle`, 30, yPosition)
        yPosition += 5
      } else {
        yPosition += 1
      }

      // Calculer les régimes pour ce repas
      const mealDietCounts: Record<string, number> = {}
      meal.participants.forEach((p: any) => {
        const diet = p.dietaryPreference || 'NONE'
        mealDietCounts[diet] = (mealDietCounts[diet] || 0) + 1
      })

      // Afficher les régimes alimentaires
      if (Object.keys(mealDietCounts).length > 0) {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'italic')
        doc.text('Régimes:', 30, yPosition)
        yPosition += 5

        const dietOrder = ['NONE', 'VEGETARIAN', 'VEGAN']
        for (const diet of dietOrder) {
          if (mealDietCounts[diet]) {
            doc.text(
              `  ${dietLabels[diet as keyof typeof dietLabels]}: ${mealDietCounts[diet]}`,
              32,
              yPosition
            )
            yPosition += 4
          }
        }
      }

      // Filtrer les allergies pour ce repas
      const mealAllergies = meal.participants.filter((p: any) => p.allergies && p.allergies.trim())

      if (mealAllergies.length > 0) {
        yPosition += 2
        doc.setFontSize(9)
        doc.setFont('helvetica', 'italic')
        doc.text('Allergies:', 30, yPosition)
        yPosition += 5

        for (const participant of mealAllergies) {
          const name = `${participant.prenom || ''} ${participant.nom || ''}`.trim()
          const severityText = participant.allergySeverity
            ? ` (${severityLabels[participant.allergySeverity as keyof typeof severityLabels] || participant.allergySeverity})`
            : ''

          doc.setFontSize(8)
          doc.text(`  • ${name}${severityText}: ${participant.allergies}`, 32, yPosition)
          yPosition += 4

          if (participant.emergencyContactPhone) {
            doc.text(`    Tel urgence: ${participant.emergencyContactPhone}`, 34, yPosition)
            yPosition += 4
          }

          // Vérifier si on dépasse la page
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

      const mealLabel =
        mealTypeLabels[meal.mealType as keyof typeof mealTypeLabels] || meal.mealType
      const phaseLabel = meal.phases
        .map((phase: string) => phaseLabels[phase as keyof typeof phaseLabels] || phase)
        .join(' + ')

      // Titre du repas
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text(`${mealLabel} - ${phaseLabel}`, 20, 20)

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(`Total: ${meal.totalParticipants} participants`, 20, 28)

      // Préparer les données du tableau
      const tableData = meal.participants.map((p: any) => {
        const typeLabel =
          p.type === 'volunteer' ? 'Bénévole' : p.type === 'artist' ? 'Artiste' : 'Participant'
        const dietLabel =
          p.dietaryPreference === 'VEGETARIAN'
            ? 'Végétarien'
            : p.dietaryPreference === 'VEGAN'
              ? 'Végan'
              : '-'
        const severityLabel =
          p.allergySeverity === 'LIGHT'
            ? 'Légère'
            : p.allergySeverity === 'MODERATE'
              ? 'Modérée'
              : p.allergySeverity === 'SEVERE'
                ? 'Sévère'
                : p.allergySeverity === 'CRITICAL'
                  ? 'Critique'
                  : '-'
        const afterShowLabel = p.type === 'artist' && p.afterShow ? 'Oui' : '-'

        return [
          '', // Case à cocher vide en première position
          p.nom || '',
          p.prenom || '',
          typeLabel,
          afterShowLabel,
          p.email || '',
          p.phone || '',
          dietLabel,
          p.allergies || '-',
          p.allergies ? severityLabel : '-',
        ]
      })

      // Générer le tableau
      // @ts-expect-error - autoTable est ajouté dynamiquement au prototype de jsPDF
      doc.autoTable({
        startY: 35,
        head: [
          [
            '',
            'Nom',
            'Prénom',
            'Type',
            'Après spectacle',
            'Email',
            'Téléphone',
            'Régime',
            'Allergies',
            'Sévérité',
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
