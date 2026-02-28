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
      <!-- Contenu de gestion -->
      <div class="space-y-6">
        <!-- Statut de l'édition -->
        <UCard v-if="canEdit">
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-signal" class="text-blue-500" />
              <h2 class="text-lg font-semibold">{{ $t('edition.status_label') }}</h2>
            </div>
            <USelect
              v-model="localStatus"
              :items="statusOptions"
              value-key="value"
              size="md"
              :ui="{ content: 'min-w-fit' }"
            />

            <!-- Description du statut -->
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ currentStatusDescription }}
            </p>

            <!-- Bouton de sauvegarde (visible uniquement si modification) -->
            <div v-if="hasStatusChanged" class="flex justify-end">
              <UButton
                color="primary"
                icon="i-heroicons-check"
                :loading="savingStatus"
                @click="saveStatus"
              >
                {{ $t('common.save') }}
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Informations -->
        <UCard v-if="canEdit">
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-info" class="text-blue-500" />
              <h2 class="text-lg font-semibold">{{ $t('gestion.infos.title') }}</h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <!-- Modifier l'édition -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/edit`"
                icon="i-heroicons-pencil"
                :title="$t('gestion.edit_edition')"
                :description="$t('gestion.infos.edit_description')"
                color="warning"
              />

              <!-- Informations générales -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/general-info`"
                icon="i-lucide-settings"
                :title="$t('gestion.general_info.title')"
                :description="$t('gestion.infos.general_info_description')"
                color="cyan"
              />

              <!-- À propos -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/about`"
                icon="i-lucide-file-text"
                :title="$t('gestion.about.title')"
                :description="$t('gestion.infos.about_description')"
                color="indigo"
              />

              <!-- Services -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/services`"
                icon="i-lucide-wrench"
                :title="$t('gestion.services.title')"
                :description="$t('gestion.infos.services_description')"
                color="teal"
              />

              <!-- Liens externes -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/external-links`"
                icon="i-lucide-link"
                :title="$t('gestion.external_links.title')"
                :description="$t('gestion.infos.external_links_description')"
                color="violet"
              />

              <!-- Carte du site -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/map`"
                icon="i-lucide-map"
                :title="$t('gestion.map.title')"
                :description="$t('gestion.infos.map_description')"
                color="blue"
              />

              <!-- Supprimer l'édition -->
              <ManagementNavigationCard
                v-if="canDelete"
                icon="i-heroicons-trash"
                :title="$t('gestion.delete_edition')"
                :description="$t('gestion.infos.delete_description')"
                color="error"
                @click="showDeleteConfirm = true"
              />
            </div>
          </div>
        </UCard>

        <!-- Modal de confirmation de suppression -->
        <UiConfirmModal
          v-model="showDeleteConfirm"
          :title="$t('gestion.delete_edition')"
          :description="$t('gestion.confirm_delete_edition')"
          :confirm-label="$t('common.delete')"
          confirm-color="error"
          icon-name="i-heroicons-trash"
          icon-color="text-red-500"
          :loading="deletingEdition"
          require-name-confirmation
          :expected-name="editionDisplayName"
          @confirm="confirmDeleteEdition"
          @cancel="showDeleteConfirm = false"
        />

        <!-- Organisateurs -->
        <UCard v-if="canManageOrganizers">
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-user-group" class="text-purple-500" />
              <h2 class="text-lg font-semibold">{{ $t('organizers.title') }}</h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <!-- Gérer les organisateurs -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/organizers`"
                icon="i-heroicons-user-group"
                :title="$t('organizers.manage')"
                :description="$t('organizers.manage_description')"
                color="purple"
              />
            </div>
          </div>
        </UCard>

        <!-- Gestion bénévole -->
        <UCard v-if="isOrganizer || isTeamLeaderValue">
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-user-group" class="text-primary-500" />
              <h2 class="text-lg font-semibold">
                {{ $t('edition.ticketing.volunteer_management') }}
              </h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <!-- Configuration bénévolat -->
              <ManagementNavigationCard
                v-if="canEdit || canManageVolunteers"
                :to="`/editions/${edition.id}/gestion/volunteers/config`"
                icon="i-heroicons-cog-6-tooth"
                :title="$t('gestion.volunteers.config_title')"
                :description="$t('gestion.volunteers.config_description')"
                color="gray"
              />

              <!-- Page bénévoles -->
              <ManagementNavigationCard
                v-if="canEdit || canManageVolunteers"
                :to="`/editions/${edition.id}/gestion/volunteers/page`"
                icon="i-heroicons-clipboard-document-list"
                :title="$t('edition.volunteers.volunteer_page')"
                :description="$t('edition.volunteers.page_description')"
                color="indigo"
              />

              <!-- Liens visibles uniquement en mode interne -->
              <template v-if="edition.volunteersMode === 'INTERNAL'">
                <!-- Formulaire d'appel à bénévole -->
                <ManagementNavigationCard
                  v-if="canEdit || canManageVolunteers"
                  :to="`/editions/${edition.id}/gestion/volunteers/form`"
                  icon="i-heroicons-megaphone"
                  :title="$t('edition.volunteers.volunteer_form')"
                  :description="$t('edition.volunteers.form_description')"
                  color="blue"
                />

                <!-- Gestion des candidatures -->
                <ManagementNavigationCard
                  v-if="canEdit || canManageVolunteers"
                  :to="`/editions/${edition.id}/gestion/volunteers/applications`"
                  icon="i-heroicons-document-text"
                  :title="$t('edition.volunteers.application_management')"
                  :description="$t('gestion.volunteers.applications_description')"
                  color="green"
                />

                <!-- Les équipes -->
                <ManagementNavigationCard
                  v-if="canEdit || canManageVolunteers"
                  :to="`/editions/${edition.id}/gestion/volunteers/teams`"
                  icon="i-heroicons-user-group"
                  :title="$t('edition.volunteers.teams')"
                  :description="$t('gestion.volunteers.teams_description')"
                  color="purple"
                />

                <!-- Planning (pas visible pour les team leaders seuls) -->
                <ManagementNavigationCard
                  v-if="canEdit || canManageVolunteers"
                  :to="`/editions/${edition.id}/gestion/volunteers/planning`"
                  icon="i-heroicons-calendar-days"
                  :title="$t('edition.volunteers.planning')"
                  :description="$t('gestion.volunteers.planning_description')"
                  color="orange"
                />

                <!-- Notifications bénévoles (visible pour les team leaders) -->
                <ManagementNavigationCard
                  v-if="canEdit || canManageVolunteers || isTeamLeaderValue"
                  :to="`/editions/${edition.id}/gestion/volunteers/notifications`"
                  icon="i-heroicons-bell"
                  :title="$t('edition.volunteers.volunteer_notifications')"
                  :description="$t('gestion.volunteers.notifications_description')"
                  color="yellow"
                />
              </template>
            </div>
          </div>
        </UCard>

        <!-- Gestion des artistes -->
        <UCard v-if="isOrganizer">
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-star" class="text-yellow-500" />
              <h2 class="text-lg font-semibold">{{ $t('gestion.artists.title') }}</h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <!-- Liste des artistes -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/artists`"
                icon="i-heroicons-users"
                :title="$t('gestion.artists.list_title')"
                :description="
                  $t(
                    'gestion.artists.manage_artists_description',
                    'Gérer les artistes et leurs informations'
                  )
                "
                color="yellow"
              />

              <!-- Gestion des spectacles -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/artists/shows`"
                icon="i-heroicons-sparkles"
                :title="$t('gestion.shows.list_title')"
                :description="
                  $t('gestion.shows.manage_shows_description', 'Créer et organiser les spectacles')
                "
                color="purple"
              />

              <!-- Appels à spectacles -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/shows-call`"
                icon="i-heroicons-megaphone"
                :title="$t('gestion.shows_call.title')"
                :description="$t('gestion.shows_call.list_description')"
                color="amber"
              />
            </div>
          </div>
        </UCard>

        <!-- Repas (accès complet pour organisateurs) -->
        <UCard v-if="isOrganizer">
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="cbi:mealie" class="text-orange-500" />
              <h2 class="text-lg font-semibold">{{ $t('gestion.meals.title') }}</h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <!-- Configuration des repas -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/meals`"
                icon="cbi:mealie"
                :title="$t('gestion.meals.configuration_title')"
                :description="$t('gestion.meals.configuration_description')"
                color="orange"
              />

              <!-- Liste des repas -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/meals/list`"
                icon="i-heroicons-list-bullet"
                :title="$t('gestion.meals.list_title')"
                :description="$t('gestion.meals.list_description')"
                color="purple"
              />

              <!-- Validation des repas -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/meals/validate`"
                icon="i-heroicons-check-badge"
                :title="$t('gestion.meals.validation_title')"
                :description="$t('gestion.meals.validation_description')"
                color="green"
              />
            </div>
          </div>
        </UCard>

        <!-- Validation des repas (accès pour bénévoles d'équipes de validation) -->
        <UCard v-else-if="canAccessMealValidation">
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="cbi:mealie" class="text-orange-500" />
              <h2 class="text-lg font-semibold">{{ $t('gestion.meals.title') }}</h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <!-- Validation des repas uniquement -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/meals/validate`"
                icon="i-heroicons-check-badge"
                :title="$t('gestion.meals.validation_title')"
                :description="$t('gestion.meals.validation_description')"
                color="green"
              />
            </div>
          </div>
        </UCard>

        <!-- Billeterie -->
        <UCard v-if="isOrganizer">
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-ticket" class="text-blue-500" />
              <h2 class="text-lg font-semibold">{{ $t('gestion.ticketing.title') }}</h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <!-- Configuration billetterie -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/ticketing/config`"
                icon="i-heroicons-cog-6-tooth"
                :title="$t('gestion.ticketing.config_title')"
                :description="$t('gestion.ticketing.config_description')"
                color="blue"
              />

              <!-- Lier une billeterie externe -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/ticketing/external`"
                icon="i-heroicons-link"
                :title="$t('gestion.ticketing.external_link_title')"
                :description="$t('gestion.ticketing.external_link_description')"
                color="purple"
              />

              <!-- Gérer les tarifs et options -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/ticketing/tiers`"
                icon="i-heroicons-currency-euro"
                :title="$t('gestion.ticketing.tiers_title')"
                :description="$t('gestion.ticketing.tiers_description')"
                color="orange"
              />

              <!-- Gérer les commandes -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/ticketing/orders`"
                icon="i-heroicons-shopping-cart"
                :title="$t('gestion.ticketing.orders_title')"
                :description="$t('gestion.ticketing.orders_description')"
                color="green"
              />

              <!-- Contrôle d'accès -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/ticketing/access-control`"
                icon="i-heroicons-shield-check"
                :title="$t('gestion.ticketing.access_control_title')"
                :description="$t('gestion.ticketing.access_control_description')"
                color="blue"
              />

              <!-- Compteurs -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/ticketing/counter`"
                icon="i-heroicons-calculator"
                :title="$t('gestion.ticketing.counters_title')"
                :description="$t('gestion.ticketing.counters_description')"
                color="teal"
              />

              <!-- Statistiques -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/ticketing/stats`"
                icon="i-heroicons-chart-bar"
                :title="$t('gestion.ticketing.stats_title')"
                :description="$t('gestion.ticketing.stats_description')"
                color="indigo"
              />
            </div>
          </div>
        </UCard>

        <!-- Workshops -->
        <UCard v-if="isOrganizer">
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-academic-cap" class="text-indigo-500" />
              <h2 class="text-lg font-semibold">{{ $t('gestion.workshops.title') }}</h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <!-- Gestion des workshops -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/workshops`"
                icon="i-heroicons-academic-cap"
                :title="$t('gestion.workshops.manage_title')"
                :description="$t('gestion.workshops.manage_description')"
                color="indigo"
              />
            </div>
          </div>
        </UCard>

        <!-- Objets trouvés (pas visible pour les team leaders seuls) -->
        <UCard v-if="!isTeamLeaderValue || canEdit || canManageVolunteers">
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-magnifying-glass" class="text-amber-500" />
              <h2 class="text-lg font-semibold">{{ $t('edition.lost_found') }}</h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <!-- Gestion des objets trouvés -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/lost-found`"
                icon="i-heroicons-magnifying-glass"
                :title="$t('gestion.manage_lost_found')"
                :description="$t('gestion.lost_found_description')"
                color="yellow"
              />
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { getEditionDisplayName } from '~/utils/editionName'

const route = useRoute()
const editionStore = useEditionStore()
const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))
const editionDisplayName = computed(() =>
  edition.value ? getEditionDisplayName(edition.value) : ''
)

onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }

  // Vérifier si l'utilisateur est team leader
  if (authStore.user?.id) {
    isTeamLeaderValue.value = await editionStore.isTeamLeader(editionId, authStore.user.id)
  }

  // Vérifier si l'utilisateur peut accéder à la validation des repas
  if (authStore.user?.id) {
    try {
      const response = await $fetch<{ canAccess: boolean }>(
        `/api/editions/${editionId}/permissions/can-access-meal-validation`
      )
      canAccessMealValidation.value = response.canAccess
    } catch (error) {
      console.error('Error checking meal validation access:', error)
      canAccessMealValidation.value = false
    }
  }
})

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false

  // Créateur de l'édition
  if (authStore.user.id === edition.value.creatorId) return true

  // Utilisateurs avec des droits spécifiques
  if (canEdit.value || canManageVolunteers.value) return true

  // Responsables d'équipe de bénévoles
  if (isTeamLeaderValue.value) return true

  // Bénévoles avec accès à la validation des repas
  if (canAccessMealValidation.value) return true

  // Tous les organisateurs de la convention (même sans droits)
  if (edition.value.convention?.organizers) {
    return edition.value.convention.organizers.some(
      (collab) => collab.user.id === authStore.user?.id
    )
  }

  return false
})

// Permissions calculées
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const canDelete = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canDeleteEdition(edition.value, authStore.user.id)
})

