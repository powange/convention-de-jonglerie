<template>
  <EditionVolunteerCarteRepliable
    v-if="equipes.length > 0"
    :titre="t('volunteers.my_teams_title')"
    icone="i-heroicons-user-group"
    :repliable-sur-mobile="repliableSurMobile"
  >
    <div class="space-y-4">
      <div
        v-for="team in equipes"
        :key="team.id"
        class="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
      >
        <!-- En-tête de l'équipe.
             ⚠️ EN COLONNE SUR MOBILE : sur une seule ligne, le bouton « Envoyer un message » et la
             pastille « Responsable » débordaient hors de la carte — la pastille était coupée net.
             Les points de rupture font le travail, on ne mesure aucune largeur. -->
        <div class="flex flex-col gap-2 mb-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-2">
            <div
              class="w-3 h-3 rounded-full"
              :style="{ backgroundColor: team.color || '#3B82F6' }"
            />
            <h4 class="font-semibold text-sm">{{ team.name }}</h4>
          </div>
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
            <UButton
              icon="i-heroicons-chat-bubble-left-right"
              color="primary"
              variant="soft"
              size="sm"
              class="w-full justify-center sm:w-auto"
              :label="t('common.edition.volunteers.send_message_to_team')"
              @click="sendMessageToTeam(team.id)"
            />
            <UBadge color="warning" size="sm" class="w-full justify-center sm:w-auto">
              <UIcon name="i-heroicons-star-solid" size="12" />
              {{ t('pages.volunteers.team_distribution.leader_badge') }}
            </UBadge>
          </div>
        </div>

        <!-- Description de l'équipe -->
        <p
          v-if="team.description"
          class="text-xs text-gray-600 dark:text-gray-400 mb-3 whitespace-pre-line"
        >
          {{ team.description }}
        </p>

        <!-- Liste des membres -->
        <div v-if="teamMembers[team.id]" class="space-y-2">
          <h5 class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{
              t('volunteers.team_members_count', {
                count: teamMembers[team.id]?.length || 0,
              })
            }}
          </h5>

          <!-- État de chargement -->
          <div v-if="loadingTeams[team.id]" class="flex items-center gap-2 text-xs text-gray-500">
            <UIcon name="i-heroicons-arrow-path" class="animate-spin" />
            {{ t('common.loading') }}
          </div>

          <!-- Liste des membres -->
          <div
            v-else
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2"
          >
            <button
              v-for="member in teamMembers[team.id]"
              :key="member.id"
              type="button"
              class="w-full text-left p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              :title="t('volunteers.see_slots')"
              @click="emit('volunteer-click', member)"
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
            </button>
          </div>
        </div>

        <!-- Message si aucun membre -->
        <div v-else-if="!loadingTeams[team.id]" class="text-xs text-gray-500 italic">
          {{ t('volunteers.no_team_members') }}
        </div>
      </div>
    </div>
  </EditionVolunteerCarteRepliable>
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

/**
 * Une équipe dont on est RESPONSABLE, telle que `my-leader-teams` la rend.
 *
 * ⚠️⚠️ CE N'EST PLUS UNE AFFECTATION DE CANDIDATURE, et c'est tout le correctif. La carte se
 * nourrissait de `myApplication.teamAssignments`, donc d'une candidature de bénévole. Un
 * responsable d'équipe qui tient ce rôle comme ORGANISATEUR n'a pas de candidature : la carte ne
 * s'affichait jamais pour lui, alors que le planning, lui, le reconnaissait — il voyait les
 * créneaux de ses équipes sans pouvoir ni lister ses bénévoles ni leur écrire.
 *
 * `my-leader-teams` réunit les deux titres, comme le fait déjà `equipesDontIlEstResponsable`
 * côté serveur, et c'est la même liste que la page utilise pour ouvrir le planning en avance.
 */
interface EquipeDirigee {
  id: string
  name: string
  description?: string | null
  color?: string | null
}

const props = withDefaults(
  defineProps<{
    editionId: number
    equipes: EquipeDirigee[]
    repliableSurMobile?: boolean
  }>(),
  { repliableSurMobile: false }
)

/**
 * Un membre cliqué : la page ouvre alors la carte de ses créneaux.
 *
 * 📍 LA MODALE RESTE À LA PAGE, comme dans la gestion où `VolunteersSummary` émet le même
 * événement et où c'est `planning.vue` qui ouvre `VolunteerSlotsModal`. C'est la page qui tient
 * les créneaux, les formateurs de date et le fuseau de l'édition ; les redemander ici les
 * dédoublerait.
 */
const emit = defineEmits<{ 'volunteer-click': [membre: { id: number; pseudo: string }] }>()

const { t } = useI18n()

const equipes = computed(() => props.equipes)

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
  equipes,
  async (teams) => {
    if (teams.length > 0) {
      await Promise.all(teams.map((team) => fetchTeamMembers(team.id)))
    }
  },
  { immediate: true }
)

// Fonction pour envoyer un message à l'équipe
const currentTeamId = ref<string>('')

const { execute: executeSendMessage } = useApiAction<unknown, { conversationId: string }>(
  '/api/messenger/team-conversation',
  {
    method: 'POST',
    body: () => ({
      editionId: props.editionId,
      teamId: currentTeamId.value,
    }),
    silentSuccess: true,
    onSuccess: (response) => {
      navigateTo(`/messenger?conversationId=${response.conversationId}`)
    },
  }
)

const sendMessageToTeam = (teamId: string) => {
  currentTeamId.value = teamId
  executeSendMessage()
}
</script>
