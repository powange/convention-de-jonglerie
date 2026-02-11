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
              :collapsible="true"
            />
          </template>

          <template #footer="{ collapsed }">
            <UButton
              v-if="!collapsed"
              icon="i-heroicons-arrow-left"
              variant="ghost"
              color="neutral"
              block
              size="sm"
              :to="`/editions/${editionId}`"
            >
              {{ $t('gestion.view_edition') }}
            </UButton>
            <UButton
              v-else
              icon="i-heroicons-arrow-left"
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
                <!-- Nom de la convention + édition -->
                <div v-if="edition" class="flex items-center gap-3">
                  <img
                    v-if="edition.imageUrl"
                    :src="getImageUrl(edition.imageUrl, 'edition', edition.id)"
                    :alt="getEditionDisplayName(edition)"
                    class="h-10 w-auto rounded object-contain"
                  />
                  <img
                    v-else-if="edition.convention?.logo"
                    :src="getImageUrl(edition.convention.logo, 'convention', edition.convention.id)"
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
              </template>

              <template #right>
                <ClientOnly>
                  <!-- Sélecteur de langue (masqué sur mobile, déjà dans le menu) -->
                  <UiSelectLanguage class="hidden sm:block" />

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

// Fonction pour déterminer si un accordéon doit être ouvert basé sur la route actuelle
const isAccordionOpen = (section: string): boolean => {
  return route.path.includes(`/gestion/${section}`)
}

// Permissions calculées
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const canManageVolunteers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageVolunteers(edition.value, authStore.user.id)
})

const canManageOrganizers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageOrganizers(edition.value, authStore.user.id)
})

const isOrganizer = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.isOrganizer(edition.value, authStore.user.id)
})

const _canManageArtists = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageArtists(edition.value, authStore.user.id)
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

  // Informations
  if (canEdit.value) {
    managementSection.push({
      label: t('gestion.infos.title'),
      icon: 'i-lucide-info',
      children: [
        {
          label: t('gestion.edit_edition'),
          icon: 'i-heroicons-pencil',
          to: `/editions/${editionId.value}/edit`,
        },
        {
          label: t('gestion.map.title'),
          icon: 'i-lucide-map',
          to: `/editions/${editionId.value}/gestion/map`,
        },
      ],
      value: 'infos',
      defaultOpen: isAccordionOpen('map'),
    })
  }

  // Organisateurs
  if (canManageOrganizers.value) {
    managementSection.push({
      label: t('organizers.title'),
      icon: 'i-heroicons-users',
      to: `/editions/${editionId.value}/gestion/organizers`,
    })
  }

  // Bénévoles
  if (canManageVolunteers.value || isTeamLeader.value) {
    const volunteersChildren: NavigationMenuItem[] = []

    if (canManageVolunteers.value) {
      volunteersChildren.push({
        label: t('gestion.volunteers.config_title'),
        to: `/editions/${editionId.value}/gestion/volunteers/config`,
      })

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

    if ((canManageVolunteers.value || isTeamLeader.value) && isVolunteersModeInternal.value) {
      volunteersChildren.push({
        label: t('edition.volunteers.volunteer_notifications'),
        to: `/editions/${editionId.value}/gestion/volunteers/notifications`,
      })
    }

    if (volunteersChildren.length > 0) {
      managementSection.push({
        label: t('edition.volunteers.title'),
        icon: 'i-heroicons-user-group',
        children: volunteersChildren,
        value: 'volunteers',
        defaultOpen: isAccordionOpen('volunteers'),
      })
    }
  }

  // Artistes
  if (isOrganizer.value) {
    const artistsChildren: NavigationMenuItem[] = [
      {
        label: t('gestion.artists.list_title'),
        to: `/editions/${editionId.value}/gestion/artists`,
      },
      {
        label: t('gestion.shows.list_title'),
        to: `/editions/${editionId.value}/gestion/artists/shows`,
      },
      {
        label: t('gestion.shows_call.title'),
        to: `/editions/${editionId.value}/gestion/shows-call`,
      },
    ]

    managementSection.push({
      label: t('gestion.artists.title'),
      icon: 'i-heroicons-star',
      children: artistsChildren,
      value: 'artists',
      defaultOpen: isAccordionOpen('artists') || isAccordionOpen('shows-call'),
    })
  }

  // Repas
  if (isOrganizer.value || canAccessMealValidation.value) {
    const mealsChildren: NavigationMenuItem[] = []

    if (isOrganizer.value) {
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
      value: 'meals',
      defaultOpen: isAccordionOpen('meals'),
    })
  }

  // Billeterie
  if (isOrganizer.value) {
    managementSection.push({
      label: t('gestion.ticketing.title'),
      icon: 'i-heroicons-ticket',
      children: [
        {
          label: t('gestion.ticketing.config_title'),
          to: `/editions/${editionId.value}/gestion/ticketing/config`,
        },
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
        {
          label: t('gestion.ticketing.counters_title'),
          to: `/editions/${editionId.value}/gestion/ticketing/counter`,
        },
        {
          label: t('gestion.ticketing.stats_title'),
          to: `/editions/${editionId.value}/gestion/ticketing/stats`,
        },
      ],
      value: 'ticketing',
      defaultOpen: isAccordionOpen('ticketing'),
    })
  }

  // Workshops
  if (isOrganizer.value) {
    managementSection.push({
      label: t('gestion.workshops.title'),
      icon: 'i-heroicons-academic-cap',
      to: `/editions/${editionId.value}/gestion/workshops`,
    })
  }

  // Objets trouvés
  if (!isTeamLeader.value || canEdit.value || canManageVolunteers.value) {
    managementSection.push({
      label: t('edition.lost_found'),
      icon: 'i-heroicons-magnifying-glass',
      to: `/editions/${editionId.value}/gestion/lost-found`,
    })
  }

  if (managementSection.length > 0) {
    items.push(managementSection)
  }

  return items
})

// Filtrer les items selon les permissions (déjà fait dans computed)
const filteredNavigationItems = computed(() => navigationItems.value)
</script>
