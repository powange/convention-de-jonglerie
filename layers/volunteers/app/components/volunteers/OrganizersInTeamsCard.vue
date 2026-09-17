<script setup lang="ts">
/**
 * Le rattachement des organisateurs aux équipes de bénévolat.
 *
 * Il vivait sur la page des organisateurs, fermée au droit « gérer les bénévoles » — alors que
 * c'est précisément ce droit que l'écriture exige. Qui pouvait faire l'association ne pouvait pas
 * y accéder ; qui pouvait y accéder n'avait pas le droit de la faire.
 *
 * Il vit désormais du côté bénévoles, là où la décision se prend et où le droit correspond.
 */
const props = defineProps<{ editionId: number }>()

const { t } = useI18n()

/**
 * La forme que rend `/volunteers/organizers`, telle qu'elle existe depuis toujours : des
 * IDENTIFIANTS d'équipe, non des équipes. C'est l'écran qui les rapproche du catalogue.
 */
interface OrganisateurRattachable {
  editionOrganizerId: number
  /**
   * Tout ce qu'il faut pour afficher la personne, avatar compris.
   *
   * `emailHash`, `profilePicture` et `updatedAt` ne servent qu'à lui : le repli Gravatar a besoin
   * de l'empreinte, et l'horodatage casse le cache quand la photo change. Les omettre du typage
   * suffirait à les faire disparaître de l'appel au composant sans que rien ne le signale.
   */
  user: {
    id: number
    pseudo: string | null
    prenom: string | null
    nom: string | null
    emailHash?: string | null
    profilePicture?: string | null
    updatedAt?: string | Date | null
  }
  teamIds: string[]
  leaderTeamIds: string[]
}

interface EquipeDuCatalogue {
  id: string
  name: string
  color?: string | null
}

const organisateurs = ref<OrganisateurRattachable[]>([])
const equipes = ref<EquipeDuCatalogue[]>([])
const modaleOuverte = ref(false)
const organisateurChoisi = ref<{
  id: number
  user: OrganisateurRattachable['user']
  teams: Array<{ id: string; name: string }>
} | null>(null)

const nomAffiche = (user: OrganisateurRattachable['user']) =>
  [user.prenom, user.nom].filter(Boolean).join(' ') || user.pseudo || ''

const equipeParId = computed(() => new Map(equipes.value.map((equipe) => [equipe.id, equipe])))

/** Les équipes d'un organisateur, rapprochées du catalogue pour être nommées et colorées. */
const equipesDe = (organisateur: OrganisateurRattachable) =>
  organisateur.teamIds.flatMap((id) => {
    const equipe = equipeParId.value.get(id)
    return equipe ? [{ ...equipe, isLeader: organisateur.leaderTeamIds.includes(id) }] : []
  })

const { execute: charger, loading } = useApiAction<
  unknown,
  { organizers?: OrganisateurRattachable[] }
>(() => `/api/editions/${props.editionId}/volunteers/organizers`, {
  method: 'GET',
  silentSuccess: true,
  errorMessages: { default: t('volunteers.organizers_in_teams.load_error') },
  onSuccess: (resultat) => {
    organisateurs.value = resultat?.organizers ?? []
  },
})

// Le catalogue des équipes, pour nommer les identifiants que rend le point d'API ci-dessus.
const { execute: chargerEquipes } = useApiAction<unknown, EquipeDuCatalogue[]>(
  () => `/api/editions/${props.editionId}/volunteer-teams`,
  {
    method: 'GET',
    silentSuccess: true,
    errorMessages: { default: t('volunteers.organizers_in_teams.load_error') },
    onSuccess: (resultat) => {
      equipes.value = resultat ?? []
    },
  }
)

const ouvrirRattachement = (organisateur: OrganisateurRattachable) => {
  // La modale attend la forme de la page des organisateurs : un identifiant et des équipes
  // nommées. On la lui compose plutôt que de la faire diverger.
  organisateurChoisi.value = {
    id: organisateur.editionOrganizerId,
    user: organisateur.user,
    teams: equipesDe(organisateur),
  }
  modaleOuverte.value = true
}

const rafraichir = () => {
  void charger()
}

onMounted(() => {
  void charger()
  void chargerEquipes()
})
</script>

<template>
  <UCard class="mt-6">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-user-circle" class="text-indigo-500" />
        <h2 class="text-lg font-semibold">
          {{ t('volunteers.organizers_in_teams.title') }}
        </h2>
      </div>
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
        {{ t('volunteers.organizers_in_teams.description') }}
      </p>
    </template>

    <div v-if="loading" class="flex items-center justify-center py-8">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin h-6 w-6 text-primary-500" />
    </div>

    <p
      v-else-if="organisateurs.length === 0"
      class="text-sm text-gray-500 italic p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center"
    >
      {{ t('volunteers.organizers_in_teams.empty') }}
    </p>

    <div v-else class="space-y-2">
      <div
        v-for="organisateur in organisateurs"
        :key="organisateur.editionOrganizerId"
        class="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
      >
        <div class="min-w-0 flex-1 flex items-start gap-3">
          <!-- Même composant que la modale d'affectation du planning : une personne se reconnaît
               à sa photo avant de se lire. -->
          <UiUserAvatar :user="organisateur.user" size="sm" shrink />

          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ nomAffiche(organisateur.user) }}
            </p>

            <!-- Les équipes déjà rattachées, pour qu'on lise l'état avant d'ouvrir la modale. -->
            <div v-if="equipesDe(organisateur).length > 0" class="flex flex-wrap gap-1 mt-1">
              <UBadge
                v-for="equipe in equipesDe(organisateur)"
                :key="equipe.id"
                variant="soft"
                size="sm"
                :style="{
                  backgroundColor: `${equipe.color || '#6b7280'}20`,
                  color: equipe.color || '#6b7280',
                }"
              >
                {{ equipe.name }}
                <span v-if="equipe.isLeader" class="ml-1">★</span>
              </UBadge>
            </div>
            <p v-else class="text-xs text-gray-500 mt-1">
              {{ t('volunteers.organizers_in_teams.none_yet') }}
            </p>
          </div>
        </div>

        <UButton
          icon="i-heroicons-user-group"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="ouvrirRattachement(organisateur)"
        >
          {{ t('volunteers.organizers_in_teams.manage') }}
        </UButton>
      </div>
    </div>

    <VolunteersOrganizerTeamsModal
      v-model="modaleOuverte"
      :organizer="organisateurChoisi"
      :edition-id="editionId"
      @teams-saved="rafraichir"
    />
  </UCard>
</template>
