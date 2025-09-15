<template>
  <div v-if="edition">
    <EditionHeader
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
        <!-- Onglets -->
        <UTabs
          v-model="activeTab"
          :items="[
            { key: 'planning', label: t('editions.volunteers.planning'), slot: 'planning' },
            { key: 'teams', label: t('editions.volunteers.teams'), slot: 'teams' },
          ]"
        >
          <template #planning>
            <!-- Contenu de l'onglet planning -->
            <div class="space-y-6">
              <!-- Barre d'outils -->
              <div class="flex flex-wrap items-center justify-between gap-4">
                <div class="flex items-center gap-2">
                  <UButton
                    size="sm"
                    color="primary"
                    icon="i-heroicons-plus"
                    @click="openCreateSlotModal"
                  >
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
                  <UIcon
                    name="i-heroicons-arrow-path"
                    class="animate-spin text-gray-400"
                    size="20"
                  />
                  <span class="ml-2 text-base text-gray-500">{{ t('common.loading') }}</span>
                </div>
                <FullCalendar
                  v-else-if="calendarOptions"
                  ref="calendarRef"
                  :options="calendarOptions"
                  class="volunteer-planning-calendar"
                />
              </div>
            </div>
          </template>

          <template #teams>
            <!-- Contenu de l'onglet équipes -->
            <TeamManagement :edition-id="editionId" />
          </template>
        </UTabs>
      </div>
    </UCard>

    <!-- Modal de création/édition de créneau -->
    <SlotModal
      v-model="slotModalOpen"
      :teams="teams"
      :initial-slot="slotModalData"
      @save="handleSlotSave"
      @delete="handleSlotDelete"
    />
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
import SlotModal from '~/components/edition/volunteer/planning/SlotModal.vue'
import TeamManagement from '~/components/edition/volunteer/planning/TeamManagement.vue'
import type { VolunteerTimeSlot, VolunteerTeamCalendar } from '~/composables/useVolunteerSchedule'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

const { t } = useI18n()
const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const editionId = parseInt(route.params.id as string)

// Charger l'édition
await editionStore.fetchEditionById(editionId)
const edition = computed(() => editionStore.getEditionById(editionId))

// État du composant
const refreshing = ref(false)
const activeTab = ref('planning')

// État de la modal
const slotModalOpen = ref(false)
const slotModalData = ref<any>(null)

// Utilisation des vraies APIs
const { teams } = useVolunteerTeams(editionId)
const { timeSlots, createTimeSlot, updateTimeSlot, deleteTimeSlot } =
  useVolunteerTimeSlots(editionId)

// Conversion des données API pour compatibilité avec FullCalendar
const convertedTimeSlots = computed(() => {
  return timeSlots.value.map(
    (slot): VolunteerTimeSlot => ({
      id: slot.id,
      title: slot.title,
      start: slot.start,
      end: slot.end,
      teamId: slot.teamId,
      maxVolunteers: slot.maxVolunteers,
      assignedVolunteers: slot.assignedVolunteers,
      color: slot.color,
      description: slot.description,
    })
  )
})

const convertedTeams = computed(() => {
  return teams.value.map(
    (team): VolunteerTeamCalendar => ({
      id: team.id,
      name: team.name,
      color: team.color,
    })
  )
})

