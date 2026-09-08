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
      <!-- Titre de la page. Sur mobile, le bouton passe sous le texte plutôt que de le
           comprimer. -->
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UIcon name="i-heroicons-rectangle-group" class="text-green-600 dark:text-green-400" />
            {{ $t('pages.volunteers.team_distribution.title') }}
          </h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">
            {{ $t('pages.volunteers.team_distribution.description') }}
          </p>
        </div>
        <UButton
          :to="`/editions/${editionId}/gestion/volunteers/teams`"
          color="primary"
          variant="soft"
          size="sm"
          icon="i-heroicons-cog-6-tooth"
          class="w-full justify-center sm:w-auto"
        >
          {{ $t('pages.volunteers.team_distribution.manage_teams') }}
        </UButton>
      </div>

      <div class="space-y-6">
        <div
          v-if="
            canViewVolunteersTable &&
            volunteersMode === 'INTERNAL' &&
            volunteerTeams.length > 0 &&
            acceptedVolunteers.length > 0
          "
        >
          <div class="space-y-4">
            <!-- Statistiques générales -->
            <div class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
              <div
                :class="`${volunteerConfig.bgClass} ${volunteerConfig.darkBgClass} rounded-lg p-4`"
              >
                <div class="flex items-center gap-3">
                  <UIcon
                    :name="volunteerConfig.icon"
                    :class="volunteerConfig.iconColorClass"
                    size="24"
                  />
                  <div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {{ $t('pages.volunteers.team_distribution.stats.total_teams') }}
                    </p>
                    <p :class="`text-xl font-semibold ${volunteerConfig.textClass}`">
                      {{ volunteerTeams.length }}
                    </p>
                  </div>
                </div>
              </div>
              <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div class="flex items-center gap-3">
                  <UIcon name="i-heroicons-users" class="text-green-600" size="24" />
                  <div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {{ $t('pages.volunteers.team_distribution.stats.assigned_volunteers') }}
                    </p>
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
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {{ $t('pages.volunteers.team_distribution.stats.unassigned') }}
                    </p>
                    <p class="text-xl font-semibold text-orange-600">
                      {{ unassignedVolunteers.length }}
                    </p>
                  </div>
                </div>
              </div>
              <!-- Les organisateurs rattachés, comptés à part : ils composent les équipes sans
                   avoir déposé de candidature, et n'apparaissent donc dans aucun des chiffres
                   voisins. -->
              <div
                v-if="rattachementEquipesOuvert"
                class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4"
              >
                <div class="flex items-center gap-3">
                  <UIcon name="i-heroicons-briefcase" class="text-blue-600" size="24" />
                  <div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {{ $t('pages.volunteers.team_distribution.stats.attached_organizers') }}
                    </p>
                    <p class="text-xl font-semibold text-blue-600">
                      {{ organisateursRattachesCount }}
                    </p>
                  </div>
                </div>
              </div>
              <div class="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <div class="flex items-center gap-3">
                  <UIcon name="i-heroicons-chart-bar" class="text-purple-600" size="24" />
                  <div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {{ $t('pages.volunteers.team_distribution.stats.total_assignments') }}
                    </p>
                    <p class="text-xl font-semibold text-purple-600">
                      {{
                        teamAssignments.reduce(
                          (total, app) => total + (app.teamAssignments?.length || 0),
                          0
                        )
                      }}
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
                        {{ $t('pages.volunteers.team_distribution.unassigned_volunteers') }}
                      </h4>
                      <p class="text-sm text-gray-600 dark:text-gray-400">
                        {{ $t('pages.volunteers.team_distribution.unassigned_description') }}
                      </p>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="text-sm font-medium">
                      {{
                        $t('pages.volunteers.team_distribution.volunteers_count', {
                          count: unassignedVolunteers.length,
                        })
                      }}
                    </p>
                  </div>
                </div>

                <!-- Liste des bénévoles non assignés -->
                <div class="px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
                  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <VolunteersVolunteerCard
                      v-for="volunteer in unassignedVolunteers"
                      :key="volunteer.id"
                      :volunteer="volunteer"
                      :team-preferences-text="
                        getTeamNamesFromPreferences(volunteer.teamPreferences)
                      "
                      @click="handleVolunteerClick"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Liste des équipes avec leurs bénévoles -->
            <div class="space-y-4">
              <div
                v-for="team in teamDistribution"
                :key="team.id"
                class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                <div
                  class="px-4 py-3 border-l-4 flex items-center justify-between"
                  :style="{ borderLeftColor: team.color }"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-4 h-4 rounded-full" :style="{ backgroundColor: team.color }" />
                    <h4 class="font-medium text-gray-900 dark:text-white">{{ team.name }}</h4>
                  </div>
                  <div class="flex items-center gap-4">
                    <div class="text-right">
                      <p class="text-sm font-medium">
                        {{
                          $t('pages.volunteers.team_distribution.volunteers_count', {
                            count: team.count,
                          })
                        }}
                      </p>
                      <p v-if="team.maxVolunteers" class="text-xs text-gray-500">
                        {{ $t('pages.volunteers.team_distribution.max_label') }}
                        {{ team.maxVolunteers }}
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
                    <VolunteersVolunteerCard
                      v-for="volunteer in team.volunteers"
                      :key="volunteer.id"
                      :volunteer="volunteer"
                      :team-id="team.id"
                      :team-preferences-text="
                        getTeamNamesFromPreferences(volunteer.teamPreferences)
                      "
                      @click="handleVolunteerClick"
                      @toggle-leader="toggleTeamLeader"
                      @unassign="unassignFromTeam"
                    />
                  </div>
                </div>

                <!-- Équipe sans personne -->
                <div
                  v-else
                  class="px-4 py-6 bg-gray-50 dark:bg-gray-800/50 text-center border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg mx-4 mb-4"
                >
                  <UIcon name="i-heroicons-users" class="text-gray-400 mx-auto mb-2" size="24" />
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ $t('pages.volunteers.team_distribution.empty_team') }}
                  </p>
                </div>

                <!-- Organisateurs rattachés à l'équipe, présentés à part : leur rattachement se
                     règle depuis la page des organisateurs, pas ici. -->
                <div
                  v-if="organisateursParEquipe[team.id]?.length"
                  class="px-4 py-3 border-t border-gray-200 dark:border-gray-700"
                >
                  <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                    {{ $t('pages.volunteers.team_distribution.organizers_label') }}
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <div
                      v-for="organisateur in organisateursParEquipe[team.id]"
                      :key="organisateur.editionOrganizerId"
                      class="flex items-center gap-2 text-sm px-2 py-1 rounded bg-gray-100 dark:bg-gray-800"
                    >
                      <UiUserAvatar :user="organisateur.user" size="xs" />
                      <UiUserName :user="organisateur.user" />
                      <UBadge
                        v-if="organisateur.leaderTeamIds.includes(team.id)"
                        color="warning"
                        size="sm"
                        variant="soft"
                      >
                        <UIcon name="i-heroicons-star-solid" size="12" />
                        {{ $t('pages.volunteers.team_distribution.leader_badge') }}
                      </UBadge>
                      <!-- Même geste que sur la carte d'un bénévole : l'étoile nomme ou destitue. -->
                      <UTooltip
                        v-if="canManageVolunteers"
                        :text="
                          organisateur.leaderTeamIds.includes(team.id)
                            ? $t('pages.volunteers.team_distribution.remove_as_leader')
                            : $t('pages.volunteers.team_distribution.set_as_leader')
                        "
                      >
                        <UButton
                          :icon="
                            organisateur.leaderTeamIds.includes(team.id)
                              ? 'i-heroicons-star-solid'
                              : 'i-heroicons-star'
                          "
                          :color="
                            organisateur.leaderTeamIds.includes(team.id) ? 'warning' : 'neutral'
                          "
                          variant="ghost"
                          size="xs"
                          @click="basculerResponsableOrganisateur(organisateur, team.id)"
                        />
                      </UTooltip>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <UCard v-if="!canViewVolunteersTable && !editionStore.loading && authStore.isAuthenticated">
          <div class="text-center py-12">
            <UIcon name="i-heroicons-lock-closed" class="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 class="text-xl font-semibold mb-2">{{ $t('pages.access_denied.title') }}</h2>
            <p class="text-gray-600 dark:text-gray-400">
              {{ $t('pages.access_denied.volunteers_description') }}
            </p>
          </div>
        </UCard>
        <!-- La même modale sert depuis la page des candidatures : le composant charge ce
             qu'il affiche, les deux appelants n'ont rien à préparer. -->
        <VolunteersAssignTeamsModal
          v-model="showTeamSelectionModal"
          :edition-id="editionId"
          :volunteer="benevoleADeplacer"
          @saved="fetchTeamAssignments"
        />
      </div>
    </div>
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

