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
    <div v-else-if="loadingSettings">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else>
      <!-- En-tête avec navigation -->

      <!-- Titre de la page -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-megaphone" class="text-blue-600 dark:text-blue-400" />
          {{ $t('edition.volunteers.volunteer_form') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('edition.volunteers.form_description') }}
        </p>
      </div>

      <!-- Contenu du formulaire d'appel à bénévole -->
      <div class="space-y-6">
        <!-- Options du mode interne -->
        <UCard v-if="edition && edition.volunteersMode === 'INTERNAL'">
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-cog-6-tooth" class="text-blue-500" />
              <h2 class="text-lg font-semibold">
                {{ $t('edition.volunteers.internal_mode_options') }}
              </h2>
            </div>

            <UAlert
              icon="i-heroicons-information-circle"
              color="info"
              variant="soft"
              :description="$t('edition.volunteers.internal_mode_description')"
            />

            <EditionVolunteerInternalModeOptions
              v-if="canEdit || canManageVolunteers"
              :edition-id="editionId"
              :initial-data="volunteersInternalData"
              :edition-start-date="edition?.startDate ? new Date(edition.startDate) : undefined"
              :edition-end-date="edition?.endDate ? new Date(edition.endDate) : undefined"
              @updated="handleVolunteerInternalOptionsUpdated"
            />

            <div v-if="savingVolunteers" class="flex gap-2">
              <span class="text-xs text-gray-500 flex items-center gap-1">
                <UIcon name="i-heroicons-arrow-path" class="animate-spin" />
                {{ $t('common.saving') || 'Enregistrement...' }}
              </span>
            </div>
          </div>
        </UCard>

        <!-- Message si pas en mode interne -->
        <UCard v-else>
          <div class="text-center py-12">
            <UIcon name="i-heroicons-megaphone" class="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 class="text-xl font-semibold mb-2">
              {{ $t('edition.volunteers.volunteer_form') }}
            </h2>
            <p class="text-gray-600 dark:text-gray-400">
              {{ $t('edition.volunteers.internal_mode_only') }}
            </p>
            <p class="text-sm text-gray-500 mt-2">
              {{ $t('edition.volunteers.change_mode_hint') }}
            </p>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

import { useVolunteerSettings } from '~/composables/useVolunteerSettings'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

definePageMeta({
  layout: 'edition-dashboard',
})

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))
const { teams: volunteerTeams } = useVolunteerTeams(editionId)

// Utiliser le composable pour les paramètres des bénévoles
const {
  loading: loadingSettings,
  error: settingsError,
  fetchSettings: fetchVolunteersSettings,
  getInternalData,
} = useVolunteerSettings(editionId)

// Variables pour les options internes
const savingVolunteers = ref(false)

// Données pour le composant des options internes
const volunteersInternalData = computed(() => {
  return getInternalData([...(volunteerTeams.value || [])])
})

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

// Gestionnaire pour les mises à jour du composant des options internes
const handleVolunteerInternalOptionsUpdated = async (_settings: any) => {
  // Recharger les paramètres bénévoles depuis l'API pour avoir les données à jour
  await fetchVolunteersSettings()
  savingVolunteers.value = false

  // Gérer les erreurs de rechargement
  if (settingsError.value) {
    toast.add({
      title: t('common.error'),
      description: settingsError.value,
      color: 'error',
    })
  } else {
    toast.add({
      title: t('common.saved') || 'Sauvegardé',
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })
  }
}

// Charger l'édition et les paramètres bénévoles
onMounted(async () => {
  // Charger l'édition si nécessaire
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }

  // Charger les paramètres bénévoles
  await fetchVolunteersSettings()

  // Afficher les erreurs de chargement si nécessaire
  if (settingsError.value) {
    toast.add({
      title: t('common.error'),
      description: settingsError.value,
      color: 'error',
    })
  }
})

// Métadonnées de la page
useSeoMeta({
  title: "Formulaire d'appel à bénévole - " + (edition.value?.name || 'Édition'),
  description: 'Formulaire pour créer et gérer les appels à bénévoles',
  ogTitle: () => edition.value?.name || edition.value?.convention?.name || 'Convention',
})
</script>
