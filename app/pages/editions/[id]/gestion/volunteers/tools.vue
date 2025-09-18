<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('editions.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('editions.not_found') }}</p>
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
      <EditionHeader
        :edition="edition"
        current-page="gestion"
        :is-favorited="isFavorited(edition.id)"
        @toggle-favorite="toggleFavorite(edition.id)"
      />

      <!-- Titre de la page -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-wrench-screwdriver" class="text-gray-600 dark:text-gray-400" />
          Outils de gestion
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Outils avancés pour la gestion des bénévoles
        </p>
      </div>

      <!-- Contenu des outils de gestion -->
      <div class="space-y-6">
        <!-- Outils disponibles si on peut gérer les bénévoles -->
        <div v-if="volunteersMode === 'INTERNAL'" class="space-y-6">
          <!-- Interface génération informations restauration -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-document-text" class="text-blue-500" />
                <h2 class="text-lg font-semibold">{{ t('editions.volunteers.catering_info') }}</h2>
              </div>
            </template>

            <div class="space-y-4">
              <UAlert
                icon="i-heroicons-information-circle"
                color="info"
                variant="soft"
                description="Générez des documents PDF avec les informations de restauration pour chaque jour de l'événement."
              />

              <UButtonGroup>
                <USelect
                  v-model="selectedCateringDate"
                  :items="cateringDateOptions"
                  value-attribute="value"
                  option-attribute="label"
                  :placeholder="t('editions.volunteers.select_date')"
                  :ui="{ content: 'min-w-fit' }"
                  class="min-w-[200px]"
                />
                <UButton
                  color="primary"
                  :disabled="!selectedCateringDate"
                  :loading="generatingCateringPdf"
                  @click="generateCateringPdf"
                >
                  {{ t('editions.volunteers.generate') }}
                </UButton>
              </UButtonGroup>
            </div>
          </UCard>
        </div>

        <!-- Message si pas les permissions ou pas en mode interne -->
        <UCard v-else>
          <div class="text-center py-12">
            <UIcon
              name="i-heroicons-wrench-screwdriver"
              class="h-16 w-16 text-gray-400 mx-auto mb-4"
            />
            <h2 class="text-xl font-semibold mb-2">Outils de gestion</h2>
            <p class="text-gray-600 dark:text-gray-400 mb-2">
              <template v-if="!canManageVolunteers">
                Vous n'avez pas les permissions nécessaires pour accéder aux outils de gestion des
                bénévoles.
              </template>
              <template v-else-if="volunteersMode !== 'INTERNAL'">
                Les outils de gestion sont disponibles uniquement en mode interne.
              </template>
            </p>
            <p v-if="volunteersMode !== 'INTERNAL'" class="text-sm text-gray-500">
              Changez le mode de gestion dans la page de gestion principale.
            </p>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// Interface pour les informations des bénévoles
interface VolunteerInfo {
  open: boolean
  description?: string
  mode: 'INTERNAL' | 'EXTERNAL'
  externalUrl?: string
  counts: Record<string, number>
  myApplication?: any
  setupStartDate?: string
  teardownEndDate?: string
}

// Variables pour les informations des bénévoles
const volunteersInfo = ref<VolunteerInfo | null>(null)

// Mode des bénévoles
const volunteersMode = computed(() => edition.value?.volunteersMode || 'INTERNAL')

// Variables pour la génération des PDFs de restauration
const selectedCateringDate = ref<string | undefined>(undefined)
const generatingCateringPdf = ref(false)

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false

  // Créateur de l'édition
  if (authStore.user.id === edition.value.creatorId) {
    return true
  }

  // Utilisateurs avec des droits spécifiques
  if (canEdit.value || canManageVolunteers.value) {
    return true
  }

  // Tous les collaborateurs de la convention (même sans droits)
  return editionStore.isCollaborator(edition.value, authStore.user.id)
})

// Permissions calculées
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const canManageVolunteers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageVolunteers(edition.value, authStore.user.id)
})

const isFavorited = computed(() => (_editionId: number) => {
  return edition.value?.favoritedBy.some((u) => u.id === authStore.user?.id)
})