// Configuration du calendrier de planning
const { calendarRef, calendarOptions, ready } = useVolunteerSchedule({
  editionStartDate: edition.value?.startDate || '',
  editionEndDate: edition.value?.endDate || '',
  teams: convertedTeams,
  timeSlots: convertedTimeSlots,
  onTimeSlotCreate: (start, end, resourceId) => {
    // Ouvrir la modal avec les dates pré-remplies
    openSlotModal({
      start,
      end,
      teamId: resourceId === 'unassigned' ? '' : resourceId,
    })
  },
  onTimeSlotClick: (timeSlot: VolunteerTimeSlot) => {
    // Ouvrir la modal en mode édition lors d'un clic
    const existingSlot = timeSlots.value.find((s) => s.id === timeSlot.id)
    if (existingSlot) {
      // Convertir les dates au format attendu par datetime-local
      const formatDateTimeLocal = (dateStr: string) => {
        if (!dateStr) return ''
        return dateStr.replace(/:\d{2}Z?$/, '').substring(0, 16)
      }

      slotModalData.value = {
        id: existingSlot.id,
        title: existingSlot.title,
        description: existingSlot.description || '',
        teamId: existingSlot.teamId || '',
        startDateTime: formatDateTimeLocal(existingSlot.start),
        endDateTime: formatDateTimeLocal(existingSlot.end),
        maxVolunteers: existingSlot.maxVolunteers,
      }
      slotModalOpen.value = true
    }
  },
  onTimeSlotUpdate: async (timeSlot) => {
    // Mise à jour directe lors du drag & drop ou resize
    try {
      await updateTimeSlot(timeSlot.id, {
        title: timeSlot.title,
        description: timeSlot.description,
        teamId: timeSlot.teamId || undefined,
        startDateTime: timeSlot.start,
        endDateTime: timeSlot.end,
        maxVolunteers: timeSlot.maxVolunteers,
      })
      toast.add({
        title: t('editions.volunteers.slot_updated'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    } catch (error) {
      toast.add({
        title: t('errors.error_occurred'),
        description: error.message || 'Erreur lors de la mise à jour',
        icon: 'i-heroicons-x-circle',
        color: 'error',
      })
    }
  },
  onTimeSlotDelete: async (timeSlotId) => {
    if (confirm(t('editions.volunteers.confirm_delete_slot'))) {
      try {
        await deleteTimeSlot(timeSlotId)
        toast.add({
          title: t('editions.volunteers.slot_deleted'),
          icon: 'i-heroicons-check-circle',
          color: 'success',
        })
      } catch (error) {
        toast.add({
          title: t('errors.error_occurred'),
          description: error.message || 'Erreur lors de la suppression',
          icon: 'i-heroicons-x-circle',
          color: 'error',
        })
      }
    }
  },
})

// Actions de la modal
const openSlotModal = (initialData?: { start?: string; end?: string; teamId?: string }) => {
  // Convertir les dates au format attendu par datetime-local
  const formatDateTimeLocal = (dateStr: string) => {
    if (!dateStr) return ''
    // Enlever les secondes et la timezone si présentes
    return dateStr.replace(/:\d{2}Z?$/, '').substring(0, 16)
  }

  // Définir les données initiales
  slotModalData.value = {
    title: '',
    description: '',
    teamId: initialData?.teamId || '',
    startDateTime: formatDateTimeLocal(initialData?.start || ''),
    endDateTime: formatDateTimeLocal(initialData?.end || ''),
    maxVolunteers: 3,
  }
  slotModalOpen.value = true
}

const openCreateSlotModal = () => {
  // Utiliser les dates de l'édition par défaut
  const defaultStart = edition.value?.startDate ? `${edition.value.startDate}T09:00` : ''
  const defaultEnd = edition.value?.startDate ? `${edition.value.startDate}T10:00` : ''
  openSlotModal({
    start: defaultStart,
    end: defaultEnd,
  })
}

// Handlers pour la modal
const handleSlotSave = async (slotData: any) => {
  try {
    if (slotData.id) {
      // Mise à jour d'un créneau existant
      await updateTimeSlot(slotData.id, {
        title: slotData.title,
        description: slotData.description,
        teamId: slotData.teamId || undefined,
        startDateTime: slotData.start,
        endDateTime: slotData.end,
        maxVolunteers: slotData.maxVolunteers,
      })
      toast.add({
        title: t('editions.volunteers.slot_updated'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    } else {
      // Création d'un nouveau créneau
      await createTimeSlot({
        title: slotData.title,
        description: slotData.description,
        teamId: slotData.teamId || undefined,
        startDateTime: slotData.start,
        endDateTime: slotData.end,
        maxVolunteers: slotData.maxVolunteers,
      })
      toast.add({
        title: t('editions.volunteers.slot_created'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    }
  } catch (error) {
    toast.add({
      title: t('errors.error_occurred'),
      description: error.message || 'Erreur lors de la sauvegarde',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
  slotModalData.value = null
}

const handleSlotDelete = async (slotId: string) => {
  try {
    await deleteTimeSlot(slotId)
    toast.add({
      title: t('editions.volunteers.slot_deleted'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (error) {
    toast.add({
      title: t('errors.error_occurred'),
      description: error.message || 'Erreur lors de la suppression',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
  slotModalData.value = null
}

const refreshData = async () => {
  refreshing.value = true
  try {
    // Recharger les données depuis l'API
    const { fetchTeams } = useVolunteerTeams(editionId)
    const { fetchTimeSlots } = useVolunteerTimeSlots(editionId)

    await Promise.all([fetchTeams(), fetchTimeSlots()])
  } catch {
    toast.add({
      title: t('errors.error_occurred'),
      description: 'Erreur lors du rechargement des données',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
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
