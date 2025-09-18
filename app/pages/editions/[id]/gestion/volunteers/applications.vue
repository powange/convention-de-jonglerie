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
          <UIcon name="i-heroicons-document-text" class="text-green-600 dark:text-green-400" />
          Gestion des candidatures
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Consulter et traiter les candidatures de bénévoles
        </p>
      </div>

      <!-- Contenu de la gestion des candidatures -->
      <div class="space-y-6">
        <!-- Gestion des candidatures -->
        <UCard v-if="canViewVolunteersTable" variant="soft">
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
                >{{ t('common.total') }}: {{ volunteersInfo.counts.total || 0 }}</UBadge
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
                <EditionVolunteerTable
                  v-if="isVolunteersDataReady"
                  ref="volunteerTableRef"
                  :volunteers-info="volunteersInfo"
                  :edition-id="editionId"
                  :can-manage-volunteers="canManageVolunteers"
                  @refresh-volunteers-info="fetchVolunteersInfo"
                  @refresh-team-assignments="fetchTeamAssignments"
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
                  {{ t('editions.volunteers.external_mode_note') }}
                </p>
              </div>
            </template>
          </div>
        </UCard>

        <!-- Répartition par équipes (nouveau système) -->
        <UCard
          v-if="
            canViewVolunteersTable && volunteersMode === 'INTERNAL' && volunteerTeams.length > 0
          "
          variant="soft"
        >
          <template #header>
            <div class="flex items-center justify-between">
              <div class="space-y-2">
                <h3 class="text-lg font-semibold flex items-center gap-2">
                  <UIcon name="i-heroicons-user-group" class="text-blue-600" />
                  Répartition par équipes
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  Répartition des bénévoles acceptés dans les équipes
                </p>
              </div>
              <UButton
                :to="`/editions/${editionId}/gestion/volunteers/teams`"
                color="primary"
                variant="soft"
                size="sm"
                icon="i-heroicons-cog-6-tooth"
              >
                Gérer les équipes
              </UButton>
            </div>
          </template>

          <div
            v-if="teamDistribution.length === 0 && unassignedVolunteers.length === 0"
            class="text-center py-8"
          >
            <UIcon name="i-heroicons-user-group" class="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p class="text-gray-600 dark:text-gray-400 text-sm">
              Aucune assignation d'équipe trouvée
            </p>
            <p class="text-xs text-gray-500 mt-1">
              Les bénévoles acceptés apparaîtront ici une fois assignés à des équipes
            </p>
          </div>

          <div v-else class="space-y-4">
            <!-- Statistiques générales -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div class="flex items-center gap-3">
                  <UIcon name="i-heroicons-user-group" class="text-blue-600" size="24" />
                  <div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Total équipes</p>
                    <p class="text-xl font-semibold text-blue-600">{{ volunteerTeams.length }}</p>
                  </div>
                </div>
              </div>
              <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div class="flex items-center gap-3">
                  <UIcon name="i-heroicons-users" class="text-green-600" size="24" />
                  <div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Bénévoles assignés</p>
                    <p class="text-xl font-semibold text-green-600">{{ teamAssignments.length }}</p>
                  </div>
                </div>
              </div>
              <div class="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                <div class="flex items-center gap-3">
                  <UIcon
                    name="i-heroicons-exclamation-triangle"
                    class="text-orange-600"
                    size="24"
                  />
                  <div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Sans assignation</p>
                    <p class="text-xl font-semibold text-orange-600">
                      {{ unassignedVolunteers.length }}
                    </p>
                  </div>
                </div>
              </div>
              <div class="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <div class="flex items-center gap-3">
                  <UIcon name="i-heroicons-chart-bar" class="text-purple-600" size="24" />
                  <div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Assignations totales</p>
                    <p class="text-xl font-semibold text-purple-600">
                      {{ teamAssignments.reduce((total, app) => total + app.teams.length, 0) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Liste des bénévoles non assignés -->
            <div v-if="unassignedVolunteers.length > 0" class="space-y-4">
              <div
                class="border border-orange-200 dark:border-orange-700 rounded-lg overflow-hidden"
              >
                <div
                  class="px-4 py-3 border-l-4 border-l-orange-400 flex items-center justify-between bg-orange-50 dark:bg-orange-900/20"
                >
                  <div class="flex items-center gap-3">
                    <UIcon
                      name="i-heroicons-exclamation-triangle"
                      class="text-orange-600"
                      size="20"
                    />
                    <div>
                      <h4 class="font-medium text-gray-900 dark:text-white">
                        Bénévoles non assignés
                      </h4>
                      <p class="text-sm text-gray-600 dark:text-gray-400">
                        Ces bénévoles acceptés n'ont pas encore été assignés à une équipe. Vous
                        pouvez les glisser-déposer dans une équipe ci-dessous.
                      </p>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="text-sm font-medium">{{ unassignedVolunteers.length }} bénévole(s)</p>
                  </div>
                </div>

                <!-- Liste des bénévoles non assignés -->
                <div class="px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
                  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div
                      v-for="volunteer in unassignedVolunteers"
                      :key="volunteer.id"
                      draggable="true"
                      class="flex items-center gap-3 text-sm cursor-move hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded"
                      @dragstart="handleDragStart(volunteer)"
                      @dragend="handleDragEnd"
                    >
                      <UIcon name="i-heroicons-bars-3" class="text-gray-400" size="16" />
                      <UiUserAvatar :user="volunteer.user" size="sm" class="flex-shrink-0" />
                      <div class="min-w-0 flex-1">
                        <p class="text-gray-700 dark:text-gray-300 font-medium truncate">
                          {{ volunteer.user.prenom }} {{ volunteer.user.nom }}
                        </p>
                        <p class="text-xs text-gray-500 truncate">{{ volunteer.user.email }}</p>
                        <div
                          v-if="volunteer.teamPreferences && volunteer.teamPreferences.length > 0"
                          class="flex items-center gap-1 mt-1"
                        >
                          <UIcon name="i-heroicons-heart" class="text-red-500" size="12" />
                          <span class="text-xs text-gray-600 dark:text-gray-400">
                            Préf: {{ getTeamNamesFromPreferences(volunteer.teamPreferences) }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Liste des équipes avec leurs bénévoles -->
            <div class="space-y-4">
              <div
                v-for="team in teamDistribution"
                :key="team.id"
                class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-all"
                :class="{
                  'border-primary-500 bg-primary-50 dark:bg-primary-900/20':
                    dragOverTeam === team.id,
                  'opacity-50 cursor-not-allowed':
                    draggedVolunteer && !isTeamInVolunteerPreferences(draggedVolunteer, team.id),
                  'border-green-300 dark:border-green-600':
                    draggedVolunteer && isTeamInVolunteerPreferences(draggedVolunteer, team.id),
                }"
                @dragover.prevent="handleDragOver(team.id)"
                @dragleave="handleDragLeave"
                @drop="handleDrop(team.id)"
              >
                <div
                  class="px-4 py-3 border-l-4 flex items-center justify-between transition-colors"
                  :class="{
                    'bg-primary-100 dark:bg-primary-900/30': dragOverTeam === team.id,
                  }"
                  :style="{ borderLeftColor: team.color }"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-4 h-4 rounded-full" :style="{ backgroundColor: team.color }" />
                    <h4 class="font-medium text-gray-900 dark:text-white">{{ team.name }}</h4>
                  </div>
                  <div class="flex items-center gap-4">
                    <div class="text-right">
                      <p class="text-sm font-medium">{{ team.count }} bénévole(s)</p>
                      <p v-if="team.maxVolunteers" class="text-xs text-gray-500">
                        Max: {{ team.maxVolunteers }}
                        <span v-if="team.utilizationRate !== null" class="ml-1">
                          ({{ team.utilizationRate }}%)
                        </span>
                      </p>
                    </div>
                    <div v-if="team.utilizationRate !== null" class="w-16">
                      <div class="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          class="h-2 rounded-full transition-all"
                          :class="{
                            'bg-green-500': team.utilizationRate <= 80,
                            'bg-yellow-500':
                              team.utilizationRate > 80 && team.utilizationRate <= 100,
                            'bg-red-500': team.utilizationRate > 100,
                          }"
                          :style="{ width: Math.min(team.utilizationRate, 100) + '%' }"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Liste des bénévoles de cette équipe -->
                <div
                  v-if="team.volunteers.length > 0"
                  class="px-4 py-3 bg-gray-50 dark:bg-gray-800/50"
                >
                  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div
                      v-for="volunteer in team.volunteers"
                      :key="volunteer.id"
                      class="flex items-center gap-3 text-sm"
                    >
                      <UiUserAvatar :user="volunteer.user" size="sm" class="flex-shrink-0" />
                      <div class="min-w-0 flex-1">
                        <p class="text-gray-700 dark:text-gray-300 font-medium truncate">
                          {{ volunteer.user.prenom }} {{ volunteer.user.nom }}
                        </p>
                        <p class="text-xs text-gray-500 truncate">{{ volunteer.user.email }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Message si pas les permissions -->
        <UCard v-else>
          <div class="text-center py-12">
            <UIcon name="i-heroicons-lock-closed" class="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 class="text-xl font-semibold mb-2">Accès restreint</h2>
            <p class="text-gray-600 dark:text-gray-400">
              Vous n'avez pas les permissions nécessaires pour voir les candidatures de bénévoles.
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

import { useVolunteerTeams } from '~/composables/useVolunteerTeams'
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
}

