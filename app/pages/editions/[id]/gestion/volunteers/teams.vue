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
      <EditionHeader :edition="edition" current-page="gestion" />

      <!-- Titre de la page -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-user-group" class="text-purple-600 dark:text-purple-400" />
          Les équipes
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Organisation et gestion des équipes de bénévoles
        </p>
      </div>

      <!-- Contenu de la gestion des équipes -->
      <TeamManagement :edition-id="editionId" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import TeamManagement from '~/components/edition/volunteer/planning/TeamManagement.vue'
import { useAccessControlPermissions } from '~/composables/useAccessControlPermissions'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

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
    canEdit.value || canManageVolunteers.value || authStore.user?.id === edition.value?.creatorId
  // OU accès pour bénévoles en créneau actif de contrôle d'accès
  const hasAccessControlAccess = canAccessAccessControl.value

  return hasManagementAccess || hasAccessControlAccess
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
