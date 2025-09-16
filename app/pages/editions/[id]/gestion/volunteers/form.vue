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
          <UIcon name="i-heroicons-megaphone" class="text-blue-600 dark:text-blue-400" />
          {{ $t('editions.volunteers.volunteer_form') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('editions.volunteers.form_description') }}
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
                {{ $t('editions.volunteers.internal_mode_options') }}
              </h2>
            </div>

            <UAlert
              icon="i-heroicons-information-circle"
              color="info"
              variant="soft"
              :description="$t('editions.volunteers.internal_mode_description')"
            />

            <EditionVolunteerInternalModeOptions
              v-if="canEdit || canManageVolunteers"
              :edition-id="editionId"
              :initial-data="volunteersInternalData"
              :edition-start-date="edition?.startDate"
              :edition-end-date="edition?.endDate"
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
              {{ $t('editions.volunteers.volunteer_form') }}
            </h2>
            <p class="text-gray-600 dark:text-gray-400">
              {{ $t('editions.volunteers.internal_mode_only') }}
            </p>
            <p class="text-sm text-gray-500 mt-2">
              {{ $t('editions.volunteers.change_mode_hint') }}
            </p>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { fromDate } from '@internationalized/date'
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
const { teams: volunteerTeams } = useVolunteerTeams(editionId)

// Variables pour les options internes
const savingVolunteers = ref(false)

// Données pour le composant des options internes
const volunteersInternalData = computed(() => {
  if (!edition.value) return {}
  return {
    setupStartDate: edition.value.volunteersSetupStartDate
      ? fromDate(new Date(edition.value.volunteersSetupStartDate), 'UTC')
      : null,
    teardownEndDate: edition.value.volunteersTeardownEndDate
      ? fromDate(new Date(edition.value.volunteersTeardownEndDate), 'UTC')
      : null,
    askSetup: edition.value.volunteersAskSetup,
    askTeardown: edition.value.volunteersAskTeardown,
    askDiet: edition.value.volunteersAskDiet,
    askAllergies: edition.value.volunteersAskAllergies,
    askPets: edition.value.volunteersAskPets,
    askMinors: edition.value.volunteersAskMinors,
    askVehicle: edition.value.volunteersAskVehicle,
    askCompanion: edition.value.volunteersAskCompanion,
    askAvoidList: edition.value.volunteersAskAvoidList,
    askSkills: edition.value.volunteersAskSkills,
    askExperience: edition.value.volunteersAskExperience,
    askTimePreferences: edition.value.volunteersAskTimePreferences,
    askTeamPreferences: edition.value.volunteersAskTeamPreferences,
    teams: volunteerTeams.value || [],
  }
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

// Gestionnaire pour les mises à jour du composant des options internes
const handleVolunteerInternalOptionsUpdated = async (settings: any) => {
  // Mettre à jour les données locales avec les nouvelles valeurs du serveur
  if (edition.value) {
    Object.assign(edition.value, settings)
    savingVolunteers.value = false
    toast.add({
      title: t('common.saved') || 'Sauvegardé',
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })
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
})

// Métadonnées de la page
useSeoMeta({
  title: "Formulaire d'appel à bénévole - " + (edition.value?.name || 'Édition'),
  description: 'Formulaire pour créer et gérer les appels à bénévoles',
})
</script>
