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

interface OrganisateurRattachable {
  id: number
  user: { id: number; pseudo: string | null; prenom: string | null; nom: string | null }
  teams: Array<{ id: string; name: string; color?: string | null; isLeader: boolean }>
}

const organisateurs = ref<OrganisateurRattachable[]>([])
const modaleOuverte = ref(false)
const organisateurChoisi = ref<OrganisateurRattachable | null>(null)

const nomAffiche = (user: OrganisateurRattachable['user']) =>
  [user.prenom, user.nom].filter(Boolean).join(' ') || user.pseudo || ''

const { execute: charger, loading } = useApiAction<unknown, OrganisateurRattachable[]>(
  () => `/api/editions/${props.editionId}/volunteers/organizers`,
  {
    method: 'GET',
    silentSuccess: true,
    errorMessages: { default: t('volunteers.organizers_in_teams.load_error') },
    onSuccess: (resultat) => {
      organisateurs.value = resultat ?? []
    },
  }
)

const ouvrirRattachement = (organisateur: OrganisateurRattachable) => {
  organisateurChoisi.value = organisateur
  modaleOuverte.value = true
}

onMounted(() => {
  void charger()
})
</script>

<template>
  <UCard class="mt-6">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-user-circle" class="text-indigo-500" />
        <h2 class="text-lg font-semibold">{{ t('volunteers.organizers_in_teams.title') }}</h2>
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
        :key="organisateur.id"
        class="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
      >
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-gray-900 dark:text-white">
            {{ nomAffiche(organisateur.user) }}
          </p>

          <!-- Les équipes déjà rattachées, pour qu'on lise l'état avant d'ouvrir la modale. -->
          <div v-if="organisateur.teams.length > 0" class="flex flex-wrap gap-1 mt-1">
            <UBadge
              v-for="equipe in organisateur.teams"
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
      @teams-saved="charger()"
    />
  </UCard>
</template>
