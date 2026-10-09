<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('edition.not_found') }}</p>
    </div>
    <div v-else-if="!canAccess">
      <UiAccesRefuse />
    </div>
    <div v-else-if="loadingSettings">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else>
      <!-- En-tête avec navigation -->

      <!-- Titre de la page -->
      <div class="mb-6">
        <ManagementPageHeader
          :titre="$t('edition.volunteers.volunteer_form')"
          :description="$t('edition.volunteers.form_description')"
        />
      </div>

      <!-- Contenu du formulaire d'appel à bénévole -->
      <div class="space-y-6">
        <!-- Options du mode interne -->
        <UCard v-if="edition && edition.volunteersMode === 'INTERNAL'">
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-cog-6-tooth" class="text-blue-500" />
              <h2 class="text-lg font-semibold">
                {{ $t('volunteers.internal_mode_options') }}
              </h2>
            </div>

            <EditionVolunteerInternalModeOptions
              v-if="canAccess"
              :edition-id="editionId"
              :initial-data="volunteersInternalData"
              :show-title="false"
              @updated="handleVolunteerInternalOptionsUpdated"
            />

            <div v-if="savingVolunteers" class="flex gap-2">
              <span class="text-xs text-gray-500 flex items-center gap-1">
                <UIcon name="i-heroicons-arrow-path" class="animate-spin" />
                {{ $t('common.saving') }}
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
              {{ $t('volunteers.internal_mode_only') }}
            </p>
            <p class="text-sm text-gray-500 mt-2">
              {{ $t('volunteers.change_mode_hint') }}
            </p>
          </div>
        </UCard>

        <!-- Le formulaire ne se juge vraiment que du côté du bénévole : cet encart évite d'aller
             chercher l'adresse publique à la main, ou de publier le recrutement pour l'essayer.
             La page publique s'ouvre en aperçu tant que les candidatures sont fermées. -->
        <UCard v-if="edition && edition.volunteersMode === 'INTERNAL'" variant="subtle">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-start gap-2">
              <UIcon name="i-heroicons-eye" class="mt-0.5 shrink-0 text-gray-500" />
              <div>
                <p class="font-medium">{{ $t('volunteers.preview_public_page') }}</p>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('volunteers.preview_public_page_hint') }}
                </p>
              </div>
            </div>
            <UButton
              :to="`/editions/${editionId}/volunteers`"
              target="_blank"
              color="neutral"
              variant="outline"
              icon="i-heroicons-arrow-top-right-on-square"
            >
              {{ $t('volunteers.preview_public_page_action') }}
            </UButton>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

import { useVolunteerSettings } from '#imports'

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const { erreur, succes } = useNotificateur()
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
  // La gestion des bénévoles exige le droit dédié (éditer l'édition ne suffit pas).
  return canManageVolunteers.value || authStore.user?.id === edition.value?.creatorId
})

// Permissions calculées
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
    erreur(t('common.error'), { description: settingsError.value })
  } else {
    succes(t('common.saved'))
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
    erreur(t('common.error'), { description: settingsError.value })
  }
})

// Métadonnées de la page
useSeoMeta({
  title: "Formulaire d'appel à bénévole - " + (edition.value?.name || 'Édition'),
  description: 'Formulaire pour créer et gérer les appels à bénévoles',
  ogTitle: () => edition.value?.name || edition.value?.convention?.name || 'Convention',
})
</script>
