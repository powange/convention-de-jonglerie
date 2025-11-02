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
      <EditionHeader :edition="edition" current-page="gestion" />

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
          <!-- Notifier les bénévoles de leurs créneaux -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-bell" class="text-orange-500" />
                <h2 class="text-lg font-semibold">
                  {{ $t('edition.volunteers.notify_volunteers_slots') }}
                </h2>
              </div>
            </template>

            <div class="space-y-4">
              <UAlert
                icon="i-heroicons-information-circle"
                color="info"
                variant="soft"
                description="Envoyez une notification et un email à tous les bénévoles acceptés pour les informer que leurs créneaux sont disponibles."
              />

              <UButton
                color="primary"
                icon="i-heroicons-bell"
                :loading="sendingNotifications"
                @click="showNotifyModal = true"
              >
                Notifier tous les bénévoles acceptés
              </UButton>
            </div>
          </UCard>

          <!-- Interface génération informations restauration -->
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

      <!-- Modal de confirmation pour l'envoi des notifications -->
      <UModal v-model:open="showNotifyModal" title="Confirmer l'envoi des notifications">
        <template #body>
          <div class="space-y-4">
            <UAlert
              icon="i-heroicons-exclamation-triangle"
              color="warning"
              variant="soft"
              title="Attention"
              description="Vous allez envoyer une notification et un email à tous les bénévoles acceptés pour les informer que leurs créneaux sont disponibles."
            />
            <p class="text-gray-600 dark:text-gray-400">Cette action enverra :</p>
            <ul class="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
              <li>Une notification dans l'application</li>
              <li>Un email récapitulatif avec tous les créneaux assignés</li>
              <li>Un lien vers la page "Mes candidatures"</li>
            </ul>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Les bénévoles recevront uniquement les créneaux qui leur ont été assignés.
            </p>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-3">
            <UButton variant="outline" @click="showNotifyModal = false"> Annuler </UButton>
            <UButton
              color="primary"
              icon="i-heroicons-bell"
              :loading="sendingNotifications"
              @click="sendScheduleNotifications"
            >
              Confirmer l'envoi
            </UButton>
          </div>
        </template>
      </UModal>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useVolunteerSettings } from '~/composables/useVolunteerSettings'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// Utiliser le composable pour les paramètres des bénévoles
const {
  settings: volunteersInfo,
  error: volunteersInfoError,
  fetchSettings: fetchVolunteersInfo,
} = useVolunteerSettings(editionId)

// Mode des bénévoles
const volunteersMode = computed(() => volunteersInfo.value?.mode || 'INTERNAL')

// Variables pour la génération des PDFs de restauration
const selectedCateringDate = ref<string | undefined>(undefined)
const generatingCateringPdf = ref(false)

// Variables pour l'envoi des notifications de créneaux
const showNotifyModal = ref(false)
const sendingNotifications = ref(false)

// Fonction pour envoyer les notifications de créneaux aux bénévoles acceptés
const sendScheduleNotifications = async () => {
  sendingNotifications.value = true
  try {
    const result = await $fetch(`/api/editions/${editionId}/volunteers/notify-schedules`, {
      method: 'POST',
    })

    toast.add({
      title: t('common.success'),
      description: result.message || 'Notifications envoyées avec succès',
      color: 'success',
    })

    showNotifyModal.value = false
  } catch (error: any) {
    toast.add({
      title: t('common.error'),
      description:
        error?.data?.message || error?.message || "Erreur lors de l'envoi des notifications",
      color: 'error',
    })
  } finally {
    sendingNotifications.value = false
  }
}

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
      `/api/editions/${editionId}/volunteers/catering/${selectedCateringDate.value}`
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

  // Afficher les erreurs de chargement si nécessaire
  if (volunteersInfoError.value) {
    toast.add({
      title: t('common.error'),
      description: volunteersInfoError.value,
      color: 'error',
    })
  }
})

// Métadonnées de la page
useSeoMeta({
  title: 'Outils de gestion - ' + (edition.value?.name || 'Édition'),
  description: 'Outils avancés pour la gestion des bénévoles',
  ogTitle: () => edition.value?.name || edition.value?.convention?.name || 'Convention',
})
</script>
