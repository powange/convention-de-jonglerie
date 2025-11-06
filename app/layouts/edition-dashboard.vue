<template>
  <UMain>
    <UPage>
      <UDashboardGroup storage-key="edition-dashboard">
        <!-- Sidebar de navigation -->
        <UDashboardSidebar collapsible resizable>
          <template #header="{ collapsed }">
            <div v-if="!collapsed" class="flex items-center gap-2">
              <UIcon name="i-heroicons-cog-6-tooth" class="text-primary-500" />
              <span class="font-semibold">{{ $t('gestion.title') }}</span>
            </div>
            <UIcon v-else name="i-heroicons-cog-6-tooth" class="text-primary-500 mx-auto" />
          </template>

          <!-- Navigation -->
          <template #default="{ collapsed }">
            <UNavigationMenu
              :collapsed="collapsed"
              :items="filteredNavigationItems"
              orientation="vertical"
              color="primary"
              variant="pill"
            />
          </template>

          <template #footer="{ collapsed }">
            <UButton
              v-if="!collapsed"
              icon="i-heroicons-question-mark-circle"
              variant="ghost"
              color="neutral"
              block
              size="sm"
              :to="`/editions/${editionId}`"
            >
              {{ $t('common.help') }}
            </UButton>
            <UButton
              v-else
              icon="i-heroicons-question-mark-circle"
              variant="ghost"
              color="neutral"
              square
              size="sm"
              :to="`/editions/${editionId}`"
            />
          </template>
        </UDashboardSidebar>

        <!-- Contenu principal -->
        <UDashboardPanel>
          <template #header>
            <!-- Navbar en haut -->
            <UDashboardNavbar>
              <template #leading>
                <UDashboardSidebarCollapse />
              </template>

              <template #left>
                <div class="flex items-center gap-3">
                  <!-- Nom de la convention + édition -->
                  <div v-if="edition" class="flex items-center gap-2">
                    <img
                      v-if="edition.convention?.logo"
                      :src="
                        getImageUrl(edition.convention.logo, 'convention', edition.convention.id)
                      "
                      :alt="edition.convention.name"
                      class="h-8 w-8 rounded object-cover"
                    />
                    <div class="flex flex-col">
                      <span class="text-sm font-semibold">{{ edition.convention?.name }}</span>
                      <span class="text-xs text-gray-500 dark:text-gray-400">{{
                        getEditionDisplayName(edition)
                      }}</span>
                    </div>
                  </div>
                </div>
              </template>

              <template #right>
                <UButton
                  icon="i-heroicons-arrow-left"
                  variant="ghost"
                  size="sm"
                  :to="`/editions/${editionId}`"
                >
                  {{ $t('common.back') }}
                </UButton>

                <ClientOnly>
                  <!-- Sélecteur de langue -->
                  <UiSelectLanguage />

                  <UserAuthSection />
                </ClientOnly>
              </template>
            </UDashboardNavbar>
          </template>

          <template #body>
            <slot />
          </template>
        </UDashboardPanel>
      </UDashboardGroup>
    </UPage>
  </UMain>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { getEditionDisplayName } from '~/utils/editionName'

import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const authStore = useAuthStore()
const editionStore = useEditionStore()
const { t } = useI18n()
const { getImageUrl } = useImageUrl()

const editionId = computed(() => parseInt(route.params.id as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))

// Permissions calculées
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const canManageVolunteers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageVolunteers(edition.value, authStore.user.id)
})

const canManageCollaborators = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageCollaborators(edition.value, authStore.user.id)
})

const isCollaborator = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.isCollaborator(edition.value, authStore.user.id)
})

// Vérifier si l'utilisateur est team leader
const isTeamLeader = ref(false)
const canAccessMealValidation = ref(false)

// Mode bénévoles (INTERNAL ou EXTERNAL)
const volunteersMode = computed(() => edition.value?.volunteersMode || 'INTERNAL')
const isVolunteersModeInternal = computed(() => volunteersMode.value === 'INTERNAL')

// Charger les données au montage
onMounted(async () => {
  if (!edition.value) {
    await editionStore.fetchEditionById(editionId.value, { force: true })
  }

  // Vérifier si l'utilisateur est team leader
  if (authStore.user?.id) {
    isTeamLeader.value = await editionStore.isTeamLeader(editionId.value, authStore.user.id)
  }

  // Vérifier si l'utilisateur peut accéder à la validation des repas
  if (authStore.user?.id) {
    try {
      const response = await $fetch<{ canAccess: boolean }>(
        `/api/editions/${editionId.value}/permissions/can-access-meal-validation`
      )
      canAccessMealValidation.value = response.canAccess
    } catch (error) {
      console.error('Error checking meal validation access:', error)
      canAccessMealValidation.value = false
    }
  }
})

