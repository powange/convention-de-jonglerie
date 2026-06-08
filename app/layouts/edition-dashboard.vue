<template>
  <UMain>
    <UPage>
      <UDashboardGroup storage-key="edition-dashboard">
        <!-- Sidebar de navigation -->
        <UDashboardSidebar collapsible resizable>
          <template #header="{ collapsed }">
            <div class="flex items-center justify-between w-full">
              <div v-if="!collapsed" class="flex items-center gap-2">
                <UIcon name="i-heroicons-cog-6-tooth" class="text-primary-500" />
                <span class="font-semibold">{{ $t('gestion.title') }}</span>
              </div>
              <UIcon v-else name="i-heroicons-cog-6-tooth" class="text-primary-500" />
              <UDashboardSidebarCollapse
                :icon="
                  collapsed ? 'i-heroicons-chevron-double-right' : 'i-heroicons-chevron-double-left'
                "
                size="xs"
              />
            </div>
          </template>

          <!-- Navigation -->
          <template #default="{ collapsed }">
            <UNavigationMenu
              v-model="openSections"
              :collapsed="collapsed"
              :items="filteredNavigationItems"
              orientation="vertical"
              color="primary"
              variant="pill"
              highlight
              :collapsible="true"
              :ui="{
                link: 'text-base items-start',
                linkLeadingIcon: 'size-5',
                linkLabel: 'whitespace-normal',
                childLink: 'text-base items-start',
                childLinkIcon: 'size-5',
                childLinkLabel: 'whitespace-normal',
              }"
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
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                      {{ getEditionDisplayName(edition) }}
                      <template v-if="edition.startDate && edition.endDate">
                        &mdash; {{ formatDateRange(edition.startDate, edition.endDate) }}
                      </template>
                    </span>
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
            <AppFooter />
          </template>
        </UDashboardPanel>
      </UDashboardGroup>
    </UPage>
  </UMain>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { getEditionDisplayName } from '~/utils/editionName'

import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const authStore = useAuthStore()
const editionStore = useEditionStore()
const { t } = useI18n()
const { getImageUrl } = useImageUrl()
const { formatDateRange } = useDateFormat()

const editionId = computed(() => parseInt(route.params.id as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))

// Sections ouvertes dans le menu de navigation (contrôlées par v-model)
const openSections = ref<string[]>([])

// Déterminer la section active basée sur la route actuelle
const getCurrentSection = (path: string): string | null => {
  if (path.includes('/gestion/volunteers')) return 'volunteers'
  if (path.includes('/gestion/artists') || path.includes('/gestion/shows-call')) return 'artists'
  if (path.includes('/gestion/meals')) return 'meals'
  if (path.includes('/gestion/ticketing')) return 'ticketing'
  if (
    path.includes('/gestion/map') ||
    path.includes('/gestion/services') ||
    path.includes('/gestion/about') ||
    path.includes('/gestion/external-links') ||
    path.includes('/gestion/general-info') ||
    path.includes('/gestion/features') ||
    path.includes('/gestion/ai-update')
  )
    return 'infos'
  return null
}

// Auto-expand la section correspondant à la route actuelle
const expandCurrentSection = () => {
  const section = getCurrentSection(route.path)
  if (section && !openSections.value.includes(section)) {
    openSections.value = [...openSections.value, section]
  }
}

// Expand au montage et à chaque changement de route
watch(() => route.path, expandCurrentSection)
onMounted(expandCurrentSection)

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

const isUnclaimedConvention = computed(() => {
  if (!edition.value?.convention) return false
  return !edition.value.convention.organizers || edition.value.convention.organizers.length === 0
})

const _canManageArtists = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageArtists(edition.value, authStore.user.id)
})

const canManageTasks = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  const userId = authStore.user.id
  if (authStore.isAdminModeActive) return true
  if (edition.value.creatorId === userId) return true
  if (edition.value.convention?.authorId === userId) return true
  const organizers = edition.value.convention?.organizers || []
  return organizers.some((collab: any) => {
    if (collab.user?.id !== userId) return false
    if (collab.rights?.canManageTasks || collab.rights?.editConvention) return true
    if (collab.perEditionRights) {
      const per = collab.perEditionRights.find((r: any) => r.editionId === edition.value!.id)
      if (per?.canManageTasks || per?.canEdit) return true
    }
    return false
  })
})

