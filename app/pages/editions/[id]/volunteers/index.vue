<template>
  <div v-if="edition">
    <EditionHeader :edition="edition" current-page="volunteers" />

    <div class="space-y-6">
      <ClientOnly>
        <!-- Planning Card - Visible seulement pour les bénévoles acceptés -->
        <EditionVolunteerPlanningCard
          v-if="
            authStore.isAuthenticated &&
            myApplication?.status === 'ACCEPTED' &&
            volunteersMode === 'INTERNAL'
          "
          :edition="edition"
          :can-manage-volunteers="false"
          :current-user-id="authStore.user?.id"
          :format-date="formatDate"
          :format-date-time-range="formatDateTimeRange"
          @slot-click="openSlotDetailsModal"
        />

        <!-- Carte "Mes créneaux" - Visible pour les bénévoles acceptés -->
        <EditionVolunteerMySlotsCard
          v-if="
            authStore.isAuthenticated &&
            myApplication?.status === 'ACCEPTED' &&
            volunteersMode === 'INTERNAL'
          "
          :edition-id="editionId"
          :user-id="authStore.user?.id"
        />

        <!-- Carte "Mes équipes" - Visible pour les leaders d'équipes -->
        <EditionVolunteerMyTeamsCard
          v-if="
            authStore.isAuthenticated &&
            myApplication?.status === 'ACCEPTED' &&
            volunteersMode === 'INTERNAL' &&
            myApplication?.teamAssignments?.length > 0
          "
          :edition-id="editionId"
          :team-assignments="myApplication.teamAssignments"
        />
      </ClientOnly>

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
          <ClientOnly>
            <!-- Candidature existante (affichée en premier si l'utilisateur a postulé) -->
            <div v-if="authStore.isAuthenticated && volunteersMode === 'INTERNAL' && myApplication">
              <UCard
                variant="subtle"
                class="border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/40"
              >
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <h4 class="text-sm font-semibold flex items-center gap-1">
                      <UIcon name="i-heroicons-user" class="text-primary-500" />
                      {{ t('editions.volunteers.my_application_title') }}
                    </h4>
                    <UBadge
                      :color="volunteerStatusColor(myApplication.status)"
                      variant="soft"
                      class="uppercase"
                    >
                      {{ volunteerStatusLabel(myApplication.status) }}
                    </UBadge>
                  </div>
                  <div class="text-xs space-y-1">
                    <span
                      v-if="myApplication.status === 'PENDING'"
                      class="block text-gray-600 dark:text-gray-400"
                      >{{ t('editions.volunteers.my_application_pending') }}</span
                    >
                    <span
                      v-else-if="myApplication.status === 'ACCEPTED'"
                      class="block text-gray-600 dark:text-gray-400"
                      >{{ t('editions.volunteers.my_application_accepted') }}</span
                    >
                    <span
                      v-else-if="myApplication.status === 'REJECTED'"
                      class="block text-gray-600 dark:text-gray-400"
                      >{{ t('editions.volunteers.my_application_rejected') }}</span
                    >
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <UButton
                      color="primary"
                      variant="soft"
                      icon="i-heroicons-list-bullet"
                      :to="'/my-volunteer-applications'"
                    >
                      {{
                        t('editions.volunteers.view_all_applications') || 'Voir mes candidatures'
                      }}
                    </UButton>
                    <UButton
                      v-if="myApplication.status === 'PENDING'"
                      size="xs"
                      color="primary"
                      variant="soft"
                      icon="i-heroicons-pencil"
                      @click="openEditApplicationModal"
                    >
                      {{ t('editions.volunteers.edit_application') }}
                    </UButton>
                    <UButton
                      v-if="myApplication.status === 'PENDING'"
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
              </UCard>
            </div>
          </ClientOnly>

          <!-- Description -->
          <div>
            <div class="prose dark:prose-invert max-w-none text-sm">
              <template v-if="volunteersInfo?.description">
                <!-- Contenu HTML déjà nettoyé via markdownToHtml (rehype-sanitize) -->
                <!-- eslint-disable vue/no-v-html -->
                <div
                  :class="[
                    shouldReduceDescription && !showFullDescription ? 'overflow-hidden' : '',
                  ]"
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
                <!-- eslint-enable vue/no-v-html -->
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

          <ClientOnly>
            <!-- Bouton pour postuler (seulement si l'utilisateur n'a pas encore postulé) -->
            <div
              v-if="authStore.isAuthenticated && volunteersMode === 'INTERNAL' && !myApplication"
            >
              <div
                v-if="!volunteersInfo?.open"
                class="text-sm text-gray-500 flex items-center gap-2"
              >
                <UIcon name="i-heroicons-lock-closed" />
                {{ t('editions.volunteers.closed_message') }}
              </div>
              <div v-else>
                <UCard
                  variant="subtle"
                  class="border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/40"
                >
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
                </UCard>
              </div>
            </div>
            <div
              v-else-if="!authStore.isAuthenticated && volunteersMode === 'INTERNAL'"
              class="text-sm text-gray-500"
            >
              {{ t('editions.volunteers.login_prompt') }}
            </div>
          </ClientOnly>
        </div>
      </UCard>

      <!-- Modal candidature bénévole -->
      <EditionVolunteerApplicationModal
        v-if="showApplyModal"
        v-model="showApplyModal"
        :volunteers-info="volunteersInfo"
        :edition="edition"
        :user="authStore.user"
        :applying="volunteersApplying"
        @close="closeApplyModal"
        @submit="applyAsVolunteer"
      />

      <!-- Modal édition de candidature -->
      <EditionVolunteerApplicationModal
        v-if="showEditApplicationModal"
        v-model="showEditApplicationModal"
        :volunteers-info="volunteersInfo"
        :edition="edition"
        :user="authStore.user"
        :applying="false"
        :is-editing="true"
        :existing-application="myApplication"
        @close="closeEditApplicationModal"
        @update="updateVolunteerApplication"
      />

      <!-- Modal détails de créneau (lecture seule) -->
      <EditionVolunteerPlanningSlotDetailsModal
        v-if="showSlotDetailsModal && selectedSlot"
        v-model="showSlotDetailsModal"
        :time-slot="selectedSlot"
        :teams="(fetchedTeams as any) || []"
      />
    </div>
  </div>
  <div v-else>
    <p>{{ t('editions.loading_details') }}</p>
  </div>