// Structure de navigation
const navigationItems = computed<NavigationMenuItem[][]>(() => {
  const items: NavigationMenuItem[][] = []

  // Première section : Vue d'ensemble
  const mainSection: NavigationMenuItem[] = [
    {
      label: t('gestion.overview'),
      icon: 'i-heroicons-home',
      to: `/editions/${editionId.value}/gestion`,
    },
  ]

  items.push(mainSection)

  // Deuxième section : Modules de gestion
  const managementSection: NavigationMenuItem[] = []

  // Collaborateurs
  if (canManageCollaborators.value) {
    managementSection.push({
      label: t('collaborators.title'),
      icon: 'i-heroicons-users',
      to: `/editions/${editionId.value}/gestion/collaborators`,
    })
  }

  // Bénévoles
  if (canManageVolunteers.value || isTeamLeader.value) {
    const volunteersChildren: NavigationMenuItem[] = []

    if (canManageVolunteers.value) {
      volunteersChildren.push({
        label: t('edition.volunteers.volunteer_page'),
        to: `/editions/${editionId.value}/gestion/volunteers/page`,
      })
    }

    if (canManageVolunteers.value && isVolunteersModeInternal.value) {
      volunteersChildren.push(
        {
          label: t('edition.volunteers.volunteer_form'),
          to: `/editions/${editionId.value}/gestion/volunteers/form`,
        },
        {
          label: t('edition.volunteers.application_management'),
          to: `/editions/${editionId.value}/gestion/volunteers/applications`,
        },
        {
          label: t('edition.volunteers.teams'),
          to: `/editions/${editionId.value}/gestion/volunteers/teams`,
        },
        {
          label: t('edition.volunteers.planning'),
          to: `/editions/${editionId.value}/gestion/volunteers/planning`,
        }
      )
    }

    if (canManageVolunteers.value || isTeamLeader.value) {
      volunteersChildren.push({
        label: t('edition.volunteers.volunteer_notifications'),
        to: `/editions/${editionId.value}/gestion/volunteers/notifications`,
      })
    }

    if (canManageVolunteers.value && isVolunteersModeInternal.value) {
      volunteersChildren.push({
        label: t('edition.volunteers.management_tools'),
        to: `/editions/${editionId.value}/gestion/volunteers/tools`,
      })
    }

    if (volunteersChildren.length > 0) {
      managementSection.push({
        label: t('edition.volunteers.title'),
        icon: 'i-heroicons-user-group',
        children: volunteersChildren
      })
    }
  }

  // Repas
  if (isCollaborator.value || canAccessMealValidation.value) {
    const mealsChildren: NavigationMenuItem[] = []

    if (isCollaborator.value) {
      mealsChildren.push(
        {
          label: t('gestion.meals.configuration_title'),
          to: `/editions/${editionId.value}/gestion/meals`,
        },
        {
          label: t('gestion.meals.list_title'),
          to: `/editions/${editionId.value}/gestion/meals/list`,
        }
      )
    }

    mealsChildren.push({
      label: t('gestion.meals.validation_title'),
      to: `/editions/${editionId.value}/gestion/meals/validate`,
    })

    managementSection.push({
      label: t('gestion.meals.title'),
      icon: 'cbi:mealie',
      children: mealsChildren,
    })
  }

  // Billeterie
  if (isCollaborator.value) {
    managementSection.push({
      label: t('gestion.ticketing.title'),
      icon: 'i-heroicons-ticket',
      children: [
        {
          label: t('gestion.ticketing.external_link_title'),
          to: `/editions/${editionId.value}/gestion/ticketing/external`,
        },
        {
          label: t('gestion.ticketing.tiers_title'),
          to: `/editions/${editionId.value}/gestion/ticketing/tiers`,
        },
        {
          label: t('gestion.ticketing.orders_title'),
          to: `/editions/${editionId.value}/gestion/ticketing/orders`,
        },
        {
          label: t('gestion.ticketing.access_control_title'),
          to: `/editions/${editionId.value}/gestion/ticketing/access-control`,
        },
      ],
    })
  }

  // Artistes
  if (isCollaborator.value) {
    managementSection.push({
      label: t('gestion.artists.title'),
      icon: 'i-heroicons-star',
      children: [
        {
          label: t('gestion.artists.list_title'),
          to: `/editions/${editionId.value}/gestion/artists`,
        },
        {
          label: t('edition.shows.list_title'),
          to: `/editions/${editionId.value}/gestion/artists/shows`,
        },
      ],
    })
  }

  // Workshops
  if (isCollaborator.value && edition.value?.workshopsEnabled) {
    managementSection.push({
      label: t('gestion.workshops.title'),
      icon: 'i-heroicons-academic-cap',
      to: `/editions/${editionId.value}/gestion/workshops`,
    })
  }

  // Objets trouvés
  if (!isTeamLeader.value || canEdit.value || canManageVolunteers.value) {
    const hasEditionStarted = edition.value
      ? new Date() >= new Date(edition.value.startDate)
      : false

    if (hasEditionStarted) {
      managementSection.push({
        label: t('edition.lost_found'),
        icon: 'i-heroicons-magnifying-glass',
        to: `/editions/${editionId.value}/gestion/lost-found`,
      })
    }
  }

  if (managementSection.length > 0) {
    items.push(managementSection)
  }

  return items
})

// Filtrer les items selon les permissions (déjà fait dans computed)
const filteredNavigationItems = computed(() => navigationItems.value)
</script>
