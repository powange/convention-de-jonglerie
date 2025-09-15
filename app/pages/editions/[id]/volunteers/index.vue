<!-- eslint-disable vue/no-v-html -->
<template>
  <div v-if="edition">
    <EditionHeader
      :edition="edition"
      current-page="volunteers"
      :is-favorited="isFavorited(edition.id)"
      @toggle-favorite="toggleFavorite(edition.id)"
    />

    <UCard variant="soft" class="mb-6">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-hand-raised" class="text-primary-500" />
            {{ t('editions.volunteers.title') }}
          </h3>
          <div v-if="canManageEdition" class="flex items-center gap-2">
            <UButton
              size="xs"
              color="primary"
              variant="soft"
              icon="i-heroicons-cog-6-tooth"
              :to="`/editions/${edition?.id}/gestion`"
            >
              {{ t('common.manage') || 'Gérer' }}
            </UButton>
          </div>
        </div>
      </template>

      <div class="space-y-6">
        <!-- Description -->
        <div>
          <div class="prose dark:prose-invert max-w-none text-sm">
            <template v-if="volunteersInfo?.description">
              <div
                :class="[shouldReduceDescription && !showFullDescription ? 'overflow-hidden' : '']"
                :style="
                  shouldReduceDescription && !showFullDescription
                    ? {
                        display: '-webkit-box',
                        WebkitLineClamp: '3',
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }
                    : {}
                "
                v-html="volunteersDescriptionHtml"
              />
              <div v-if="shouldReduceDescription && volunteersInfo?.description" class="mt-2">
                <UButton
                  size="xs"
                  variant="ghost"
                  color="primary"
                  :icon="
                    showFullDescription ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'
                  "
                  @click="showFullDescription = !showFullDescription"
                >
                  {{ showFullDescription ? t('common.show_less') : t('common.show_more') }}
                </UButton>
              </div>
            </template>
            <template v-else>
              <p class="text-gray-500">{{ t('editions.volunteers.no_description') }}</p>
            </template>
          </div>
        </div>

        <!-- Mode EXTERNAL: bouton accessible à tous -->
        <div
          v-if="
            volunteersMode === 'EXTERNAL' && volunteersInfo?.open && volunteersInfo?.externalUrl
          "
          class="flex items-center gap-3"
        >
          <UButton
            size="sm"
            color="primary"
            icon="i-heroicons-arrow-top-right-on-square"
            :to="volunteersInfo.externalUrl"
            target="_blank"
          >
            {{ t('editions.volunteers.apply') }}
          </UButton>
          <span class="text-xs text-gray-500 truncate max-w-full">{{
            volunteersInfo.externalUrl
          }}</span>
        </div>

        <!-- Candidature utilisateur (déplacé juste après description) -->
        <div v-if="authStore.isAuthenticated && volunteersMode === 'INTERNAL'">
          <div v-if="!volunteersInfo?.open" class="text-sm text-gray-500 flex items-center gap-2">
            <UIcon name="i-heroicons-lock-closed" /> {{ t('editions.volunteers.closed_message') }}
          </div>
          <div v-else>
            <UCard
              variant="subtle"
              class="border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/40"
            >
              <template v-if="volunteersInfo?.myApplication">
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <h4 class="text-sm font-semibold flex items-center gap-1">
                      <UIcon name="i-heroicons-user" class="text-primary-500" />
                      {{ t('editions.volunteers.my_application_title') }}
                    </h4>
                    <UBadge
                      :color="volunteerStatusColor(volunteersInfo.myApplication.status)"
                      variant="soft"
                      class="uppercase"
                    >
                      {{ volunteerStatusLabel(volunteersInfo.myApplication.status) }}
                    </UBadge>
                  </div>
                  <div class="text-xs space-y-1">
                    <span
                      v-if="volunteersInfo.myApplication.status === 'PENDING'"
                      class="block text-gray-600 dark:text-gray-400"
                      >{{ t('editions.volunteers.my_application_pending') }}</span
                    >
                    <span
                      v-else-if="volunteersInfo.myApplication.status === 'ACCEPTED'"
                      class="block text-gray-600 dark:text-gray-400"
                      >{{ t('editions.volunteers.my_application_accepted') }}</span
                    >
                    <span
                      v-else-if="volunteersInfo.myApplication.status === 'REJECTED'"
                      class="block text-gray-600 dark:text-gray-400"
                      >{{ t('editions.volunteers.my_application_rejected') }}</span
                    >
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <UButton
                      v-if="volunteersInfo.myApplication.status === 'PENDING'"
                      size="xs"
                      color="error"
                      variant="soft"
                      :loading="volunteersWithdrawing"
                      @click="withdrawApplication"
                    >
                      {{ t('editions.volunteers.withdraw') }}
                    </UButton>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="flex items-center justify-between gap-4">
                  <div class="text-xs text-gray-600 dark:text-gray-400">
                    {{ t('editions.volunteers.apply_description') }}
                  </div>
                  <UButton
                    size="sm"
                    color="primary"
                    icon="i-heroicons-hand-raised"
                    @click="openApplyModal"
                  >
                    {{ t('editions.volunteers.apply') }}
                  </UButton>
                </div>
              </template>
            </UCard>
          </div>
        </div>
        <div
          v-else-if="!authStore.isAuthenticated && volunteersMode === 'INTERNAL'"
          class="text-sm text-gray-500"
        >
          {{ t('editions.volunteers.login_prompt') }}
        </div>
      </div>
    </UCard>

    <!-- Modal candidature bénévole -->
    <EditionVolunteerApplicationModal
      v-model="showApplyModal"
      :volunteers-info="volunteersInfo as any"
      :edition="edition"
      :user="authStore.user as any"
      :applying="volunteersApplying"
      @close="closeApplyModal"
      @submit="applyAsVolunteer"
    />

    <UCard v-if="canViewVolunteersTable" variant="soft" class="mb-6">
      <template #header>
        <div class="space-y-2">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-clipboard-document-list" class="text-primary-500" />
            {{ t('editions.volunteers.management_title') }}
          </h3>
          <p
            v-if="volunteersMode === 'INTERNAL'"
            class="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2"
          >
            <UIcon name="i-heroicons-information-circle" class="text-blue-500" size="16" />
            {{
              canManageVolunteers
                ? t('editions.volunteers.admin_only_note')
                : t('editions.volunteers.view_only_note')
            }}
          </p>
        </div>
      </template>

      <!-- Note visibilité + séparation avant statistiques & tableau organisateur -->
      <div v-if="volunteersMode === 'INTERNAL'">
        <!-- Statistiques -->
        <div v-if="volunteersInfo" class="mt-3 mb-3 flex flex-wrap gap-3">
          <UBadge color="neutral" variant="soft"
            >{{ t('editions.volunteers.total') }}: {{ volunteersInfo.counts.total || 0 }}</UBadge
          >
          <UBadge color="warning" variant="soft"
            >{{ t('editions.volunteers.status_pending') }}:
            {{ volunteersInfo.counts.PENDING || 0 }}</UBadge
          >
          <UBadge color="success" variant="soft"
            >{{ t('editions.volunteers.status_accepted') }}:
            {{ volunteersInfo.counts.ACCEPTED || 0 }}</UBadge
          >
          <UBadge color="error" variant="soft"
            >{{ t('editions.volunteers.status_rejected') }}:
            {{ volunteersInfo.counts.REJECTED || 0 }}</UBadge
          >
        </div>
      </div>

      <div class="space-y-3">
        <template v-if="volunteersMode === 'INTERNAL'">
          <div class="space-y-4">
            <!-- Tableau des bénévoles avec filtres -->
            <EditionVolunteersTable
              :volunteers-info="volunteersInfo"
              :edition-id="editionId"
              :can-manage-volunteers="canManageVolunteers"
              @refresh-volunteers-info="fetchVolunteersInfo"
            />

            <!-- Interface génération informations restauration -->
            <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div class="flex items-center justify-between mb-4">
                <h4
                  class="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2"
                >
                  <UIcon name="i-heroicons-document-text" class="text-gray-500" />
                  {{ t('editions.volunteers.catering_info') }}
                </h4>
              </div>
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

            <!-- Interface gestion du planning -->
            <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div class="flex items-center justify-between mb-4">
                <h4
                  class="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2"
                >
                  <UIcon name="i-heroicons-calendar-days" class="text-gray-500" />
                  {{ t('editions.volunteers.schedule_management') }}
                </h4>
              </div>
              <UButton
                color="primary"
                variant="solid"
                icon="i-heroicons-calendar-days"
                :to="`/editions/${edition?.id}/volunteers/planning`"
              >
                {{ t('editions.volunteers.go_to_schedule') }}
              </UButton>
            </div>
          </div>
        </template>
      </div>
    </UCard>

    <!-- Section notification des bénévoles -->
    <UCard v-if="canManageVolunteers" variant="soft" class="mb-6">
      <EditionVolunteerNotifications
        ref="notificationsListRef"
        :edition-id="editionId"
        :edition="edition"
        :volunteers-info="volunteersInfo"
        :can-manage-volunteers="canManageVolunteers"
        :accepted-volunteers-count="volunteersInfo?.counts?.ACCEPTED ?? 0"
      />
    </UCard>
  </div>
  <div v-else>
    <p>{{ t('editions.loading_details') }}</p>
  </div>
