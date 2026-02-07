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

// État pour vérifier si l'utilisateur est team leader
const isTeamLeaderValue = ref(false)

// État pour vérifier si l'utilisateur peut accéder à la validation des repas
const canAccessMealValidation = ref(false)

// État pour vérifier si l'utilisateur a un créneau actif de contrôle d'accès
const canAccessAccessControlPage = ref(false)

// Vérifier l'accès à la page gestion (même logique que dans Header.vue)
const canAccess = computed(() => {
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

  // Responsables d'équipe de bénévoles
  if (isTeamLeaderValue.value) {
    return true
  }

  // Bénévoles avec accès à la validation des repas
  if (canAccessMealValidation.value) {
    return true
  }

  // Bénévoles avec créneau actif de contrôle d'accès
  if (canAccessAccessControlPage.value) {
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

// Charger les permissions au montage et lors des changements d'authentification
watch(
  () => authStore.isAuthenticated,
  async (isAuthenticated) => {
    if (isAuthenticated && authStore.user?.id && props.edition?.id) {
      // Vérifier si l'utilisateur est team leader
      isTeamLeaderValue.value = await editionStore.isTeamLeader(props.edition.id, authStore.user.id)

      // Vérifier si l'utilisateur peut accéder à la validation des repas
      try {
        const response = await $fetch<{ canAccess: boolean }>(
          `/api/editions/${props.edition.id}/permissions/can-access-meal-validation`
        )
        canAccessMealValidation.value = response.canAccess
      } catch {
        canAccessMealValidation.value = false
      }

      // Vérifier si l'utilisateur a un créneau actif de contrôle d'accès
      try {
        const response = await $fetch<{ isActive: boolean; activeSlot: any }>(
          `/api/editions/${props.edition.id}/volunteers/access-control/status`
        )
        canAccessAccessControlPage.value = response.isActive
      } catch {
        canAccessAccessControlPage.value = false
      }
    } else {
      isTeamLeaderValue.value = false
      canAccessMealValidation.value = false
      canAccessAccessControlPage.value = false
    }
  },
  { immediate: true }
)
</script>
