<template>
  <div v-if="edition">
    <EditionEditionHeader
      :edition="edition"
      current-page="volunteers"
      :is-favorited="isFavorited(edition.id)"
      @toggle-favorite="toggleFavorite(edition.id)"
    />

    <UCard variant="soft" class="mb-6">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="i-heroicons-calendar-days" class="text-primary-500" />
            {{ t('editions.volunteers.schedule_management') }}
          </h3>
          <div v-if="canManageVolunteers" class="flex items-center gap-2">
            <UButton
              size="xs"
              color="primary"
              variant="soft"
              icon="i-heroicons-arrow-left"
              :to="`/editions/${edition?.id}/volunteers`"
            >
              {{ t('common.back') || 'Retour' }}
            </UButton>
          </div>
        </div>
      </template>

      <div class="space-y-6">
        <!-- Barre d'outils -->
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <UButton size="sm" color="primary" icon="i-heroicons-plus" @click="openCreateSlotModal">
              {{ t('editions.volunteers.create_time_slot') }}
            </UButton>
            <UButton
              size="sm"
              color="neutral"
              variant="soft"
              icon="i-heroicons-arrow-path"
              :loading="refreshing"
              @click="refreshData"
            >
              {{ t('common.refresh') }}
            </UButton>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-500">
              {{ t('editions.volunteers.planning_tip') }}
            </span>
          </div>
        </div>

        <!-- Calendrier de planning -->
        <div
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <div v-if="!ready" class="flex items-center justify-center py-8">
            <UIcon name="i-heroicons-arrow-path" class="animate-spin text-gray-400" size="20" />
            <span class="ml-2 text-base text-gray-500">{{ t('common.loading') }}</span>
          </div>
          <FullCalendar
            v-else
            ref="calendarRef"
            :options="calendarOptions"
            class="volunteer-planning-calendar"
          />
        </div>
      </div>
    </UCard>
  </div>
  <div v-else>
    <p>{{ t('editions.loading_details') }}</p>
  </div>
</template>

<script setup lang="ts">
// Vue & libs
import FullCalendar from '@fullcalendar/vue3'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

// App components & stores
import type { VolunteerTimeSlot, VolunteerTeam } from '~/composables/useVolunteerSchedule'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

const { t } = useI18n()
const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const editionId = parseInt(route.params.id as string)

// Charger l'édition
await editionStore.fetchEditionById(editionId)
const edition = computed(() => editionStore.getEditionById(editionId))

// État du composant
const refreshing = ref(false)

// Données mock pour l'instant (à remplacer par des vraies APIs)
const teams = ref<VolunteerTeam[]>([
  { id: 'team-1', name: 'Accueil', color: '#3b82f6' },
  { id: 'team-2', name: 'Technique', color: '#ef4444' },
  { id: 'team-3', name: 'Bar', color: '#10b981' },
  { id: 'team-4', name: 'Sécurité', color: '#f59e0b' },
])

const timeSlots = ref<VolunteerTimeSlot[]>([
  {
    id: 'slot-1',
    title: 'Accueil des visiteurs',
    start: edition.value?.startDate + 'T09:00:00',
    end: edition.value?.startDate + 'T12:00:00',
    teamId: 'team-1',
    maxVolunteers: 3,
    assignedVolunteers: 1,
    color: '#3b82f6',
    description: 'Accueil et orientation des visiteurs',
  },
  {
    id: 'slot-2',
    title: 'Garde de nuit',
    start: edition.value?.startDate + 'T22:00:00',
    end: edition.value
      ? new Date(new Date(edition.value.startDate).getTime() + 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0] + 'T08:00:00'
      : '',
    teamId: 'team-4',
    maxVolunteers: 2,
    assignedVolunteers: 0,
    color: '#f59e0b',
    description: 'Surveillance nocturne des équipements',
  },
])

// Configuration du calendrier de planning
const { calendarRef, calendarOptions, ready } = useVolunteerSchedule({
  editionStartDate: edition.value?.startDate || '',
  editionEndDate: edition.value?.endDate || '',
  teams,
  timeSlots,
  onTimeSlotCreate: (start, end, resourceId) => {
    console.log('Créer créneau:', { start, end, resourceId })
    // TODO: Ouvrir modal de création
  },
  onTimeSlotUpdate: (timeSlot) => {
    console.log('Mettre à jour créneau:', timeSlot)
    // TODO: API de mise à jour
  },
  onTimeSlotDelete: (timeSlotId) => {
    console.log('Supprimer créneau:', timeSlotId)
    // TODO: API de suppression
  },
})