</template>

<script setup lang="ts">
// Vue & libs
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

// App components & stores
import EditionHeader from '~/components/edition/EditionHeader.vue'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { markdownToHtml } from '~/utils/markdown'

const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const editionId = parseInt(route.params.id as string)

// Expose constants early (avant tout await)
defineExpose({})
await editionStore.fetchEditionById(editionId)
const edition = computed(() => editionStore.getEditionById(editionId))

const isFavorited = computed(() => (_id: number) => {
  return edition.value?.favoritedBy.some((u) => u.id === authStore.user?.id)
})
const toggleFavorite = async (id: number) => {
  try {
    await editionStore.toggleFavorite(id)
  } catch {
    /* silent */
  }
}

// Condition pour voir le tableau des bénévoles (tous les collaborateurs)
const canViewVolunteersTable = computed(() => {
  if (!authStore.user || !edition.value) return false
  // Super Admin en mode admin
  if (authStore.isAdminModeActive) return true
  // Créateur de l'édition
  if (edition.value.creatorId === authStore.user.id) return true
  // Auteur de la convention
  if (edition.value.convention?.authorId === authStore.user.id) return true
  // Collaborateur de la convention
  const collab = edition.value.convention?.collaborators?.find(
    (c: any) => c.user.id === authStore.user!.id
  )
  return !!collab
})