const canManageVolunteers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageVolunteers(edition.value, authStore.user.id)
})

const canManageOrganizers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageOrganizers(edition.value, authStore.user.id)
})

// Vérifier si l'utilisateur est organisateur de la convention
const isOrganizer = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.isOrganizer(edition.value, authStore.user.id)
})

// Vérifier si l'utilisateur peut accéder à la validation des repas
// (bénévole d'équipe de validation des repas)
const canAccessMealValidation = ref(false)

// État pour vérifier si l'utilisateur est team leader
const isTeamLeaderValue = ref(false)

// Gestion du statut de l'édition
const localStatus = ref<'PLANNED' | 'PUBLISHED' | 'OFFLINE' | 'CANCELLED'>(
  edition.value?.status || 'OFFLINE'
)

// Mettre à jour localStatus quand l'édition change
watch(
  () => edition.value?.status,
  (newStatus) => {
    if (newStatus) {
      localStatus.value = newStatus
    }
  },
  { immediate: true }
)

// Description du statut actuel
const currentStatusDescription = computed(() => {
  return t(`edition.status_description.${localStatus.value.toLowerCase()}`)
})

// Détecter si le statut a changé
const hasStatusChanged = computed(() => {
  return edition.value && localStatus.value !== edition.value.status
})

