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
      <!-- Titre de la page. Empilé sur mobile : côte à côte, le bouton gardait sa largeur
           propre et réduisait le titre et la note à des colonnes de deux ou trois mots. -->
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="space-y-2 sm:flex-1">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UIcon
              name="i-heroicons-clipboard-document-list"
              class="text-green-600 dark:text-green-400"
            />
            {{ t('volunteers.management_title') }}
          </h1>
          <p
            v-if="volunteersMode === 'INTERNAL'"
            :class="`text-sm ${volunteerConfig.textClass} ${volunteerConfig.darkTextClass} flex items-start gap-2`"
          >
            <UIcon
              name="i-heroicons-information-circle"
              :class="`${volunteerConfig.iconColorClass} mt-0.5 shrink-0`"
              size="16"
            />
            {{
              canManageVolunteers ? t('volunteers.admin_only_note') : t('volunteers.view_only_note')
            }}
          </p>
        </div>
        <UButton
          v-if="canManageVolunteers && volunteersMode === 'INTERNAL'"
          color="primary"
          icon="i-heroicons-user-plus"
          class="w-full justify-center sm:w-auto"
          @click="showAddVolunteerModal = true"
        >
          {{ t('edition.volunteers.add_volunteer') }}
        </UButton>
      </div>

      <div class="space-y-6">
        <div v-if="canViewVolunteersTable">
          <!-- Note visibilité + séparation avant statistiques & tableau organisateur -->
          <div v-if="volunteersMode === 'INTERNAL'">
            <!-- Statistiques -->
            <div v-if="volunteersInfo" class="mt-3 mb-3 flex flex-wrap gap-3">
              <UBadge color="neutral" variant="soft"
                >{{ t('common.total') }}: {{ volunteersInfo.counts.total || 0 }}</UBadge
              >
              <UBadge color="warning" variant="soft"
                >{{ t('volunteers.status_pending') }}:
                {{ volunteersInfo.counts.PENDING || 0 }}</UBadge
              >
              <UBadge color="success" variant="soft"
                >{{ t('volunteers.status_accepted') }}:
                {{ volunteersInfo.counts.ACCEPTED || 0 }}</UBadge
              >
              <UBadge color="error" variant="soft"
                >{{ t('volunteers.status_rejected') }}:
                {{ volunteersInfo.counts.REJECTED || 0 }}</UBadge
              >
            </div>
          </div>

          <div class="space-y-3">
            <template v-if="volunteersMode === 'INTERNAL'">
              <div class="space-y-4">
                <!-- Tableau des bénévoles avec filtres -->
                <EditionVolunteerTable
                  v-if="isVolunteersDataReady"
                  ref="volunteerTableRef"
                  :volunteers-info="volunteersInfo"
                  :edition-id="editionId"
                  :edition="edition"
                  :can-manage-volunteers="canManageVolunteers"
                  @refresh-volunteers-info="fetchVolunteersInfo"
                  @refresh-team-assignments="fetchTeamAssignments"
                  @open-meals-modal="handleOpenMealsModal"
                />
                <div v-else class="flex justify-center py-8">
                  <p class="text-gray-500">{{ $t('common.loading') }}...</p>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="text-center py-8">
                <UIcon name="i-heroicons-link" class="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p class="text-gray-600 dark:text-gray-400 text-sm">
                  {{ t('volunteers.external_mode_note') }}
                </p>
              </div>
            </template>
          </div>
        </div>


        <!-- Message si pas les permissions -->
        <UCard v-if="!canViewVolunteersTable && !editionStore.loading && authStore.isAuthenticated">
          <div class="text-center py-12">
            <UIcon name="i-heroicons-lock-closed" class="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 class="text-xl font-semibold mb-2">{{ $t('pages.access_denied.title') }}</h2>
            <p class="text-gray-600 dark:text-gray-400">
              {{ $t('pages.access_denied.volunteers_description') }}
            </p>
          </div>
        </UCard>

      </div>
    </div>

    <!-- Modale d'ajout de bénévole -->
    <VolunteersAddVolunteerModal
      v-model:open="showAddVolunteerModal"
      :edition-id="editionId"
      @volunteer-added="handleVolunteerAdded"
    />

    <!-- Modal de gestion des repas -->
    <VolunteersMealsModal
      v-if="edition?.mealsEnabled && selectedVolunteerForMeals"
      v-model="showVolunteerMealsModal"
      :edition-id="editionId"
      :volunteer="selectedVolunteerForMeals"
      @meals-saved="handleMealsUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

import { useVolunteerSettings, useVolunteerTeams } from '#imports'

// Utiliser le composable pour obtenir la configuration des bénévoles
const { getParticipantTypeConfig } = useParticipantTypes()
const volunteerConfig = getParticipantTypeConfig('volunteer')

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// Utiliser le composable pour les paramètres des bénévoles
const { settings: volunteersInfo, fetchSettings: fetchVolunteersInfo } =
  useVolunteerSettings(editionId)

// Variables pour le tableau des bénévoles
const volunteerTableRef = ref<any>(null)

// Mode des bénévoles
const volunteersMode = computed(() => volunteersInfo.value?.mode || 'INTERNAL')

// Computed pour vérifier que toutes les données nécessaires sont chargées
const isVolunteersDataReady = computed(() => {
  return !!(volunteersInfo.value && typeof volunteersInfo.value.askDiet !== 'undefined')
})