// Condition pour réduire la description (collaborateurs ou utilisateurs ayant postulé)
const shouldReduceDescription = computed(() => {
  // Si c'est un collaborateur
  if (canViewVolunteersTable.value) return true
  // Si l'utilisateur a déjà postulé
  if (volunteersInfo.value?.myApplication) return true
  return false
})

// Condition pour gérer les bénévoles (accepter/refuser candidatures)
const canManageVolunteers = computed(() => {
  if (!authStore.user || !edition.value) return false
  // Super Admin en mode admin
  if (authStore.isAdminModeActive) return true
  // Créateur de l'édition
  if (edition.value.creatorId === authStore.user.id) return true
  // Auteur de la convention
  if (edition.value.convention?.authorId === authStore.user.id) return true
  // Collaborateur avec droit global de gérer les bénévoles
  const collab = edition.value.convention?.collaborators?.find(
    (c: any) => c.user.id === authStore.user!.id
  )
  if (!collab) return false
  const rights = collab.rights || {}
  if (rights.manageVolunteers) return true
  // Collaborateur avec droit spécifique à cette édition
  const perEdition = (collab as any).perEdition || []
  const editionPerm = perEdition.find((p: any) => p.editionId === edition.value!.id)
  return editionPerm?.canManageVolunteers || false
})

// Ancien canManageEdition gardé pour compatibilité avec le bouton "Gérer"
const canManageEdition = computed(() => {
  if (!authStore.user || !edition.value) return false
  // Super Admin en mode admin
  if (authStore.isAdminModeActive) return true
  if (edition.value.creatorId === authStore.user.id) return true
  const collab = edition.value.convention?.collaborators?.find(
    (c: any) => c.user.id === authStore.user!.id
  )
  if (!collab) return false
  const rights = collab.rights || {}
  return !!(
    rights.editAllEditions ||
    rights.deleteAllEditions ||
    rights.manageCollaborators ||
    rights.editConvention
  )
})

// Volunteer logic reused
interface VolunteerApplication {
  id: number
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
}
interface VolunteerInfo {
  open: boolean
  description?: string
  mode: 'INTERNAL' | 'EXTERNAL'
  externalUrl?: string
  counts: Record<string, number>
  myApplication: VolunteerApplication | null
  askDiet?: boolean
  askAllergies?: boolean
  askTimePreferences?: boolean
  askTeamPreferences?: boolean
  askPets?: boolean
  askMinors?: boolean
  askVehicle?: boolean
  askCompanion?: boolean
  askAvoidList?: boolean
  askSkills?: boolean
  askExperience?: boolean
  askSetup?: boolean
  askTeardown?: boolean
  setupStartDate?: string
  teardownEndDate?: string
  teams?: { name: string; slots?: number }[]
}
const volunteersInfo = ref<VolunteerInfo | null>(null)
const volunteersDescriptionHtml = ref('')
const showFullDescription = ref(false)
// Computed simple pour le mode afin d'éviter des cascades de types lourdes
const volunteersMode = computed<'INTERNAL' | 'EXTERNAL' | null>(
  () => volunteersInfo.value?.mode || null
)
// Références de gestion (édition supprimée sur page publique)
// const volunteersLoadingAction = ref(false) // supprimé
// const volunteersSaving = ref(false) // supprimé
const volunteersApplying = ref(false)
const volunteersWithdrawing = ref(false)
// Suppression édition publique : editingVolunteers retiré
const showApplyModal = ref(false)