// Récupération des équipes et des assignations pour la nouvelle répartition
const { teams: volunteerTeams, fetchTeams: fetchVolunteerTeams } = useVolunteerTeams(editionId)
const teamAssignments = ref<any[]>([])
const acceptedVolunteers = ref<any[]>([])
const benevoleADeplacer = ref<any>(null)
const sourceTeamId = ref<string | null>(null)
const showTeamSelectionModal = ref(false)
/** Les équipes cochées dans la modale, pré-remplies avec celles du bénévole. */
const equipesSelectionnees = ref<string[]>([])
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
    (volunteer: any) => !volunteer.teamAssignments || volunteer.teamAssignments.length === 0
  )
})

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

/**
 * Le module des organisateurs dans les équipes est-il ouvert sur cette édition ? La carte de
 * statistiques n'a pas à figurer si le rattachement n'existe pas.
 */
const rattachementEquipesOuvert = computed(
  () => !!edition.value?.volunteersOrganizersInTeams && organisateurs.value.length > 0
)

/** Ceux qui appartiennent à au moins une équipe — les autres ne composent rien. */
const organisateursRattachesCount = computed(
  () => organisateurs.value.filter((organisateur) => organisateur.teamIds.length > 0).length
)

const organisateursParEquipe = computed(() => {
  const parEquipe: Record<string, OrganisateurBenevolat[]> = {}
  for (const organisateur of organisateurs.value) {
    for (const teamId of organisateur.teamIds) {
      ;(parEquipe[teamId] ??= []).push(organisateur)
    }
  }
  return parEquipe
})