// Variables pour les informations des bénévoles
const volunteersInfo = ref<VolunteerInfo | null>(null)
const volunteerTableRef = ref<any>(null)

// Mode des bénévoles
const volunteersMode = computed(() => edition.value?.volunteersMode || 'INTERNAL')

// Computed pour vérifier que toutes les données nécessaires sont chargées
const isVolunteersDataReady = computed(() => {
  return !!(volunteersInfo.value && typeof volunteersInfo.value.askDiet !== 'undefined')
})

// Récupération des équipes et des assignations pour la nouvelle répartition
const { teams: volunteerTeams } = useVolunteerTeams(editionId)
const teamAssignments = ref<any[]>([])
const acceptedVolunteers = ref<any[]>([])
const draggedVolunteer = ref<any>(null)
const dragOverTeam = ref<string | null>(null)

// Fonction pour récupérer les assignations d'équipes
const fetchTeamAssignments = async () => {
  try {
    const response = await $fetch(`/api/editions/${editionId}/volunteers/applications`, {
      query: { includeTeams: 'true', status: 'ACCEPTED' },
    })
    const applications = response.applications || response
    acceptedVolunteers.value = applications.filter((app: any) => app.status === 'ACCEPTED')
    teamAssignments.value = applications.filter(
      (app: any) => app.status === 'ACCEPTED' && app.teams && app.teams.length > 0
    )
  } catch (error) {
    console.error('Failed to fetch team assignments:', error)
  }
}

