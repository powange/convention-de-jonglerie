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

      <!-- Titre de la page -->
      <div class="mb-6">
        <ManagementPageHeader
          :titre="$t('edition.volunteers.teams')"
          :description="$t('gestion.volunteers.teams_description')"
        />
      </div>

      <!-- Contenu de la gestion des équipes -->
      <TeamManagement :edition-id="editionId" />

      <!-- Le rattachement des organisateurs aux équipes : il vivait sur la page des
           organisateurs, fermée au droit « gérer les bénévoles » que son écriture exige pourtant.
           Il vit désormais là où la décision se prend.

           Masqué quand l'option est fermée : le point d'API d'écriture la contrôle et refuse par
           un 403. Sans ce `v-if`, la carte proposait de choisir des équipes puis échouait à
           l'enregistrement — une promesse tenue jusqu'au dernier clic, sur 47 éditions sur 49. -->
      <VolunteersOrganizersInTeamsCard
        v-if="edition?.volunteersOrganizersInTeams"
        :edition-id="editionId"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useAccessControlPermissions } from '~/composables/useAccessControlPermissions'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

import { EditionVolunteerPlanningTeamManagement as TeamManagement } from '#components'

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// Vérifier le statut de contrôle d'accès pour les bénévoles
const { canAccessAccessControl } = useAccessControlPermissions(editionId)

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  // Accès pour gestionnaires classiques
  const hasManagementAccess =
    canManageVolunteers.value || authStore.user?.id === edition.value?.creatorId
  // OU accès pour bénévoles en créneau actif de contrôle d'accès
  const hasAccessControlAccess = canAccessAccessControl.value

  return hasManagementAccess || hasAccessControlAccess
})

// Permissions calculées
const canManageVolunteers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageVolunteers(edition.value, authStore.user.id)
})

// Charger l'édition si nécessaire
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
})

// Métadonnées de la page
useSeoMeta({
  title: 'Les équipes - ' + (edition.value?.name || 'Édition'),
  description: 'Organisation et gestion des équipes de bénévoles',
  ogTitle: () => edition.value?.name || edition.value?.convention?.name || 'Convention',
})
</script>