// Options de statut depuis le composable partagé
const { statusOptions } = useEditionStatus()

// Suppression d'édition avec modal de confirmation
const showDeleteConfirm = ref(false)

const { execute: executeDeleteEdition, loading: deletingEdition } = useApiAction(
  () => `/api/editions/${edition.value?.id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('messages.edition_deleted') },
    errorMessages: { default: t('errors.edition_deletion_failed') },
    onSuccess: () => {
      editionStore.editions = editionStore.editions.filter((e) => e.id !== editionId)
      showDeleteConfirm.value = false
      router.push('/')
    },
  }
)

const confirmDeleteEdition = () => {
  if (!edition.value) return
  executeDeleteEdition()
}

const { execute: executeSaveStatus, loading: savingStatus } = useApiAction(
  () => `/api/editions/${edition.value?.id}/status`,
  {
    method: 'PATCH',
    body: () => ({ status: localStatus.value }),
    successMessage: { title: t('edition.status_updated') },
    errorMessages: { default: t('errors.status_update_failed') },
    onSuccess: async () => {
      if (edition.value) {
        edition.value.status = localStatus.value
      }
      await editionStore.fetchEditionById(editionId, { force: true })
    },
    onError: () => {
      if (edition.value) {
        localStatus.value = edition.value.status
      }
    },
  }
)

const saveStatus = () => {
  if (!edition.value || !hasStatusChanged.value) return
  executeSaveStatus()
}
</script>