// Vérifier si une équipe est dans les préférences du bénévole
const isTeamInVolunteerPreferences = (volunteer: any, teamId: string): boolean => {
  if (!volunteer.teamPreferences) return false

  // teamPreferences est un tableau JSON avec les IDs ou noms des équipes préférées
  if (Array.isArray(volunteer.teamPreferences)) {
    // Trouver l'équipe par son ID
    const team = volunteerTeams.value.find((t) => t.id === teamId)
    if (!team) return false

    // Vérifier si l'ID ou le nom de l'équipe est dans les préférences
    return (
      volunteer.teamPreferences.includes(teamId) || volunteer.teamPreferences.includes(team.name)
    )
  }

  return false
}

// Convertir les IDs/noms d'équipes en noms lisibles
const getTeamNamesFromPreferences = (teamPreferences: string[]): string => {
  if (!teamPreferences || !Array.isArray(teamPreferences)) return ''

  const names = teamPreferences.map((pref) => {
    // Chercher d'abord par ID
    const teamById = volunteerTeams.value.find((t) => t.id === pref)
    if (teamById) return teamById.name

    // Si ce n'est pas un ID, c'est peut-être déjà un nom
    const teamByName = volunteerTeams.value.find((t) => t.name === pref)
    if (teamByName) return teamByName.name

    // Si on ne trouve pas l'équipe, retourner la préférence telle quelle
    return pref
  })

  return names.join(', ')
}

// Computed pour les bénévoles non assignés
const unassignedVolunteers = computed(() => {
  if (!acceptedVolunteers.value.length) {
    return []
  }

  return acceptedVolunteers.value.filter(
    (volunteer: any) => !volunteer.teams || volunteer.teams.length === 0
  )
})