// Modal candidature helpers
// Variables du formulaire déplacées dans EditionVolunteerApplicationModal
const volunteerStatusColor = (s: string) =>
  s === 'PENDING' ? 'warning' : s === 'ACCEPTED' ? 'success' : 'error'
const volunteerStatusLabel = (s: string) =>
  s === 'PENDING'
    ? t('editions.volunteers.status_pending')
    : s === 'ACCEPTED'
      ? t('editions.volunteers.status_accepted')
      : s === 'REJECTED'
        ? t('editions.volunteers.status_rejected')
        : s
const fetchVolunteersInfo = async () => {
  try {
    volunteersInfo.value = (await $fetch(`/api/editions/${editionId}/volunteers/info`)) as any
    if (volunteersInfo.value?.description) {
      volunteersDescriptionHtml.value = await markdownToHtml(volunteersInfo.value.description)
    }
  } catch {
    /* silent */
  }
}
await fetchVolunteersInfo()

// Fonctions d'édition/gestion supprimées de la page publique
const applyAsVolunteer = async (formData?: any) => {
  volunteersApplying.value = true
  try {
    const res: any = await $fetch(`/api/editions/${editionId}/volunteers/apply`, {
      method: 'POST',
      body: {
        motivation: formData?.motivation?.trim() || undefined,
        phone: formData?.phone?.trim() || undefined,
        prenom: (authStore.user as any)?.prenom
          ? undefined
          : formData?.firstName?.trim() || undefined,
        nom: (authStore.user as any)?.nom ? undefined : formData?.lastName?.trim() || undefined,
        dietaryPreference:
          volunteersInfo.value?.askDiet &&
          formData?.dietPreference !== 'NONE' &&
          formData?.dietPreference
            ? formData.dietPreference
            : undefined,
        allergies:
          volunteersInfo.value?.askAllergies && formData?.allergies?.trim()
            ? formData.allergies.trim()
            : undefined,
        timePreferences:
          volunteersInfo.value?.askTimePreferences && formData?.timePreferences?.length > 0
            ? formData.timePreferences
            : undefined,
        teamPreferences:
          volunteersInfo.value?.askTeamPreferences && formData?.teamPreferences?.length > 0
            ? formData.teamPreferences
            : undefined,
        hasPets: volunteersInfo.value?.askPets ? formData?.hasPets || undefined : undefined,
        petsDetails:
          volunteersInfo.value?.askPets && formData?.hasPets && formData?.petsDetails?.trim()
            ? formData.petsDetails.trim()
            : undefined,
        hasMinors: volunteersInfo.value?.askMinors ? formData?.hasMinors || undefined : undefined,
        minorsDetails:
          volunteersInfo.value?.askMinors && formData?.hasMinors && formData?.minorsDetails?.trim()
            ? formData.minorsDetails.trim()
            : undefined,
        hasVehicle: volunteersInfo.value?.askVehicle
          ? formData?.hasVehicle || undefined
          : undefined,
        vehicleDetails:
          volunteersInfo.value?.askVehicle &&
          formData?.hasVehicle &&
          formData?.vehicleDetails?.trim()
            ? formData.vehicleDetails.trim()
            : undefined,
        companionName:
          volunteersInfo.value?.askCompanion && formData?.companionName?.trim()
            ? formData.companionName.trim()
            : undefined,
        avoidList:
          volunteersInfo.value?.askAvoidList && formData?.avoidList?.trim()
            ? formData.avoidList.trim()
            : undefined,
        skills:
          volunteersInfo.value?.askSkills && formData?.skills?.trim()
            ? formData.skills.trim()
            : undefined,
        hasExperience: volunteersInfo.value?.askExperience ? formData?.hasExperience : undefined,
        experienceDetails:
          volunteersInfo.value?.askExperience &&
          formData?.hasExperience &&
          formData?.experienceDetails?.trim()
            ? formData.experienceDetails.trim()
            : undefined,
        setupAvailability: volunteersInfo.value?.askSetup ? formData?.setupAvailability : undefined,
        teardownAvailability: volunteersInfo.value?.askTeardown
          ? formData?.teardownAvailability
          : undefined,
        eventAvailability: formData?.eventAvailability || undefined,
        arrivalDateTime: formData?.arrivalDateTime || undefined,
        departureDateTime: formData?.departureDateTime || undefined,
      },
    } as any)
    if (res?.application && volunteersInfo.value)
      volunteersInfo.value.myApplication = res.application

    // Mettre à jour les infos utilisateur si nécessaire
    if (formData?.phone?.trim()) (authStore.user as any).phone = formData.phone.trim()
    if (!(authStore.user as any)?.prenom && formData?.firstName?.trim())
      (authStore.user as any).prenom = formData.firstName.trim()
    if (!(authStore.user as any)?.nom && formData?.lastName?.trim())
      (authStore.user as any).nom = formData.lastName.trim()

    showApplyModal.value = false
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || t('common.error'), color: 'error' })
  } finally {
    volunteersApplying.value = false
  }
}
const withdrawApplication = async () => {
  volunteersWithdrawing.value = true
  try {
    await $fetch(`/api/editions/${editionId}/volunteers/apply`, { method: 'DELETE' } as any)
    if (volunteersInfo.value) volunteersInfo.value.myApplication = null
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || t('common.error'), color: 'error' })
  } finally {
    volunteersWithdrawing.value = false
  }
}

