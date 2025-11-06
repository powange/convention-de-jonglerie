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
        <!-- Actions de gestion -->
        <UCard v-if="hasManagementActions">
          <div class="space-y-4">
            <h2 class="text-lg font-semibold">{{ $t('common.actions') }}</h2>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-if="canEdit"
                icon="i-heroicons-pencil"
                color="warning"
                :to="`/editions/${edition.id}/edit`"
              >
                {{ $t('gestion.edit_edition') }}
              </UButton>
              <UButton
                v-if="canEdit && edition.isOnline"
                :icon="'i-heroicons-eye-slash'"
                color="secondary"
                variant="soft"
                @click="toggleOnlineStatus(false)"
              >
                {{ $t('edition.set_offline') }}
              </UButton>
              <UButton
                v-else-if="canEdit && !edition.isOnline"
                :icon="'i-heroicons-globe-alt'"
                color="primary"
                @click="toggleOnlineStatus(true)"
              >
                {{ $t('edition.set_online') }}
              </UButton>
              <UButton
                v-if="canDelete"
                icon="i-heroicons-trash"
                color="error"
                variant="soft"
                @click="deleteEdition(edition.id)"
              >
                {{ $t('gestion.delete_edition') }}
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Collaborateurs -->
        <UCard v-if="canManageCollaborators">
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-user-group" class="text-purple-500" />
              <h2 class="text-lg font-semibold">{{ $t('collaborators.title') }}</h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <!-- Gérer les collaborateurs -->
              <ManagementNavigationCard
                :to="`/editions/${edition.id}/gestion/collaborators`"
                icon="i-heroicons-user-group"
                :title="$t('collaborators.manage')"
                :description="$t('collaborators.manage_description')"
                color="purple"
              />
            </div>
          </div>
        </UCard>

        <!-- Gestion bénévole -->
        <UCard v-if="isCollaborator || isTeamLeaderValue">
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-user-group" class="text-primary-500" />
              <h2 class="text-lg font-semibold">
                {{ $t('edition.ticketing.volunteer_management') }}
              </h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
        <UCard v-if="isCollaborator">
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
            </div>
          </div>
        </UCard>

        <!-- Repas (accès complet pour collaborateurs) -->
        <UCard v-if="isCollaborator">
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
        <UCard v-if="isCollaborator">
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-ticket" class="text-blue-500" />
              <h2 class="text-lg font-semibold">{{ $t('gestion.ticketing.title') }}</h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
            </div>
          </div>
        </UCard>

        <!-- Workshops -->
        <UCard v-if="isCollaborator">
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
import { onMounted, computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

definePageMeta({
  layout: 'edition-dashboard',
})

const route = useRoute()
const editionStore = useEditionStore()
const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

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

  // Tous les collaborateurs de la convention (même sans droits)
  if (edition.value.convention?.collaborators) {
    return edition.value.convention.collaborators.some(
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

const canManageCollaborators = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageCollaborators(edition.value, authStore.user.id)
})

// Vérifier si l'utilisateur est collaborateur de la convention
const isCollaborator = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.isCollaborator(edition.value, authStore.user.id)
})

// Vérifier si l'utilisateur peut accéder à la validation des repas
// (bénévole d'équipe de validation des repas)
const canAccessMealValidation = ref(false)

// État pour vérifier si l'utilisateur est team leader
const isTeamLeaderValue = ref(false)

// Vérifier s'il y a des actions de gestion disponibles
const hasManagementActions = computed(() => {
  return canEdit.value || canDelete.value
})

const deleteEdition = async (id: number) => {
  if (confirm(t('gestion.confirm_delete_edition'))) {
    try {
      await editionStore.deleteEdition(id)
      toast.add({
        title: t('messages.edition_deleted'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
      router.push('/')
    } catch (e: any) {
      toast.add({
        title: e?.message || t('errors.edition_deletion_failed'),
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
    }
  }
}

const toggleOnlineStatus = async (isOnline: boolean) => {
  if (!edition.value) return

  try {
    await $fetch(`/api/editions/${edition.value.id}/status`, {
      method: 'PATCH',
      body: { isOnline },
    })

    // Update local state immediately
    edition.value.isOnline = isOnline

    // Also update in store
    await editionStore.fetchEditionById(editionId, { force: true })

    const message = isOnline ? t('edition.edition_published') : t('edition.edition_set_offline')
    toast.add({
      title: message,
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (error) {
    console.error('Failed to toggle edition status:', error)
    toast.add({
      title: t('errors.status_update_failed'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}
</script>
