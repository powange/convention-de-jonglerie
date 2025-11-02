<template>
  <UCard v-if="leaderTeams.length > 0" variant="soft">
    <template #header>
      <h3 class="text-lg font-semibold flex items-center gap-2">
        <UIcon name="i-heroicons-user-group" class="text-primary-500" />
        {{ t('edition.volunteers.my_teams_title') }}
      </h3>
    </template>

    <div class="space-y-4">
      <div
        v-for="team in leaderTeams"
        :key="team.teamId"
        class="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
      >
        <!-- En-tête de l'équipe -->
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div
              class="w-3 h-3 rounded-full"
              :style="{ backgroundColor: team.team.color || '#3B82F6' }"
            />
            <h4 class="font-semibold text-sm">{{ team.team.name }}</h4>
          </div>
          <UBadge color="warning" size="sm">
            <UIcon name="i-heroicons-star-solid" size="12" />
            {{ t('pages.volunteers.team_distribution.leader_badge') }}
          </UBadge>
        </div>

        <!-- Description de l'équipe -->
        <p
          v-if="team.team.description"
          class="text-xs text-gray-600 dark:text-gray-400 mb-3 whitespace-pre-line"
        >
          {{ team.team.description }}
        </p>

        <!-- Liste des membres -->
        <div v-if="teamMembers[team.teamId]" class="space-y-2">
          <h5 class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{
              t('edition.volunteers.team_members_count', {
                count: teamMembers[team.teamId]?.length || 0,
              })
            }}
          </h5>

          <!-- État de chargement -->
          <div
            v-if="loadingTeams[team.teamId]"
            class="flex items-center gap-2 text-xs text-gray-500"
          >
            <UIcon name="i-heroicons-arrow-path" class="animate-spin" />
            {{ t('common.loading') }}
          </div>

          <!-- Liste des membres -->
          <div
            v-else
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2"
          >
            <div
              v-for="member in teamMembers[team.teamId]"
              :key="member.id"
              class="p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <UiUserDisplayForAdmin
                :user="{
                  id: member.id,
                  pseudo: member.pseudo,
                  prenom: member.prenom,
                  nom: member.nom,
                  email: member.email,
                  emailHash: member.emailHash,
                  phone: member.phone,
                  profilePicture: member.profilePicture,
                }"
                size="md"
                :show-email="true"
                :show-phone="true"
                :border="false"
                avatar-class=""
              >
                <template #badge>
                  <UBadge v-if="member.isLeader" color="warning" size="sm">
                    <UIcon name="i-heroicons-star-solid" size="12" />
                    {{ t('pages.volunteers.team_distribution.leader_badge') }}
                  </UBadge>
                </template>
              </UiUserDisplayForAdmin>
            </div>
          </div>
        </div>

        <!-- Message si aucun membre -->
        <div v-else-if="!loadingTeams[team.teamId]" class="text-xs text-gray-500 italic">
          {{ t('edition.volunteers.no_team_members') }}
        </div>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
interface TeamMember {
  id: number
  pseudo: string
  prenom: string | null
  nom: string | null
  email: string
  emailHash: string
  phone: string | null
  profilePicture: string | null
  isLeader: boolean
  assignedAt: string
}

interface TeamAssignment {
  teamId: string
  isLeader: boolean
  assignedAt: string
  team: {
    id: string
    name: string
    description: string | null
    color: string | null
  }
}

const props = defineProps<{
  editionId: number
  teamAssignments: TeamAssignment[]
}>()

const { t } = useI18n()

// Filtrer les équipes où l'utilisateur est leader
const leaderTeams = computed(() => {
  return props.teamAssignments.filter((assignment) => assignment.isLeader)
})

// Stocker les membres de chaque équipe
const teamMembers = ref<Record<string, TeamMember[]>>({})
const loadingTeams = ref<Record<string, boolean>>({})

// Charger les membres de chaque équipe
const fetchTeamMembers = async (teamId: string) => {
  loadingTeams.value[teamId] = true
  try {
    const members = await $fetch<TeamMember[]>(
      `/api/editions/${props.editionId}/volunteers/teams/${teamId}/members`
    )
    teamMembers.value[teamId] = members
  } catch (error) {
    console.error(`Erreur lors du chargement des membres de l'équipe ${teamId}:`, error)
    teamMembers.value[teamId] = []
  } finally {
    loadingTeams.value[teamId] = false
  }
}

// Charger les membres de toutes les équipes où l'utilisateur est leader
watch(
  leaderTeams,
  async (teams) => {
    if (teams.length > 0) {
      await Promise.all(teams.map((team) => fetchTeamMembers(team.teamId)))
    }
  },
  { immediate: true }
)
</script>