// Variables pour génération informations restauration
const selectedCateringDate = ref<string | undefined>(undefined)
const generatingCateringPdf = ref(false)

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

    while (currentDate.toISOString().split('T')[0] < startDate.toISOString().split('T')[0]) {
      const dateValue = currentDate.toISOString().split('T')[0]
      options.push({
        label: `${formatDate(currentDate)} (Montage)`,
        value: dateValue,
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }
  }

  // Ajouter les jours de l'événement principal
  const currentEventDate = new Date(startDate)
  while (currentEventDate <= endDate) {
    options.push({
      label: formatDate(currentEventDate),
      value: currentEventDate.toISOString().split('T')[0],
    })
    currentEventDate.setDate(currentEventDate.getDate() + 1)
  }

  // Ajouter les jours de démontage si définis
  if (volunteersInfo.value?.teardownEndDate) {
    const teardownEnd = new Date(volunteersInfo.value.teardownEndDate)
    const currentDate = new Date(endDate)
    currentDate.setDate(currentDate.getDate() + 1)

    while (currentDate.toISOString().split('T')[0] <= teardownEnd.toISOString().split('T')[0]) {
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
    yPosition += 15

    // Type de date
    doc.setFontSize(12)
    const dateTypeLabel =
      (cateringData as any).dateType === 'setup'
        ? 'Montage'
        : (cateringData as any).dateType === 'teardown'
          ? 'Démontage'
          : 'Événement'
    doc.text(`Type: ${dateTypeLabel}`, 20, yPosition)
    yPosition += 20

    // Traiter chaque créneau
    const timeSlotLabels = {
      morning: 'MATIN',
      noon: 'MIDI',
      evening: 'SOIR',
    }

    const dietaryLabels = {
      NONE: 'Aucun régime spécial',
      VEGETARIAN: 'Végétarien',
      VEGAN: 'Végétalien',
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
        for (const diet of dietOrder) {
          if (slotData.dietaryCounts[diet]) {
            const label = dietaryLabels[diet as keyof typeof dietaryLabels] || diet
            doc.text(`  • ${label}: ${slotData.dietaryCounts[diet]} personne(s)`, 30, yPosition)
            yPosition += 6
          }
        }
      }

      // Liste des allergies
      if (slotData.allergies.length > 0) {
        yPosition += 3
        doc.text('Allergies:', 25, yPosition)
        yPosition += 6

        for (const allergy of slotData.allergies) {
          const name =
            allergy.volunteer.prenom && allergy.volunteer.nom
              ? `${allergy.volunteer.prenom} ${allergy.volunteer.nom}`
              : allergy.volunteer.pseudo

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
      title: e?.statusMessage || t('common.error'),
      color: 'error',
    })
  } finally {
    generatingCateringPdf.value = false
  }
}

// Gestion ouverture / fermeture modal candidature
const openApplyModal = () => {
  showApplyModal.value = true
}
const closeApplyModal = () => {
  showApplyModal.value = false
}

// Référence au composant de notifications
const notificationsListRef = ref()
</script>