</template>

<script setup lang="ts">
// Vue & libs
import { ref, computed, nextTick } from 'vue'
import { useRoute } from 'vue-router'

// App components & stores
import { useVolunteerSettings } from '~/composables/useVolunteerSettings'
import { useVolunteerTeams } from '~/composables/useVolunteerTeams'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { requiresEmergencyContact } from '~/utils/allergy-severity'
import { getEditionDisplayName } from '~/utils/editionName'
import { markdownToHtml } from '~/utils/markdown'
import {
  updateVolunteerApplication as updateVolunteerApplicationAPI,
  submitVolunteerApplication,
  withdrawVolunteerApplication,
} from '~/utils/volunteer-application-api'

const { t } = useI18n()
const { formatDateTimeRange, formatDate } = useDateFormat()
const toast = useToast()
const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const editionId = parseInt(route.params.id as string)

// Utiliser le composable pour les paramètres des bénévoles
const { settings: volunteersInfo, fetchSettings: fetchVolunteersSettings } =
  useVolunteerSettings(editionId)

// Récupérer les équipes pour la modal de créneau
const editionIdComputed = computed(() => editionId)
const { teams: fetchedTeams } = useVolunteerTeams(editionIdComputed)

// Candidature de l'utilisateur
const myApplication = ref<any>(null)

// Modal de détails de créneau
const showSlotDetailsModal = ref(false)
const selectedSlot = ref<any>(null)

// Expose constants early (avant tout await)
defineExpose({})
await editionStore.fetchEditionById(editionId)
const edition = computed(() => editionStore.getEditionById(editionId))

// Métadonnées SEO avec le nom de l'édition
const editionName = computed(() => (edition.value ? getEditionDisplayName(edition.value) : ''))

const editionDateRange = computed(() =>
  edition.value ? formatDateTimeRange(edition.value.startDate, edition.value.endDate) : ''
)