const canManageStock = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  const userId = authStore.user.id
  if (authStore.isAdminModeActive) return true
  if (edition.value.creatorId === userId) return true
  if (edition.value.convention?.authorId === userId) return true
  const organizers = edition.value.convention?.organizers || []
  return organizers.some((collab: any) => {
    if (collab.user?.id !== userId) return false
    if (collab.rights?.manageStock || collab.rights?.editConvention) return true
    if (collab.perEditionRights) {
      const per = collab.perEditionRights.find((r: any) => r.editionId === edition.value!.id)
      if (per?.canManageStock || per?.canEdit) return true
    }
    return false
  })
})

// Affichage du stock : organisateurs avec canManageStock OU team leaders bénévoles
const canAccessStock = computed(() => canManageStock.value || isTeamLeader.value)

// Accès « bénévole » à la gestion, récupérés en un seul appel (endpoint unifié) :
// - isTeamLeader : responsable d'au moins une équipe de bénévoles
// - canAccessMealValidation : bénévole d'équipe de validation des repas
// - canAccessAccessControl : créneau actif de contrôle d'accès (rend la FAQ visible)
const isTeamLeader = ref(false)
const canAccessMealValidation = ref(false)
const canAccessAccessControl = ref(false)

// Mode bénévoles (INTERNAL ou EXTERNAL)
const volunteersMode = computed(() => edition.value?.volunteersMode || 'INTERNAL')
const isVolunteersModeInternal = computed(() => volunteersMode.value === 'INTERNAL')

