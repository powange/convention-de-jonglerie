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
          <UIcon name="i-heroicons-bell" class="text-yellow-600 dark:text-yellow-400" />
          {{ t('editions.volunteers.notifications') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Envoi et gestion des notifications aux bénévoles
        </p>
      </div>

      <!-- Contenu des notifications bénévoles -->
      <div class="space-y-6">
        <!-- Section notification des bénévoles -->
        <UCard v-if="canManageVolunteers">
          <div class="space-y-4">
            <UAlert
              icon="i-heroicons-information-circle"
              color="info"
              variant="soft"
              description="Envoyez des notifications et gérez les communications avec les bénévoles acceptés pour cette édition."
            />

            <EditionVolunteerNotifications
              ref="notificationsListRef"
              :edition-id="editionId"
              :edition="edition"
              :volunteers-info="volunteersInfo"
              :can-manage-volunteers="canManageVolunteers"
              :accepted-volunteers-count="volunteersInfo?.counts?.ACCEPTED ?? 0"
            />
          </div>
        </UCard>

        <!-- Message si pas les permissions -->
        <UCard v-else>
          <div class="text-center py-12">
            <UIcon name="i-heroicons-lock-closed" class="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 class="text-xl font-semibold mb-2">
              {{ $t('editions.volunteers.restricted_access') }}
            </h2>
            <p class="text-gray-600 dark:text-gray-400">
              {{ $t('editions.volunteers.restricted_access_description') }}
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

// Référence au composant de notifications
const notificationsListRef = ref()

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
      title: e?.statusMessage || t('errors.favorite_update_failed'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
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
})

// Métadonnées de la page
useSeoMeta({
  title: 'Notifications bénévoles - ' + (edition.value?.name || 'Édition'),
  description: 'Envoi et gestion des notifications aux bénévoles',
})
</script>