// Computed pour la répartition par équipes
const teamDistribution = computed(() => {
  if (!volunteerTeams.value.length || !teamAssignments.value.length) {
    return []
  }

  return volunteerTeams.value
    .map((team) => {
      const assignedVolunteers = teamAssignments.value.filter((app) =>
        app.teams.some((t: any) => t.id === team.id)
      )

      return {
        ...team,
        volunteers: assignedVolunteers,
        count: assignedVolunteers.length,
        utilizationRate: team.maxVolunteers
          ? Math.round((assignedVolunteers.length / team.maxVolunteers) * 100)
          : null,
      }
    })
    .sort((a, b) => b.count - a.count) // Trier par nombre de bénévoles décroissant
})

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return (
    canEdit.value || canManageVolunteers.value || authStore.user?.id === edition.value?.creatorId
  )
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

// Condition pour voir le tableau des bénévoles
const canViewVolunteersTable = computed(() => {
  if (!authStore.user || !edition.value) return false
  // Super Admin en mode admin
  if (authStore.isAdminModeActive) return true
  // Créateur de l'édition
  if (edition.value.creatorId === authStore.user.id) return true
  // Auteur de la convention
  if (edition.value.convention?.authorId === authStore.user.id) return true
  // Collaborateur
  const collab = edition.value.convention?.collaborators?.find(
    (c: any) => c.user.id === authStore.user!.id
  )
  return !!collab
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

// Fonctions de drag and drop
const handleDragStart = (volunteer: any) => {
  draggedVolunteer.value = volunteer
}

const handleDragEnd = () => {
  draggedVolunteer.value = null
  dragOverTeam.value = null
}

const handleDragOver = (teamId: string) => {
  // Ne permettre le survol que si l'équipe est dans les préférences du bénévole
  if (draggedVolunteer.value && isTeamInVolunteerPreferences(draggedVolunteer.value, teamId)) {
    dragOverTeam.value = teamId
  }
}

const handleDragLeave = () => {
  dragOverTeam.value = null
}

const handleDrop = async (teamId: string) => {
  if (!draggedVolunteer.value) return

  // Vérifier que l'équipe est dans les préférences du bénévole
  if (!isTeamInVolunteerPreferences(draggedVolunteer.value, teamId)) {
    toast.add({
      title: 'Action non autorisée',
      description: "Ce bénévole ne peut être assigné qu'aux équipes de sa préférence",
      icon: 'i-heroicons-exclamation-triangle',
      color: 'warning',
    })
    draggedVolunteer.value = null
    dragOverTeam.value = null
    return
  }

  try {
    // Sauvegarder les infos du bénévole avant de l'assigner
    const volunteerName = `${draggedVolunteer.value.user.prenom} ${draggedVolunteer.value.user.nom}`
    const volunteerId = draggedVolunteer.value.id

    // Assigner le bénévole à l'équipe
    await $fetch(`/api/editions/${editionId}/volunteers/applications/${volunteerId}/teams`, {
      method: 'PATCH',
      body: {
        teams: [teamId],
      },
    })

    // Rafraîchir les données
    await fetchTeamAssignments()
    await fetchVolunteersInfo()

    // Rafraîchir le tableau des bénévoles
    if (volunteerTableRef.value && volunteerTableRef.value.refreshApplications) {
      await volunteerTableRef.value.refreshApplications()
    }

    // Trouver le nom de l'équipe
    const team = volunteerTeams.value.find((t) => t.id === teamId)
    const teamName = team?.name || "l'équipe"

    toast.add({
      title: 'Bénévole assigné',
      description: `${volunteerName} a été assigné à ${teamName}`,
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (error: any) {
    console.error('Failed to assign volunteer to team:', error)

    // Si l'erreur contient un message spécifique, l'afficher
    const errorMessage =
      error?.data?.message || error?.message || "Impossible d'assigner le bénévole à l'équipe"

    toast.add({
      title: 'Erreur',
      description: errorMessage,
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    draggedVolunteer.value = null
    dragOverTeam.value = null
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
  // Charger les assignations d'équipes
  await fetchTeamAssignments()
})

// Métadonnées de la page
useSeoMeta({
  title: 'Gestion des candidatures - ' + (edition.value?.name || 'Édition'),
  description: 'Gestion et traitement des candidatures de bénévoles',
})
</script>