// Actions
const openCreateSlotModal = () => {
  console.log('Ouvrir modal de création de créneau')
  // TODO: Implémenter modal
}

const refreshData = async () => {
  refreshing.value = true
  try {
    // TODO: Recharger les données depuis l'API
    await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulation
  } finally {
    refreshing.value = false
  }
}

// Gestion des favoris
const isFavorited = computed(() => (_id: number) => {
  return edition.value?.favoritedBy.some((u) => u.id === authStore.user?.id)
})

const toggleFavorite = async (id: number) => {
  try {
    await editionStore.toggleFavorite(id)
  } catch {
    /* silent */
  }
}

// Permissions pour gérer les bénévoles (repris de la page index)
const canManageVolunteers = computed(() => {
  if (!authStore.user || !edition.value) return false
  // Super Admin en mode admin
  if (authStore.isAdminModeActive) return true
  // Créateur de l'édition
  if (edition.value.creatorId === authStore.user.id) return true
  // Auteur de la convention
  if (edition.value.convention?.authorId === authStore.user.id) return true
  // Collaborateur avec droit global de gérer les bénévoles
  const collab = edition.value.convention?.collaborators?.find(
    (c: any) => c.user.id === authStore.user!.id
  )
  if (!collab) return false
  const rights = collab.rights || {}
  if (rights.manageVolunteers) return true
  // Collaborateur avec droit spécifique à cette édition
  const perEdition = (collab as any).perEdition || []
  const editionPerm = perEdition.find((p: any) => p.editionId === edition.value!.id)
  return editionPerm?.canManageVolunteers || false
})

// Metadata SEO
useHead({
  title: computed(() =>
    edition.value
      ? `Planning - ${edition.value.name || edition.value.convention?.name}`
      : 'Planning'
  ),
})
</script>

<style>
/* Styles pour le planning des bénévoles */
.volunteer-planning-calendar {
  /* Timeline resource view styling */
  --fc-border-color: rgb(229 231 235); /* gray-200 */
  --fc-neutral-bg-color: rgb(249 250 251); /* gray-50 */
}

.volunteer-planning-calendar .fc-theme-standard .fc-resource-timeline-divider {
  border-color: rgb(229 231 235);
}

.volunteer-planning-calendar .fc-theme-standard .fc-scrollgrid {
  border-color: rgb(229 231 235);
}

.volunteer-planning-calendar .fc-theme-standard td,
.volunteer-planning-calendar .fc-theme-standard th {
  border-color: rgb(229 231 235);
}

.volunteer-planning-calendar .fc-resource {
  background-color: rgb(249 250 251);
  color: rgb(17 24 39);
}

.volunteer-planning-calendar .fc-event {
  border: 1px solid;
  border-radius: 0.375rem;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  font-size: 0.875rem;
}

.volunteer-planning-calendar .fc-event:hover {
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.1),
    0 2px 4px -2px rgb(0 0 0 / 0.1);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .volunteer-planning-calendar {
    --fc-border-color: rgb(55 65 81); /* gray-700 */
    --fc-neutral-bg-color: rgb(31 41 55); /* gray-800 */
  }

  .volunteer-planning-calendar .fc-theme-standard .fc-resource-timeline-divider {
    border-color: rgb(55 65 81);
  }

  .volunteer-planning-calendar .fc-theme-standard .fc-scrollgrid {
    border-color: rgb(55 65 81);
  }

  .volunteer-planning-calendar .fc-theme-standard td,
  .volunteer-planning-calendar .fc-theme-standard th {
    border-color: rgb(55 65 81);
  }

  .volunteer-planning-calendar .fc-resource {
    background-color: rgb(31 41 55);
    color: rgb(243 244 246);
  }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .volunteer-planning-calendar .fc-toolbar {
    flex-direction: column;
    gap: 0.5rem;
  }

  .volunteer-planning-calendar .fc-toolbar-chunk {
    display: flex;
    justify-content: center;
  }
}
</style>