const toggleFavorite = async (id: number) => {
  try {
    await editionStore.toggleFavorite(id)
    toast.add({
      title: t('messages.favorite_status_updated'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: e?.message || t('errors.favorite_update_failed'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
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
    // Importer jsPDF dynamiquement
    const { jsPDF } = await import('jspdf')

    // Récupérer les données depuis l'API
    const cateringData = (await $fetch(
      `/api/editions/${editionId}/volunteers/catering/${selectedCateringDate.value}`
    )) as any

    // Créer le PDF
    const doc = new jsPDF()
    let yPosition = 20

    // Titre du document
    doc.setFontSize(18)
    doc.text(
      `Informations Restauration - ${new Date(selectedCateringDate.value).toLocaleDateString(
        'fr-FR',
        {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }
      )}`,
      20,
      yPosition
    )
    yPosition += 20

    // Informations générales
    doc.setFontSize(12)
    doc.text(`Convention: ${edition.value?.convention?.name || 'N/A'}`, 20, yPosition)
    yPosition += 8
    doc.text(`Édition: ${edition.value?.name || 'N/A'}`, 20, yPosition)
    yPosition += 15

    // Labels des créneaux temporels en français
    const timeSlotLabels = {
      MORNING: 'Matin',
      AFTERNOON: 'Après-midi',
      EVENING: 'Soir',
    }

    for (const [slotKey, slotLabel] of Object.entries(timeSlotLabels)) {
      const slotData = (cateringData as any).slots[slotKey]

      if (yPosition > 250) {
        doc.addPage()
        yPosition = 20
      }

      // Titre du créneau
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(`${slotLabel}`, 20, yPosition)
      yPosition += 10

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)

      // Nombre total de bénévoles
      doc.text(`Total bénévoles: ${slotData.totalVolunteers}`, 25, yPosition)
      yPosition += 8

      // Répartition par régime
      if (Object.keys(slotData.dietaryCounts).length > 0) {
        doc.text('Régimes alimentaires:', 25, yPosition)
        yPosition += 6

        // Ordre spécifique : NONE, VEGETARIAN, VEGAN
        const dietOrder = ['NONE', 'VEGETARIAN', 'VEGAN']
        const dietLabels = {
          NONE: 'Aucun régime spécial',
          VEGETARIAN: 'Végétarien',
          VEGAN: 'Végan',
        }

        for (const diet of dietOrder) {
          if (slotData.dietaryCounts[diet]) {
            doc.text(`  • ${dietLabels[diet]}: ${slotData.dietaryCounts[diet]}`, 30, yPosition)
            yPosition += 6
          }
        }
        yPosition += 3
      }

      // Allergies
      if (slotData.allergies && slotData.allergies.length > 0) {
        doc.text('Allergies:', 25, yPosition)
        yPosition += 6

        for (const allergy of slotData.allergies) {
          const name = `${allergy.firstName} ${allergy.lastName}`
          doc.text(`  • ${name}: ${allergy.allergies}`, 30, yPosition)
          yPosition += 6

          if (yPosition > 270) {
            doc.addPage()
            yPosition = 20
          }
        }
      }

      yPosition += 10
    }

    // Télécharger le PDF
    const fileName = `restauration-${edition.value?.name?.replace(/[^a-zA-Z0-9]/g, '-') || 'edition'}-${selectedCateringDate.value}.pdf`
    doc.save(fileName)

    toast.add({
      title: t('common.export_success'),
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: e?.message || t('common.error'),
      color: 'error',
    })
  } finally {
    generatingCateringPdf.value = false
  }
}

// Fonction pour charger les informations des bénévoles
const fetchVolunteersInfo = async () => {
  try {
    volunteersInfo.value = (await $fetch(
      `/api/editions/${editionId}/volunteers/info`
    )) as VolunteerInfo
  } catch (error) {
    console.error('Failed to fetch volunteers info:', error)
  }
}

// Charger l'édition si nécessaire
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
  // Charger les informations des bénévoles
  await fetchVolunteersInfo()
})

// Métadonnées de la page
useSeoMeta({
  title: 'Outils de gestion - ' + (edition.value?.name || 'Édition'),
  description: 'Outils avancés pour la gestion des bénévoles',
})
</script>