// Récupération des équipes et des assignations pour la nouvelle répartition
const { fetchTeams: fetchVolunteerTeams } = useVolunteerTeams(editionId)
const teamAssignments = ref<any[]>([])
const acceptedVolunteers = ref<any[]>([])
const draggedVolunteer = ref<any>(null)
const dragOverTeam = ref<string | null>(null)
const sourceTeamId = ref<string | null>(null)
const targetTeamId = ref<string | null>(null)
const showMoveModal = ref(false)
const showAddVolunteerModal = ref(false)
const showVolunteerMealsModal = ref(false)
const selectedVolunteerForMeals = ref<any>(null)
const isMobile = ref(false)

// Fonction pour récupérer les assignations d'équipes
// Utilise une route dédiée sans pagination pour récupérer tous les bénévoles acceptés
const fetchTeamAssignments = async () => {
  try {
    const applications = await $fetch(`/api/editions/${editionId}/volunteers/team-assignments`)

    acceptedVolunteers.value = applications
    teamAssignments.value = applications.filter(
      (app: any) => app.teamAssignments && app.teamAssignments.length > 0
    )
  } catch (error) {
    console.error('Failed to fetch team assignments:', error)
  }
}

// Computed pour la répartition par équipes
/**
 * Organisateurs de l'édition et leurs équipes. Endpoint dédié : celui des organisateurs exige un
 * droit que le responsable du bénévolat n'a pas, et celui des équipes est ouvert en lecture
 * publique.
 */
interface OrganisateurBenevolat {
  editionOrganizerId: number
  teamIds: string[]
  /** Parmi ses équipes, celles qu'il dirige. */
  leaderTeamIds: string[]
  user: { id: number; pseudo: string; prenom?: string | null; nom?: string | null }
}

const organisateurs = ref<OrganisateurBenevolat[]>([])

const chargerOrganisateursEquipes = async () => {
  if (!edition.value?.volunteersOrganizersInTeams) {
    organisateurs.value = []
    return
  }
  try {
    const reponse = await $fetch<{ data?: { organizers?: OrganisateurBenevolat[] } }>(
      `/api/editions/${editionId}/volunteers/organizers`
    )
    organisateurs.value = reponse?.data?.organizers ?? []
  } catch (error) {
    // Un échec ici ne doit pas priver la page de sa répartition : on la laisse sans les
    // organisateurs plutôt que de la faire tomber.
    console.error('Failed to fetch volunteer organizers:', error)
    organisateurs.value = []
  }
}

// L'option se ferme depuis une autre page : la répartition doit suivre sans rechargement.
watch(() => edition.value?.volunteersOrganizersInTeams, chargerOrganisateursEquipes)

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  // La gestion des bénévoles exige le droit dédié (éditer l'édition ne suffit pas).
  return canManageVolunteers.value || authStore.user?.id === edition.value?.creatorId
})

// Permissions calculées
const canManageVolunteers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageVolunteers(edition.value, authStore.user.id)
})

// Condition pour voir le tableau des bénévoles
const canViewVolunteersTable = computed(() => {
  if (!authStore.user || !edition.value) return false
  // Super Admin en mode admin
  if (authStore.isAdminModeActive) return true
  // Créateur de l'édition
  if (edition.value.creatorId && edition.value.creatorId === authStore.user.id) return true
  // Auteur de la convention
  if (edition.value.convention?.authorId && edition.value.convention.authorId === authStore.user.id)
    return true
  // Organisateur
  const collab = edition.value.convention?.organizers?.find(
    (c: any) => c.user.id === authStore.user!.id
  )
  return !!collab
})

// Détection du mobile
const checkIfMobile = () => {
  isMobile.value = window.innerWidth < 768 // Breakpoint md de Tailwind
}

// Fonction pour traiter les actions de déplacer/ajouter depuis la modal
const handleVolunteerAdded = async () => {
  toast.add({
    title: t('volunteers.volunteer_added_success'),
    color: 'success',
  })
  // Recharger les données
  await fetchVolunteersInfo()
  await fetchTeamAssignments()
  // Rafraîchir le tableau si la méthode existe
  if (volunteerTableRef.value?.refreshApplications) {
    await volunteerTableRef.value.refreshApplications()
  }
}

// Fonction pour ouvrir le modal de gestion des repas
const handleOpenMealsModal = (volunteer: any) => {
  selectedVolunteerForMeals.value = volunteer
  showVolunteerMealsModal.value = true
}

// Fonction après la mise à jour des repas
const handleMealsUpdated = async () => {
  // Rafraîchir le tableau si la méthode existe
  if (volunteerTableRef.value?.refreshApplications) {
    await volunteerTableRef.value.refreshApplications()
  }
}

// Watcher pour nettoyer les variables quand la modal se ferme
watch(showMoveModal, (newValue) => {
  if (!newValue) {
    // Nettoyer les variables quand la modal se ferme
    draggedVolunteer.value = null
    dragOverTeam.value = null
    sourceTeamId.value = null
    targetTeamId.value = null
  }
})

// Charger l'édition si nécessaire
onMounted(async () => {
  // Détecter si on est sur mobile
  checkIfMobile()
  window.addEventListener('resize', checkIfMobile)

  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
  // Charger les informations des bénévoles et les équipes en parallèle
  await Promise.all([fetchVolunteersInfo(), fetchVolunteerTeams(), chargerOrganisateursEquipes()])
  // Charger les assignations d'équipes (nécessite les équipes)
  await fetchTeamAssignments()
})

// Nettoyer le listener au démontage
onUnmounted(() => {
  window.removeEventListener('resize', checkIfMobile)
})

// Métadonnées de la page
useSeoMeta({
  title: 'Gestion des candidatures - ' + (edition.value?.name || 'Édition'),
  description: 'Gestion et traitement des candidatures de bénévoles',
  ogTitle: () => edition.value?.name || edition.value?.convention?.name || 'Convention',
})
</script>
