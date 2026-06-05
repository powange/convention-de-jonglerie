<template>
  <ClientOnly>
    <UButton
      v-if="canAccess"
      :to="`/editions/${edition.id}/gestion`"
      icon="i-heroicons-cog-6-tooth"
      :variant="variant"
      :size="size"
      :color="color"
    >
      {{ $t('edition.management') }}
    </UButton>
  </ClientOnly>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import type { Edition } from '~/types'

interface Props {
  edition: Edition
  variant?: 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | 'link'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  color?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'ghost',
  size: 'sm',
  color: 'neutral',
})

const authStore = useAuthStore()
const editionStore = useEditionStore()

// Accès « bénévole » à la gestion (team leader, validation des repas, créneau
// de contrôle d'accès), récupéré via l'endpoint unifié uniquement en repli.
const hasVolunteerLevelAccess = ref(false)

// Accès accordé via des critères synchrones, sans appel réseau.
const hasSyncAccess = computed(() => {
  if (!props.edition || !authStore.user?.id) {
    return false
  }

  // Les admins globaux en mode admin peuvent accéder à la gestion
  if (authStore.isAdminModeActive) {
    return true
  }

  // Les admins peuvent accéder aux conventions orphelines (sans auteur)
  if (authStore.user.isGlobalAdmin && !props.edition.convention?.authorId) {
    return true
  }

  // Créateur de l'édition
  if (authStore.user.id === props.edition.creatorId) {
    return true
  }

  // Utilisateurs avec des droits spécifiques
  const canEdit = editionStore.canEditEdition(props.edition, authStore.user.id)
  const canManageVolunteers = editionStore.canManageVolunteers(props.edition, authStore.user.id)
  if (canEdit || canManageVolunteers) {
    return true
  }

  // Tous les organisateurs de la convention (même sans droits)
  if (props.edition.convention?.organizers) {
    const isOrganizer = props.edition.convention.organizers.some(
      (collab) => collab.user.id === authStore.user?.id
    )
    if (isOrganizer) {
      return true
    }
  }

  return false
})

// Accès final : critères synchrones OU accès bénévole vérifié côté serveur.
const canAccess = computed(() => hasSyncAccess.value || hasVolunteerLevelAccess.value)

// Ne charger l'accès bénévole que si l'accès n'est pas déjà acquis
// synchroniquement, pour éviter un appel réseau inutile.
watch(
  [() => authStore.isAuthenticated, () => props.edition?.id, hasSyncAccess],
  async ([isAuthenticated, editionId, syncAccess]) => {
    if (!isAuthenticated || !authStore.user?.id || !editionId || syncAccess) {
      hasVolunteerLevelAccess.value = false
      return
    }

    const access = await editionStore.getManagementAccess(editionId)
    hasVolunteerLevelAccess.value =
      access.isTeamLeader || access.canAccessMealValidation || access.isAccessControlActive
  },
  { immediate: true }
)
</script>