// Charger les données au montage
onMounted(async () => {
  if (!edition.value) {
    await editionStore.fetchEditionById(editionId.value, { force: true })
  }

  // Charger en un seul appel les accès « bénévole » à la gestion
  if (authStore.user?.id) {
    const access = await editionStore.getManagementAccess(editionId.value)
    isTeamLeader.value = access.isTeamLeader
    canAccessMealValidation.value = access.canAccessMealValidation
    canAccessAccessControl.value = access.isAccessControlActive
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
      tooltip: { content: t('gestion.overview') },
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
          label: t('gestion.general_info.title'),
          icon: 'i-lucide-settings',
          to: `/editions/${editionId.value}/gestion/general-info`,
        },
        {
          label: t('gestion.about.title'),
          icon: 'i-lucide-file-text',
          to: `/editions/${editionId.value}/gestion/about`,
        },
        {
          label: t('gestion.services.title'),
          icon: 'i-lucide-wrench',
          to: `/editions/${editionId.value}/gestion/services`,
        },
        {
          label: t('gestion.external_links.title'),
          icon: 'i-lucide-link',
          to: `/editions/${editionId.value}/gestion/external-links`,
        },
        ...(edition.value?.siteMapEnabled
          ? [
              {
                label: t('gestion.map.title'),
                icon: 'i-lucide-map',
                to: `/editions/${editionId.value}/gestion/map`,
              },
            ]
          : []),
        {
          label: t('gestion.features.title'),
          icon: 'i-lucide-toggle-right',
          to: `/editions/${editionId.value}/gestion/features`,
        },
        ...(isUnclaimedConvention.value || authStore.isAdminModeActive
          ? [
              {
                label: t('gestion.ai_update.title'),
                icon: 'i-lucide-sparkles',
                to: `/editions/${editionId.value}/gestion/ai-update`,
              },
            ]
          : []),
      ],
      value: 'infos',
      popover: {},
    })
  }

  // Organisateurs
  if (canManageOrganizers.value) {
    managementSection.push({
      label: t('organizers.title'),
      icon: 'i-heroicons-user-group',
      to: `/editions/${editionId.value}/gestion/organizers`,
      tooltip: { content: t('organizers.title') },
    })
  }

  // Bénévoles
  if (edition.value?.volunteersEnabled && (canManageVolunteers.value || isTeamLeader.value)) {
    const volunteersChildren: NavigationMenuItem[] = []

    if (canManageVolunteers.value) {
      volunteersChildren.push({
        label: t('gestion.volunteers.config_title'),
        icon: 'i-heroicons-cog-6-tooth',
        to: `/editions/${editionId.value}/gestion/volunteers/config`,
      })

      volunteersChildren.push({
        label: t('edition.volunteers.volunteer_page'),
        icon: 'i-heroicons-clipboard-document-list',
        to: `/editions/${editionId.value}/gestion/volunteers/page`,
      })
    }

    if (canManageVolunteers.value && isVolunteersModeInternal.value) {
      volunteersChildren.push(
        {
          label: t('edition.volunteers.volunteer_form'),
          icon: 'i-heroicons-megaphone',
          to: `/editions/${editionId.value}/gestion/volunteers/form`,
        },
        {
          label: t('edition.volunteers.application_management'),
          icon: 'i-heroicons-document-text',
          to: `/editions/${editionId.value}/gestion/volunteers/applications`,
        },
        {
          label: t('edition.volunteers.teams'),
          icon: 'i-heroicons-user-group',
          to: `/editions/${editionId.value}/gestion/volunteers/teams`,
        },
        {
          label: t('edition.volunteers.planning'),
          icon: 'i-heroicons-calendar-days',
          to: `/editions/${editionId.value}/gestion/volunteers/planning`,
        }
      )
    }

    if ((canManageVolunteers.value || isTeamLeader.value) && isVolunteersModeInternal.value) {
      volunteersChildren.push({
        label: t('edition.volunteers.volunteer_notifications'),
        icon: 'i-heroicons-bell',
        to: `/editions/${editionId.value}/gestion/volunteers/notifications`,
      })
    }

    if (volunteersChildren.length > 0) {
      managementSection.push({
        label: t('edition.volunteers.title'),
        icon: 'i-heroicons-user-group',
        children: volunteersChildren,
        value: 'volunteers',
        popover: {},
      })
    }
  }

  // Artistes
  if (edition.value?.artistsEnabled && isOrganizer.value) {
    const artistsChildren: NavigationMenuItem[] = [
      {
        label: t('gestion.artists.list_title'),
        icon: 'i-heroicons-users',
        to: `/editions/${editionId.value}/gestion/artists`,
      },
      {
        label: t('gestion.shows.list_title'),
        icon: 'i-heroicons-sparkles',
        to: `/editions/${editionId.value}/gestion/artists/shows`,
      },
      {
        label: t('gestion.shows_call.title'),
        icon: 'i-heroicons-megaphone',
        to: `/editions/${editionId.value}/gestion/shows-call`,
      },
    ]

    managementSection.push({
      label: t('gestion.artists.title'),
      icon: 'i-heroicons-star',
      children: artistsChildren,
      value: 'artists',
      popover: {},
    })
  }

  // Repas
  if (edition.value?.mealsEnabled && (isOrganizer.value || canAccessMealValidation.value)) {
    const mealsChildren: NavigationMenuItem[] = []

    if (isOrganizer.value) {
      mealsChildren.push(
        {
          label: t('gestion.meals.configuration_title'),
          icon: 'cbi:mealie',
          to: `/editions/${editionId.value}/gestion/meals`,
        },
        {
          label: t('gestion.meals.list_title'),
          icon: 'i-heroicons-list-bullet',
          to: `/editions/${editionId.value}/gestion/meals/list`,
        }
      )
    }

    mealsChildren.push({
      label: t('gestion.meals.validation_title'),
      icon: 'i-heroicons-check-badge',
      to: `/editions/${editionId.value}/gestion/meals/validate`,
    })

    managementSection.push({
      label: t('gestion.meals.title'),
      icon: 'cbi:mealie',
      children: mealsChildren,
      value: 'meals',
      popover: {},
    })
  }

  // Billeterie
  if (edition.value?.ticketingEnabled && isOrganizer.value) {
    managementSection.push({
      label: t('gestion.ticketing.title'),
      icon: 'i-heroicons-ticket',
      children: [
        {
          label: t('gestion.ticketing.config_title'),
          icon: 'i-heroicons-cog-6-tooth',
          to: `/editions/${editionId.value}/gestion/ticketing/config`,
        },
        {
          label: t('gestion.ticketing.external_link_title'),
          icon: 'i-heroicons-link',
          to: `/editions/${editionId.value}/gestion/ticketing/external`,
        },
        {
          label: t('gestion.ticketing.tiers_title'),
          icon: 'i-heroicons-currency-euro',
          to: `/editions/${editionId.value}/gestion/ticketing/tiers`,
        },
        ...(edition.value?.ticketingHandoutItemsEnabled
          ? [
              {
                label: t('gestion.ticketing.handout_items_title'),
                icon: 'i-heroicons-gift',
                to: `/editions/${editionId.value}/gestion/ticketing/handout-items`,
              },
            ]
          : []),
        {
          label: t('gestion.ticketing.orders_title'),
          icon: 'i-heroicons-shopping-cart',
          to: `/editions/${editionId.value}/gestion/ticketing/orders`,
        },
        {
          label: t('gestion.ticketing.access_control_title'),
          icon: 'i-heroicons-shield-check',
          to: `/editions/${editionId.value}/gestion/ticketing/access-control`,
        },
        {
          label: t('gestion.ticketing.counters_title'),
          icon: 'i-heroicons-calculator',
          to: `/editions/${editionId.value}/gestion/ticketing/counter`,
        },
        {
          label: t('gestion.ticketing.stats_title'),
          icon: 'i-heroicons-chart-bar',
          to: `/editions/${editionId.value}/gestion/ticketing/stats`,
        },
      ],
      value: 'ticketing',
      popover: {},
    })
  }

  // Workshops
  if (isOrganizer.value && edition.value?.workshopsEnabled) {
    managementSection.push({
      label: t('gestion.workshops.title'),
      icon: 'i-heroicons-academic-cap',
      to: `/editions/${editionId.value}/gestion/workshops`,
      tooltip: { content: t('gestion.workshops.title') },
    })
  }

  // Tâches
  if (edition.value?.tasksEnabled && canManageTasks.value) {
    managementSection.push({
      label: t('gestion.tasks.title'),
      icon: 'i-heroicons-clipboard-document-check',
      to: `/editions/${editionId.value}/gestion/tasks`,
      tooltip: { content: t('gestion.tasks.title') },
    })
  }

  // Stock matériel
  if (edition.value?.stockEnabled && canAccessStock.value) {
    managementSection.push({
      label: t('gestion.stock.title'),
      icon: 'i-heroicons-archive-box',
      to: `/editions/${editionId.value}/gestion/stock`,
      tooltip: { content: t('gestion.stock.title') },
    })
  }

  // FAQ : visible pour les organisateurs (même sans canEdit), les
  // responsables d'équipe bénévoles et les bénévoles actuellement en
  // créneau (contrôle d'accès ou validation des repas). Les actions
  // de modification sont gardées côté page + côté API par `canEditEdition`.
  if (
    edition.value?.faqEnabled &&
    (canEdit.value ||
      isOrganizer.value ||
      isTeamLeader.value ||
      canAccessAccessControl.value ||
      canAccessMealValidation.value)
  ) {
    managementSection.push({
      label: t('gestion.faq.title'),
      icon: 'i-heroicons-question-mark-circle',
      to: `/editions/${editionId.value}/gestion/faq`,
      tooltip: { content: t('gestion.faq.title') },
    })
  }

  // Objets trouvés — accessible par : auteur/createur (canEdit),
  // responsables bénévoles, team leaders, ou tout organisateur de la convention.
  if (canEdit.value || canManageVolunteers.value || isTeamLeader.value || isOrganizer.value) {
    managementSection.push({
      label: t('edition.lost_found'),
      icon: 'i-heroicons-magnifying-glass',
      to: `/editions/${editionId.value}/gestion/lost-found`,
      tooltip: { content: t('edition.lost_found') },
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