/**
 * Nomme ou destitue un organisateur responsable d'une équipe.
 *
 * Ce n'est pas qu'une étiquette : le statut tient lieu du droit « gestion des bénévoles » sur
 * le périmètre de l'équipe. D'où le rechargement derrière, pour que l'écran dise la vérité.
 */
const basculerResponsableOrganisateur = async (
  organisateur: OrganisateurBenevolat,
  teamId: string
) => {
  const devientResponsable = !organisateur.leaderTeamIds.includes(teamId)
  try {
    await $fetch(
      `/api/editions/${editionId}/organizers/edition-organizers/${organisateur.editionOrganizerId}/teams/${teamId}/leader`,
      { method: 'PATCH', body: { isLeader: devientResponsable } }
    )
    await chargerOrganisateursEquipes()
    toast.add({
      title: devientResponsable
        ? t('pages.volunteers.team_distribution.leader_added')
        : t('pages.volunteers.team_distribution.leader_removed'),
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })
  } catch (error: any) {
    toast.add({
      title: error?.data?.message || t('errors.error_occurred'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  }
}

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

const teamDistribution = computed(() => {
  if (!volunteerTeams.value.length) {
    return []
  }

  return volunteerTeams.value
    .map((team) => {
      const assignedVolunteers = teamAssignments.value.filter((app) =>
        app.teamAssignments.some((t: any) => t.teamId === team.id)
      )

      // Trier les bénévoles : responsables en premier, puis par ordre alphabétique (prénom + nom)
      const sortedVolunteers = assignedVolunteers.sort((a, b) => {
        const aIsLeader = isTeamLeader(a, team.id)
        const bIsLeader = isTeamLeader(b, team.id)

        // D'abord trier par statut de leader
        if (aIsLeader && !bIsLeader) return -1
        if (!aIsLeader && bIsLeader) return 1

        // Ensuite trier alphabétiquement par prénom + nom
        const aName = `${a.user.prenom || ''} ${a.user.nom || ''}`.trim().toLowerCase()
        const bName = `${b.user.prenom || ''} ${b.user.nom || ''}`.trim().toLowerCase()
        return aName.localeCompare(bName, 'fr')
      })

      // L'effectif compte tout le monde : un organisateur rattaché occupe une place dans
      // l'équipe comme un bénévole, et le taux de remplissage doit le dire.
      const effectif = assignedVolunteers.length + (organisateursParEquipe.value[team.id]?.length ?? 0)

      return {
        ...team,
        volunteers: sortedVolunteers,
        count: effectif,
        utilizationRate: team.maxVolunteers
          ? Math.round((effectif / team.maxVolunteers) * 100)
          : null,
      }
    })
  // Aucun tri ici : on garde l'ordre rendu par l'API, celui de la page des équipes. Trier par
  // effectif faisait sauter les équipes de place à chaque assignation, sous la main de celui
  // qui les remplissait.
})

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

/**
 * Un clic sur un bénévole ouvre le choix de son équipe, sur ordinateur comme sur mobile.
 *
 * Le glisser-déposer tenait lieu de geste sur ordinateur : avec une douzaine d'équipes, viser
 * la bonne zone demandait de faire défiler la page en maintenant le bouton enfoncé. Un seul
 * chemin vaut mieux, et il vaut partout.
 */
const handleVolunteerClick = (volunteer: any, fromTeamId?: string) => {
  benevoleADeplacer.value = volunteer
  sourceTeamId.value = fromTeamId || null
  // Les équipes actuelles arrivent cochées : la modale montre l'état, et on l'ajuste.
  equipesSelectionnees.value = equipesDuBenevole(volunteer)
  showTeamSelectionModal.value = true
}

// Fonction pour désassigner un bénévole d'une équipe spécifique
const unassignVolunteerId = ref<number | null>(null)
const unassignTeams = ref<string[]>([])
const unassignMeta = ref<{ volunteerName: string; teamName: string }>({
  volunteerName: '',
  teamName: '',
})

const { execute: executeUnassign } = useApiAction(
  () => `/api/editions/${editionId}/volunteers/applications/${unassignVolunteerId.value}/teams`,
  {
    method: 'PATCH',
    body: () => ({ teams: unassignTeams.value }),
    silentSuccess: true,
    errorMessages: { default: 'Impossible de désassigner le bénévole' },
    onSuccess: async () => {
      await fetchTeamAssignments()
      await fetchVolunteersInfo()
      if (volunteerTableRef.value?.refreshApplications) {
        await volunteerTableRef.value.refreshApplications()
      }
      toast.add({
        title: 'Bénévole désassigné',
        description: `${unassignMeta.value.volunteerName} a été retiré de ${unassignMeta.value.teamName}`,
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    },
  }
)

const unassignFromTeam = (volunteer: any, teamId: string) => {
  const currentTeams = volunteer.teamAssignments?.map((t: any) => t.teamId) || []
  const team = volunteerTeams.value.find((t) => t.id === teamId)

  unassignVolunteerId.value = volunteer.id
  unassignTeams.value = currentTeams.filter((id: string) => id !== teamId)
  unassignMeta.value = {
    volunteerName: `${volunteer.user.prenom} ${volunteer.user.nom}`,
    teamName: team?.name || "l'équipe",
  }
  executeUnassign()
}

// Vérifier si un bénévole est leader d'une équipe
const isTeamLeader = (volunteer: any, teamId: string): boolean => {
  if (!volunteer.teamAssignments) return false
  const assignment = volunteer.teamAssignments.find((a: any) => a.teamId === teamId)
  return assignment?.isLeader || false
}

// Toggle le statut de leader d'un bénévole pour une équipe
const leaderVolunteerId = ref<number | null>(null)
const leaderTeamId = ref<string | null>(null)
const leaderNewValue = ref(false)
const leaderMeta = ref<{ volunteerName: string; teamName: string; wasLeader: boolean }>({
  volunteerName: '',
  teamName: '',
  wasLeader: false,
})

const { execute: executeToggleLeader } = useApiAction(
  () =>
    `/api/editions/${editionId}/volunteers/applications/${leaderVolunteerId.value}/teams/${leaderTeamId.value}/leader`,
  {
    method: 'PATCH',
    body: () => ({ isLeader: leaderNewValue.value }),
    silentSuccess: true,
    errorMessages: { default: 'Impossible de modifier le statut de responsable' },
    onSuccess: async () => {
      await fetchTeamAssignments()
      await fetchVolunteersInfo()
      const { volunteerName, teamName, wasLeader } = leaderMeta.value
      toast.add({
        title: wasLeader
          ? t('pages.volunteers.team_distribution.leader_removed')
          : t('pages.volunteers.team_distribution.leader_added'),
        description: wasLeader
          ? `${volunteerName} n'est plus responsable de ${teamName}`
          : `${volunteerName} est maintenant responsable de ${teamName}`,
        icon: 'i-heroicons-star',
        color: 'success',
      })
    },
  }
)

const toggleTeamLeader = (volunteer: any, teamId: string) => {
  const isCurrentlyLeader = isTeamLeader(volunteer, teamId)
  const team = volunteerTeams.value.find((t) => t.id === teamId)

  leaderVolunteerId.value = volunteer.id
  leaderTeamId.value = teamId
  leaderNewValue.value = !isCurrentlyLeader
  leaderMeta.value = {
    volunteerName: `${volunteer.user.prenom} ${volunteer.user.nom}`,
    teamName: team?.name || "l'équipe",
    wasLeader: isCurrentlyLeader,
  }
  executeToggleLeader()
}

// La modale refermée, on oublie qui l'on modifiait : sans quoi la suivante s'ouvrirait sur les
// cases du bénévole précédent.
watch(showTeamSelectionModal, (ouverte) => {
  if (!ouverte) {
    benevoleADeplacer.value = null
    sourceTeamId.value = null
    equipesSelectionnees.value = []
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