const seoTitle = computed(() => {
  if (!edition.value) return 'Bénévolat'
  return `Bénévolat - ${editionName.value}`
})

const seoDescription = computed(() => {
  if (!edition.value) return ''
  const name = editionName.value
  const date = editionDateRange.value
  const location = edition.value.city || ''
  return `Rejoignez l'équipe de bénévoles pour ${name}. Participez à l'organisation de cet événement de jonglerie ${date} à ${location}.`
})

useSeoMeta({
  title: seoTitle,
  description: seoDescription,
})

// Condition pour réduire la description (maintenant toujours false pour afficher entièrement)
const shouldReduceDescription = computed(() => {
  // Afficher toujours la description entièrement
  return false
})

// Ancien canManageEdition gardé pour compatibilité avec le bouton "Gérer"
const canManageEdition = computed(() => {
  if (!authStore.user || !edition.value) return false
  // Super Admin en mode admin
  if (authStore.isAdminModeActive) return true
  if (edition.value.creatorId && edition.value.creatorId === authStore.user.id) return true
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
interface _VolunteerApplication {
  id: number
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
}
// Removed VolunteerInfo interface - now using composable
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
const showEditApplicationModal = ref(false)

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
const fetchMyApplication = async () => {
  if (!authStore.isAuthenticated) {
    myApplication.value = null
    return
  }

  try {
    myApplication.value = await $fetch(`/api/editions/${editionId}/volunteers/my-application`)
  } catch {
    myApplication.value = null
  }
}

const fetchVolunteersInfo = async () => {
  try {
    await Promise.all([fetchVolunteersSettings(), fetchMyApplication()])
    if (volunteersInfo.value?.description) {
      volunteersDescriptionHtml.value = await markdownToHtml(volunteersInfo.value.description)
    }
  } catch {
    /* silent */
  }
}
await fetchVolunteersInfo()

// Fonctions d'édition/gestion supprimées de la page publique

// Fonction helper pour transformer les données du formulaire selon la configuration de l'édition
const mapFormDataToApplicationData = (formData: any) => {
  return {
    // Données personnelles
    phone: formData?.phone?.trim() || undefined,
    firstName: (authStore.user as any)?.prenom
      ? undefined
      : formData?.firstName?.trim() || undefined,
    lastName: (authStore.user as any)?.nom ? undefined : formData?.lastName?.trim() || undefined,

    // Motivation
    motivation: formData?.motivation?.trim() || undefined,

    // Régime et allergies
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
    allergySeverity:
      volunteersInfo.value?.askAllergies && formData?.allergies?.trim() && formData?.allergySeverity
        ? formData.allergySeverity
        : undefined,

    // Contact d'urgence
    emergencyContactName:
      (volunteersInfo.value?.askEmergencyContact ||
        (formData?.allergySeverity && requiresEmergencyContact(formData.allergySeverity))) &&
      formData?.emergencyContactName?.trim()
        ? formData.emergencyContactName.trim()
        : undefined,
    emergencyContactPhone:
      (volunteersInfo.value?.askEmergencyContact ||
        (formData?.allergySeverity && requiresEmergencyContact(formData.allergySeverity))) &&
      formData?.emergencyContactPhone?.trim()
        ? formData.emergencyContactPhone.trim()
        : undefined,

    // Préférences
    timePreferences:
      volunteersInfo.value?.askTimePreferences && formData?.timePreferences?.length > 0
        ? formData.timePreferences
        : undefined,
    teamPreferences:
      volunteersInfo.value?.askTeamPreferences && formData?.teamPreferences?.length > 0
        ? formData.teamPreferences
        : undefined,

    // Informations personnelles
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
    hasVehicle: volunteersInfo.value?.askVehicle ? formData?.hasVehicle || undefined : undefined,
    vehicleDetails:
      volunteersInfo.value?.askVehicle && formData?.hasVehicle && formData?.vehicleDetails?.trim()
        ? formData.vehicleDetails.trim()
        : undefined,

    // Covoiturage
    companionName:
      volunteersInfo.value?.askCompanion && formData?.companionName?.trim()
        ? formData.companionName.trim()
        : undefined,
    avoidList:
      volunteersInfo.value?.askAvoidList && formData?.avoidList?.trim()
        ? formData.avoidList.trim()
        : undefined,

    // Compétences et expérience
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

    // Disponibilités
    setupAvailability: volunteersInfo.value?.askSetup ? formData?.setupAvailability : undefined,
    teardownAvailability: volunteersInfo.value?.askTeardown
      ? formData?.teardownAvailability
      : undefined,
    eventAvailability: formData?.eventAvailability || undefined,
    arrivalDateTime: formData?.arrivalDateTime || undefined,
    departureDateTime: formData?.departureDateTime || undefined,
  }
}

const applyAsVolunteer = async (formData?: any) => {
  volunteersApplying.value = true
  try {
    // Transformer les données du formulaire selon la configuration de l'édition
    const applicationData = mapFormDataToApplicationData(formData)

    // Appeler l'API via l'utilitaire
    await submitVolunteerApplication(editionId, applicationData)

    // Mettre à jour les infos utilisateur si nécessaire
    if (formData?.phone?.trim()) (authStore.user as any).phone = formData.phone.trim()
    if (!(authStore.user as any)?.prenom && formData?.firstName?.trim())
      (authStore.user as any).prenom = formData.firstName.trim()
    if (!(authStore.user as any)?.nom && formData?.lastName?.trim())
      (authStore.user as any).nom = formData.lastName.trim()

    // Rafraîchir les données pour mettre à jour l'affichage de la page
    await fetchVolunteersInfo()

    // Attendre que le DOM soit mis à jour
    await nextTick()

    showApplyModal.value = false
  } catch (e: any) {
    toast.add({ title: e?.message || t('common.error'), color: 'error' })
  } finally {
    volunteersApplying.value = false
  }
}
const withdrawApplication = async () => {
  volunteersWithdrawing.value = true
  try {
    await withdrawVolunteerApplication(editionId)

    // Rafraîchir les données pour mettre à jour l'affichage de la page
    await fetchVolunteersInfo()

    // Attendre que le DOM soit mis à jour
    await nextTick()
  } catch (e: any) {
    toast.add({ title: e?.message || t('common.error'), color: 'error' })
  } finally {
    volunteersWithdrawing.value = false
  }
}

// Gestion ouverture / fermeture modal candidature
const openApplyModal = () => {
  showApplyModal.value = true
}
const closeApplyModal = () => {
  showApplyModal.value = false
}

// Gestion ouverture / fermeture modal édition de candidature
const openEditApplicationModal = () => {
  showEditApplicationModal.value = true
}
const closeEditApplicationModal = () => {
  showEditApplicationModal.value = false
}

// Fonction pour mettre à jour une candidature existante
const updateVolunteerApplication = async (data: any) => {
  try {
    // Appeler l'API pour sauvegarder les modifications via l'utilitaire
    await updateVolunteerApplicationAPI(editionId, data)

    // Rafraîchir les données pour mettre à jour l'affichage
    await fetchVolunteersInfo()

    // Attendre que le DOM soit mis à jour
    await nextTick()

    // Fermer la modal
    closeEditApplicationModal()

    // Afficher un message de succès
    toast.add({
      title: t('editions.volunteers.application_updated'),
      description: t('editions.volunteers.changes_saved_successfully'),
      color: 'success',
    })
  } catch (error: any) {
    toast.add({
      title: t('common.error'),
      description: error?.message || t('editions.volunteers.update_error'),
      color: 'error',
    })
  }
}

// Fonction pour ouvrir la modal de détails du créneau
const openSlotDetailsModal = (slot: any) => {
  // Préparer les données du créneau pour la modal
  // On passe directement les assignations déjà chargées par l'API
  selectedSlot.value = {
    id: slot.id,
    editionId: editionId,
    title: slot.title,
    description: slot.description,
    teamId: slot.teamId,
    start: slot.start,
    end: slot.end,
    maxVolunteers: slot.maxVolunteers,
    assignedVolunteers: slot.assignedVolunteers,
    assignedVolunteersList: slot.assignments || [], // Passer les assignations déjà chargées
    color: slot.color,
  }
  showSlotDetailsModal.value = true
}
</script>
