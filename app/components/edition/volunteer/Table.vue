<template>
  <div class="flex flex-col flex-1 w-full">
    <div
      class="flex justify-between items-center gap-3 px-4 py-3.5 border border-accented border-b-0 bg-elevated rounded-t-lg"
    >
      <div class="flex gap-2 overflow-x-auto">
        <UButton
          size="md"
          variant="soft"
          color="neutral"
          icon="i-heroicons-arrow-path"
          :loading="applicationsLoading"
          class="whitespace-nowrap sm:!text-sm sm:!px-3 sm:!py-2"
          @click="refreshApplications"
        >
          <span class="hidden sm:inline">{{ t('common.refresh') }}</span>
        </UButton>

        <!-- Filtres -->
        <UModal>
          <UButton
            color="neutral"
            variant="subtle"
            icon="i-heroicons-funnel"
            size="md"
            class="whitespace-nowrap sm:!text-sm sm:!px-3 sm:!py-2"
          >
            <span class="hidden sm:inline">{{ t('common.filters') }}</span>
          </UButton>

          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ t('common.filters') }}
              </h3>
              <UButton
                size="sm"
                variant="ghost"
                icon="i-heroicons-arrow-uturn-left"
                :label="t('common.reset')"
                @click="resetApplicationsFilters"
              />
            </div>
          </template>

          <template #body>
            <div class="space-y-4">
              <UFormField :label="t('editions.volunteers.search')">
                <UInput
                  v-model="globalFilter"
                  :placeholder="t('editions.volunteers.search_placeholder')"
                  icon="i-heroicons-magnifying-glass"
                  size="lg"
                  class="w-full"
                  @keydown.enter.prevent="applySearch"
                />
              </UFormField>

              <UFormField :label="t('editions.volunteers.filter_status')">
                <USelect
                  v-model="applicationsFilterStatus"
                  :items="volunteerStatusItems"
                  :placeholder="t('editions.volunteers.status_all')"
                  icon="i-heroicons-funnel"
                  size="lg"
                  variant="soft"
                  class="w-full"
                  @change="onStatusFilterChange"
                />
              </UFormField>

              <UFormField :label="t('editions.volunteers.filter_presence')">
                <USelect
                  v-model="applicationsFilterPresence"
                  :items="volunteerPresenceItems"
                  :placeholder="t('editions.volunteers.presence_all')"
                  icon="i-heroicons-clock"
                  size="lg"
                  variant="soft"
                  class="w-full"
                  multiple
                  @change="onPresenceFilterChange"
                />
              </UFormField>

              <UFormField
                v-if="volunteersInfo?.askTeamPreferences && volunteerTeamItems.length > 0"
                :label="t('editions.volunteers.table_team_preferences')"
              >
                <USelect
                  v-model="applicationsFilterTeams"
                  :items="volunteerTeamItems"
                  :placeholder="t('editions.volunteers.teams_empty')"
                  icon="i-heroicons-user-group"
                  size="lg"
                  variant="soft"
                  class="w-full"
                  multiple
                  @change="onTeamsFilterChange"
                />
              </UFormField>

              <UFormField
                v-if="assignedTeamItems.length > 1"
                :label="t('editions.volunteers.filter_assigned_teams')"
              >
                <USelect
                  v-model="applicationsFilterAssignedTeams"
                  :items="assignedTeamItems"
                  :placeholder="t('editions.volunteers.assigned_teams_all')"
                  icon="i-heroicons-users"
                  size="lg"
                  variant="soft"
                  class="w-full"
                  multiple
                  @change="onAssignedTeamsFilterChange"
                />
              </UFormField>
            </div>
          </template>
        </UModal>
      </div>

      <UDropdownMenu
        :items="
          tableRef?.tableApi
            ?.getAllColumns()
            .filter((column: any) => column.getCanHide())
            .map((column: any) => ({
              label: getColumnLabel(column.id),
              type: 'checkbox' as const,
              checked: column.getIsVisible(),
              onUpdateChecked(checked: boolean) {
                tableRef?.tableApi?.getColumn(column.id)?.toggleVisibility(!!checked)
              },
              onSelect(e?: Event) {
                e?.preventDefault()
              },
            }))
        "
      >
        <UButton
          icon="i-heroicons-view-columns"
          color="neutral"
          size="md"
          variant="soft"
          trailing-icon="i-heroicons-chevron-down"
          class="whitespace-nowrap sm:!text-sm sm:!px-3 sm:!py-2"
        >
          <span class="hidden sm:inline">{{ t('editions.volunteers.columns') }}</span>
        </UButton>
      </UDropdownMenu>
    </div>
    <div
      class="flex justify-between items-center gap-2 border border-accented border-b-0 px-4 py-2 bg-elevated"
    >
      <span class="text-xs text-gray-500 italic">{{ $t('common.sort_tip') }}</span>
      <UButton
        size="md"
        color="neutral"
        variant="soft"
        icon="i-heroicons-arrow-down-tray"
        :loading="exportingApplications"
        class="whitespace-nowrap sm:!text-sm sm:!px-3 sm:!py-2"
        @click="exportApplications"
      >
        <span class="hidden sm:inline">{{ t('editions.volunteers.export') }}</span>
      </UButton>
    </div>

    <UContextMenu :items="items">
      <UTable
        ref="tableRef"
        v-model:sorting="sorting"
        v-model:column-visibility="columnVisibility"
        :data="tableData"
        :columns="columns"
        :loading="applicationsLoading"
        class="border border-accented"
        sticky
        @contextmenu="onContextmenu"
      >
        <template #actions-cell="{ row }">
          <div v-if="props.canManageVolunteers">
            <!-- Bouton Éditer disponible pour tous les statuts -->
            <div class="flex flex-col items-start gap-1 mb-2">
              <UButton
                :label="t('common.edit')"
                size="xs"
                color="neutral"
                variant="soft"
                icon="i-heroicons-pencil"
                @click="openEditApplicationModal(row.original)"
              />
            </div>

            <!-- Actions selon le statut -->
            <div v-if="row.original.status === 'PENDING'" class="flex flex-col items-start gap-1">
              <UButton
                :label="t('editions.volunteers.action_accept')"
                size="xs"
                color="success"
                variant="solid"
                :loading="applicationsActingId === row.original.id && actingAction === 'ACCEPTED'"
                @click="decideApplication(row.original, 'ACCEPTED')"
              />
              <UButton
                :label="t('editions.volunteers.action_reject')"
                size="xs"
                color="error"
                variant="solid"
                :loading="applicationsActingId === row.original.id && actingAction === 'REJECTED'"
                @click="decideApplication(row.original, 'REJECTED')"
              />
              <UButton
                v-if="row.original.source === 'MANUAL'"
                :label="t('editions.volunteers.action_delete')"
                size="xs"
                color="error"
                variant="soft"
                icon="i-heroicons-trash"
                @click="confirmDeleteApplication(row.original)"
              />
            </div>

            <div
              v-else-if="row.original.status === 'ACCEPTED'"
              class="flex flex-col items-start gap-1"
            >
              <UButton
                :label="t('editions.volunteers.action_edit_teams')"
                size="xs"
                color="primary"
                variant="solid"
                icon="i-heroicons-user-group"
                @click="openEditTeamsModal(row.original)"
              />
              <UButton
                :label="t('editions.volunteers.action_back_pending')"
                size="xs"
                color="warning"
                variant="soft"
                :loading="applicationsActingId === row.original.id && actingAction === 'PENDING'"
                @click="confirmBackToPending(row.original)"
              />
              <UButton
                v-if="row.original.source === 'MANUAL'"
                :label="t('editions.volunteers.action_delete')"
                size="xs"
                color="error"
                variant="soft"
                icon="i-heroicons-trash"
                @click="confirmDeleteApplication(row.original)"
              />
            </div>

            <div
              v-else-if="row.original.status === 'REJECTED'"
              class="flex flex-col items-start gap-1"
            >
              <UButton
                :label="t('editions.volunteers.action_back_pending')"
                size="xs"
                color="warning"
                variant="soft"
                :loading="applicationsActingId === row.original.id && actingAction === 'PENDING'"
                @click="confirmBackToPending(row.original)"
              />
              <UButton
                v-if="row.original.source === 'MANUAL'"
                :label="t('editions.volunteers.action_delete')"
                size="xs"
                color="error"
                variant="soft"
                icon="i-heroicons-trash"
                @click="confirmDeleteApplication(row.original)"
              />
            </div>
          </div>

          <span v-else class="text-xs text-gray-500 italic">
            {{ t('common.no_permission') }}
          </span>
        </template>
      </UTable>
    </UContextMenu>
    <div v-if="tableData.length === 0 && !applicationsLoading" class="text-xs text-gray-500 py-2">
      {{ t('editions.volunteers.no_applications') }}
    </div>
  </div>

  <div class="flex flex-wrap items-center justify-between gap-3 text-xs">
    <span>{{ filteredCountLabel }}</span>
    <UPagination
      v-if="serverPagination.totalPages > 1"
      v-model:page="serverPagination.page"
      :total="serverPagination.total"
      :items-per-page="serverPagination.pageSize"
      :disabled="applicationsLoading"
      size="xs"
      :show-edges="false"
      :sibling-count="1"
      @update:page="refreshApplications"
    />
  </div>

  <!-- Modal unifiée pour acceptation et modification des équipes -->
  <UModal v-model:open="teamsModalOpen">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon
          :name="modalMode === 'accept' ? 'i-heroicons-user-plus' : 'i-heroicons-user-group'"
          :class="modalMode === 'accept' ? 'text-green-600' : 'text-blue-600'"
        />
        <h3 class="font-semibold">
          {{
            modalMode === 'accept'
              ? t('editions.volunteers.accept_modal_title')
              : t('editions.volunteers.edit_teams_title')
          }}
        </h3>
      </div>
    </template>
    <template #body>
      <div v-if="currentApplication" class="space-y-4">
        <!-- Info du bénévole -->
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-user-circle" class="text-2xl text-gray-600" />
            <div>
              <div class="font-medium">{{ currentApplication.user.pseudo }}</div>
              <div class="text-sm text-gray-500">{{ currentApplication.user.email }}</div>
            </div>
          </div>
        </div>

        <!-- Sélection des équipes -->
        <div v-if="availableTeamsForModal.length > 0">
          <label class="block text-sm font-medium mb-2">
            {{ t('editions.volunteers.assign_to_teams') }}
          </label>
          <div class="space-y-2 max-h-60 overflow-y-auto">
            <div
              v-for="team in availableTeamsForModal"
              :key="team.id"
              class="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <UCheckbox
                :model-value="selectedTeams.includes(team.id)"
                :label="team.name"
                @update:model-value="toggleTeamSelection(team.id)"
              />
            </div>
          </div>
          <p class="text-xs text-gray-500 mt-2">
            {{ t('editions.volunteers.teams_selection_hint') }}
          </p>
        </div>

        <!-- Note optionnelle (seulement pour l'acceptation) -->
        <div v-if="modalMode === 'accept'">
          <label class="block text-sm font-medium mb-2">
            {{ t('editions.volunteers.accept_note_label') }}
          </label>
          <UTextarea
            v-model="acceptNote"
            :placeholder="t('editions.volunteers.accept_note_placeholder')"
            :rows="3"
            class="w-full"
          />
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton variant="ghost" @click="closeTeamsModal">
          {{ t('common.cancel') }}
        </UButton>
        <UButton
          :color="modalMode === 'accept' ? 'success' : 'primary'"
          :loading="teamsModalLoading"
          @click="confirmTeamsModal"
        >
          {{
            modalMode === 'accept'
              ? t('editions.volunteers.confirm_accept')
              : t('editions.volunteers.save_teams')
          }}
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- Modal d'édition des candidatures -->
  <EditionVolunteerApplicationModal
    v-model="editModalOpen"
    :volunteers-info="volunteersInfo"
    :edition="props.edition || { id: editionId }"
    :user="currentEditApplication?.user ?? null"
    :applying="false"
    :is-editing="true"
    :existing-application="currentEditApplication"
    :can-manage-edition="true"
    @close="closeEditApplicationModal"
    @update="handleEditApplicationUpdate"
  />

  <!-- Modal de confirmation pour remettre en attente -->
  <UiConfirmModal
    v-model="showBackToPendingModal"
    :title="t('editions.volunteers.confirm_action')"
    :description="t('editions.volunteers.confirm_back_pending')"
    :confirm-label="t('editions.volunteers.set_pending')"
    :cancel-label="t('common.cancel')"
    confirm-color="warning"
    icon-name="i-heroicons-arrow-path"
    icon-color="text-yellow-500"
    @confirm="executeBackToPending"
    @cancel="showBackToPendingModal = false"
  />

  <!-- Modal de confirmation pour supprimer une candidature ajoutée manuellement -->
  <UiConfirmModal
    v-model="showDeleteModal"
    :title="t('editions.volunteers.confirm_delete_title')"
    :description="t('editions.volunteers.confirm_delete_description')"
    :confirm-label="t('editions.volunteers.delete_application')"
    :cancel-label="t('common.cancel')"
    confirm-color="error"
    icon-name="i-heroicons-trash"
    icon-color="text-red-500"
    @confirm="executeDeleteApplication"
    @cancel="showDeleteModal = false"
  />
</template>

<script setup lang="ts">
import { h, resolveComponent, watch, onMounted, nextTick } from 'vue'

import {
  getAllergySeverityInfo,
  getAllergySeverityBadgeClasses,
  requiresEmergencyContact,
} from '~/utils/allergy-severity'
import {
  updateVolunteerApplication,
  updateVolunteerApplicationStatus,
  assignVolunteerTeams,
} from '~/utils/volunteer-application-api'

import type { ContextMenuItem, TableColumn, TableRow } from '@nuxt/ui'
import type { Column } from '@tanstack/vue-table'

interface Props {
  volunteersInfo: any
  editionId: number
  edition?: any
  canManageVolunteers: boolean
}

const emit = defineEmits<{
  refreshVolunteersInfo: []
  refreshTeamAssignments: []
}>()

const props = defineProps<Props>()

const { t } = useI18n()
const toast = useToast()
const { formatDateTimeWithGranularity } = useDateFormat()
const { teams: volunteerTeams } = useVolunteerTeams(props.editionId)

// Variables d'état internes du tableau
const applications = ref<any[]>([])
const applicationsLoading = ref(false)
const exportingApplications = ref(false)
const serverPagination = ref({ page: 1, pageSize: 20, total: 0, totalPages: 1 })
const applicationsFilterStatus = ref<string>('ALL')
const applicationsFilterTeams = ref<string[]>([])
const applicationsFilterPresence = ref<string[]>([])
const applicationsFilterAssignedTeams = ref<string[]>([])
const globalFilter = ref('')
const sorting = ref<{ id: string; desc: boolean }[]>([{ id: 'createdAt', desc: true }])
const columnVisibility = ref<Record<string, boolean>>({
  id: false,
})
const applicationsActingId = ref<number | null>(null)
const actingAction = ref<'ACCEPTED' | 'REJECTED' | 'PENDING' | null>(null)

// Variables pour la modal unifiée
const teamsModalOpen = ref(false)
const currentApplication = ref<any>(null)
const selectedTeams = ref<string[]>([])
const acceptNote = ref('')
const teamsModalLoading = ref(false)
const modalMode = ref<'accept' | 'edit'>('accept')

// Variables pour la modal d'édition des candidatures
const editModalOpen = ref(false)
const currentEditApplication = ref<any>(null)

// Référence pour le tableau
const tableRef = ref()

// Items pour les selects
const volunteerStatusItems = computed(() => [
  { label: t('editions.volunteers.status_all'), value: 'ALL' },
  { label: t('editions.volunteers.status_pending'), value: 'PENDING' },
  { label: t('editions.volunteers.status_accepted'), value: 'ACCEPTED' },
  { label: t('editions.volunteers.status_rejected'), value: 'REJECTED' },
])

const volunteerTeamItems = computed(() => {
  if (!props.volunteersInfo?.askTeamPreferences || !volunteerTeams.value.length) {
    return []
  }
  return volunteerTeams.value.map((team: any) => ({
    label: team.name,
    value: team.id,
  }))
})

const volunteerPresenceItems = computed(() => [
  { label: t('editions.volunteers.presence_setup'), value: 'setup' },
  { label: t('editions.volunteers.presence_event'), value: 'event' },
  { label: t('editions.volunteers.presence_teardown'), value: 'teardown' },
])

const assignedTeamItems = computed(() => {
  const items = []

  // Option pour "Sans équipe"
  items.push({
    label: t('editions.volunteers.filter_no_team'),
    value: 'NO_TEAM',
  })

  // Ajouter toutes les équipes disponibles
  if (volunteerTeams.value.length) {
    items.push(
      ...volunteerTeams.value.map((team: any) => ({
        label: team.name,
        value: team.id.toString(),
      }))
    )
  }

  return items
})

// Équipes disponibles pour la modal (utilise le nouveau système VolunteerTeam)
const availableTeamsForModal = computed(() => {
  if (!volunteerTeams.value.length || !currentApplication.value) {
    return []
  }

  const allTeams = volunteerTeams.value
  const preferredTeams = currentApplication.value.teamPreferences || []

  // Si le bénévole a des préférences d'équipes, on ne montre que celles-ci
  if (preferredTeams.length > 0) {
    return allTeams.filter((team: any) => preferredTeams.includes(team.id))
  }

  // Sinon on montre toutes les équipes
  return allTeams
})

// Computed pour les données du tableau
const tableData = computed(() =>
  applications.value.map((app) => ({
    ...app,
    pseudo: app.user.pseudo,
    email: app.user.email,
    phone: app.user.phone,
    prenom: app.user.prenom,
    nom: app.user.nom,
    dietaryPreference: (app as any).dietaryPreference,
    allergies: (app as any).allergies,
    allergySeverity: (app as any).allergySeverity,
    emergencyContactName: (app as any).emergencyContactName,
    emergencyContactPhone: (app as any).emergencyContactPhone,
    hasPets: (app as any).hasPets,
    petsDetails: (app as any).petsDetails,
    hasMinors: (app as any).hasMinors,
    minorsDetails: (app as any).minorsDetails,
    hasVehicle: (app as any).hasVehicle,
    vehicleDetails: (app as any).vehicleDetails,
    companionName: (app as any).companionName,
    avoidList: (app as any).avoidList,
  }))
)

const filteredCountLabel = computed(() => {
  const filtered = serverPagination.value.total
  const total = props.volunteersInfo?.counts?.total ?? filtered
  const page = serverPagination.value.page
  const pageSize = serverPagination.value.pageSize
  const start = applications.value.length === 0 ? 0 : (page - 1) * pageSize + 1
  const end = (page - 1) * pageSize + applications.value.length
  const boundedEnd = Math.min(end, filtered)
  const boundedStart = Math.min(start, filtered === 0 ? 0 : filtered)
  return `${t('editions.volunteers.filtered_count', { filtered, total })} (${boundedStart}–${boundedEnd})`
})

// Fonctions de gestion du tableau
const applySearch = () => {
  serverPagination.value.page = 1
  refreshApplications()
}

const onStatusFilterChange = () => {
  serverPagination.value.page = 1
  refreshApplications()
}

const onTeamsFilterChange = () => {
  serverPagination.value.page = 1
  refreshApplications()
}

const onPresenceFilterChange = () => {
  serverPagination.value.page = 1
  refreshApplications()
}

const onAssignedTeamsFilterChange = () => {
  serverPagination.value.page = 1
  refreshApplications()
}

const resetApplicationsFilters = () => {
  applicationsFilterStatus.value = 'ALL'
  applicationsFilterTeams.value = []
  applicationsFilterPresence.value = []
  applicationsFilterAssignedTeams.value = []
  globalFilter.value = ''
  sorting.value = [{ id: 'createdAt', desc: true }]
  serverPagination.value.page = 1
  refreshApplications()
}

const refreshApplications = async () => {
  applicationsLoading.value = true
  try {
    const primary = sorting.value[0]
    const secondary = sorting.value.slice(1)
    const sortField = primary?.id || 'createdAt'
    const sortDir = primary?.desc ? 'desc' : 'asc'
    const sortSecondary =
      secondary.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`).join(',') || undefined

    const res: any = await $fetch(`/api/editions/${props.editionId}/volunteers/applications`, {
      query: {
        page: serverPagination.value.page,
        pageSize: serverPagination.value.pageSize,
        status:
          applicationsFilterStatus.value && applicationsFilterStatus.value !== 'ALL'
            ? applicationsFilterStatus.value
            : undefined,
        teams:
          applicationsFilterTeams.value.length > 0
            ? applicationsFilterTeams.value.join(',')
            : undefined,
        presence:
          applicationsFilterPresence.value.length > 0
            ? applicationsFilterPresence.value.join(',')
            : undefined,
        assignedTeams:
          applicationsFilterAssignedTeams.value.length > 0
            ? applicationsFilterAssignedTeams.value.join(',')
            : undefined,
        sortField,
        sortDir,
        sortSecondary,
        search: globalFilter.value || undefined,
        includeTeams: 'true', // Inclure les équipes du nouveau système
      },
    } as any)
    applications.value = res.applications || []
    if (res.pagination) serverPagination.value = res.pagination
  } catch (e: any) {
    toast.add({ title: e?.message || t('common.error'), color: 'error' })
  } finally {
    applicationsLoading.value = false
  }
}

// Utilitaires
const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function getSortableHeader(column: Column<any>, label: string) {
  const isSorted = column.getIsSorted()
  return h(resolveComponent('UButton'), {
    color: 'neutral',
    variant: 'ghost',
    label,
    icon: isSorted
      ? isSorted === 'asc'
        ? 'i-lucide-arrow-up-narrow-wide'
        : 'i-lucide-arrow-down-wide-narrow'
      : 'i-lucide-arrow-up-down',
    class: '-mx-2.5',
    onClick: () => column.toggleSorting(isSorted === 'asc'),
  })
}

const volunteerStatusColor = (s: string) =>
  s === 'PENDING' ? 'warning' : s === 'ACCEPTED' ? 'success' : 'error'
const volunteerStatusLabel = (s: string) =>
  s === 'PENDING'
    ? t('editions.volunteers.status_pending')
    : s === 'ACCEPTED'
      ? t('editions.volunteers.status_accepted')
      : s === 'REJECTED'
        ? t('editions.volunteers.status_rejected')
        : s

const decideApplication = async (app: any, status: 'ACCEPTED' | 'REJECTED' | 'PENDING') => {
  // Si c'est une acceptation et qu'il y a des équipes configurées, ouvrir la modal
  if (status === 'ACCEPTED' && volunteerTeams.value.length > 0) {
    openAcceptModal(app)
    return
  }

  // Sinon, procéder directement
  applicationsActingId.value = app.id
  actingAction.value = status
  try {
    const res: any = await updateVolunteerApplicationStatus(props.editionId, app.id, status)
    if (res?.application) {
      emit('refreshVolunteersInfo')

      // Si on remet en attente ou on change vers accepté, rafraîchir les assignations d'équipes
      if (status === 'PENDING' || status === 'ACCEPTED') {
        emit('refreshTeamAssignments')
      }

      // Rafraîchir les données du tableau
      refreshApplications()
    }
  } catch (e: any) {
    toast.add({ title: e?.message || t('common.error'), color: 'error' })
  } finally {
    applicationsActingId.value = null
    actingAction.value = null
  }
}

// Modal de confirmation pour remettre en attente
const showBackToPendingModal = ref(false)
const applicationToPending = ref<any>(null)

// Fonction pour ouvrir la confirmation de remise en attente
const confirmBackToPending = (app: any) => {
  applicationToPending.value = app
  showBackToPendingModal.value = true
}

// Fonction pour confirmer la remise en attente
const executeBackToPending = () => {
  if (applicationToPending.value) {
    decideApplication(applicationToPending.value, 'PENDING')
  }
  showBackToPendingModal.value = false
  applicationToPending.value = null
}

// Modal de confirmation pour supprimer une candidature ajoutée manuellement
const showDeleteModal = ref(false)
const applicationToDelete = ref<any>(null)

// Fonction pour ouvrir la confirmation de suppression
const confirmDeleteApplication = (app: any) => {
  applicationToDelete.value = app
  showDeleteModal.value = true
}

// Fonction pour exécuter la suppression
const executeDeleteApplication = async () => {
  if (!applicationToDelete.value) return

  try {
    await $fetch(
      `/api/editions/${props.editionId}/volunteers/applications/${applicationToDelete.value.id}`,
      {
        method: 'DELETE',
      }
    )

    toast.add({
      title: t('editions.volunteers.application_deleted'),
      description: t('editions.volunteers.volunteer_removed_successfully'),
      color: 'success',
    })

    emit('refreshVolunteersInfo')
    refreshApplications()
  } catch (e: any) {
    toast.add({ title: e?.message || t('common.error'), color: 'error' })
  } finally {
    showDeleteModal.value = false
    applicationToDelete.value = null
  }
}

// Fonctions pour la modal d'acceptation
const toggleTeamSelection = (teamId: string) => {
  const index = selectedTeams.value.indexOf(teamId)
  if (index === -1) {
    selectedTeams.value.push(teamId)
  } else {
    selectedTeams.value.splice(index, 1)
  }
}

// Ouvrir la modal en mode acceptation
const openAcceptModal = (app: any) => {
  modalMode.value = 'accept'
  currentApplication.value = app
  selectedTeams.value = []
  acceptNote.value = ''
  teamsModalOpen.value = true

  // Si une seule équipe disponible, la cocher par défaut
  nextTick(() => {
    if (availableTeamsForModal.value.length === 1 && availableTeamsForModal.value[0]) {
      selectedTeams.value = [availableTeamsForModal.value[0].id]
    }
  })
}

// Ouvrir la modal en mode édition
const openEditTeamsModal = (app: any) => {
  modalMode.value = 'edit'
  currentApplication.value = app

  // Si l'application a des équipes dans le nouveau système, les utiliser
  if (app.teamAssignments && app.teamAssignments.length > 0) {
    selectedTeams.value = app.teamAssignments.map((ta: any) => ta.teamId)
  } else {
    // Par défaut, aucune équipe sélectionnée
    selectedTeams.value = []
  }

  acceptNote.value = ''
  teamsModalOpen.value = true

  // Si une seule équipe disponible et aucune sélectionnée, la cocher par défaut
  nextTick(() => {
    if (
      availableTeamsForModal.value.length === 1 &&
      selectedTeams.value.length === 0 &&
      availableTeamsForModal.value[0]
    ) {
      selectedTeams.value = [availableTeamsForModal.value[0].id]
    }
  })
}

// Fermer la modal
const closeTeamsModal = () => {
  teamsModalOpen.value = false
  currentApplication.value = null
  selectedTeams.value = []
  acceptNote.value = ''
  modalMode.value = 'accept'
}

// Fonction de confirmation unifiée
const confirmTeamsModal = async () => {
  if (!currentApplication.value) return

  teamsModalLoading.value = true
  try {
    if (modalMode.value === 'accept') {
      // Mode acceptation : d'abord assigner les équipes, puis accepter
      if (selectedTeams.value.length > 0) {
        // D'abord assigner les équipes
        await assignVolunteerTeams(
          props.editionId,
          currentApplication.value.id,
          selectedTeams.value
        )
      }

      // Ensuite accepter le bénévole
      await updateVolunteerApplicationStatus(
        props.editionId,
        currentApplication.value.id,
        'ACCEPTED',
        {
          note: acceptNote.value || undefined,
        }
      )

      emit('refreshVolunteersInfo')
      emit('refreshTeamAssignments')

      // Rafraîchir les données du tableau
      refreshApplications()

      toast.add({
        title: t('editions.volunteers.volunteer_accepted'),
        description:
          selectedTeams.value.length > 0
            ? t('editions.volunteers.assigned_to_teams', { count: selectedTeams.value.length })
            : undefined,
        color: 'success',
      })
    } else {
      // Mode édition : seulement assigner les équipes
      await assignVolunteerTeams(props.editionId, currentApplication.value.id, selectedTeams.value)

      emit('refreshVolunteersInfo')
      emit('refreshTeamAssignments')

      // Rafraîchir les données du tableau
      refreshApplications()

      toast.add({
        title: t('editions.volunteers.teams_updated'),
        description:
          selectedTeams.value.length > 0
            ? t('editions.volunteers.assigned_to_teams', { count: selectedTeams.value.length })
            : t('editions.volunteers.removed_from_teams'),
        color: 'success',
      })
    }

    closeTeamsModal()
  } catch (e: any) {
    toast.add({ title: e?.message || t('common.error'), color: 'error' })
  } finally {
    teamsModalLoading.value = false
  }
}

const exportApplications = async () => {
  exportingApplications.value = true
  try {
    // Convert sorting state en paramètres existants (compat backend)
    const primary = sorting.value[0]
    const secondary = sorting.value.slice(1)
    const sortField = primary?.id || 'createdAt'
    const sortDir = primary?.desc ? 'desc' : 'asc'
    const sortSecondary =
      secondary.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`).join(',') || undefined

    const params = {
      export: 'true', // Paramètre spécial pour l'export
      status:
        applicationsFilterStatus.value && applicationsFilterStatus.value !== 'ALL'
          ? applicationsFilterStatus.value
          : undefined,
      teams:
        applicationsFilterTeams.value.length > 0
          ? applicationsFilterTeams.value.join(',')
          : undefined,
      presence:
        applicationsFilterPresence.value.length > 0
          ? applicationsFilterPresence.value.join(',')
          : undefined,
      assignedTeams:
        applicationsFilterAssignedTeams.value.length > 0
          ? applicationsFilterAssignedTeams.value.join(',')
          : undefined,
      sortField,
      sortDir,
      sortSecondary,
      search: globalFilter.value || undefined,
    }

    // Créer l'URL avec les paramètres
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, value]) => value !== undefined) as [string, string][]
    ).toString()

    const url = `/api/editions/${props.editionId}/volunteers/applications?${queryString}`

    // Télécharger le fichier
    const link = document.createElement('a')
    link.href = url
    link.download = `candidatures-benevoles-edition-${props.editionId}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.add({
      title: t('common.export_success'),
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: e?.message || t('common.error'),
      color: 'error',
    })
  } finally {
    exportingApplications.value = false
  }
}

// Column visibility
const getColumnLabel = (columnId: string): string => {
  const labels: Record<string, string> = {
    id: 'ID',
    status: t('common.status'),
    pseudo: t('editions.volunteers.table_user'),
    prenom: t('editions.volunteers.table_first_name'),
    nom: t('editions.volunteers.table_last_name'),
    presence: t('editions.volunteers.table_presence'),
    dietaryPreference: t('editions.volunteers.table_diet'),
    allergies: t('editions.volunteers.table_allergies'),
    emergencyContact: t('pages.volunteers.emergency_contact'),
    hasPets: t('editions.volunteers.table_pets'),
    hasMinors: t('editions.volunteers.table_minors'),
    hasVehicle: t('editions.volunteers.table_vehicle'),
    companionName: t('editions.volunteers.table_companion'),
    avoidList: t('editions.volunteers.table_avoid_list'),
    skills: t('editions.volunteers.table_skills'),
    hasExperience: t('pages.volunteers.experience'),
    timePreferences: t('editions.volunteers.table_time_preferences'),
    teamPreferences: t('editions.volunteers.table_team_preferences'),
    assignedTeams: t('editions.volunteers.assigned_team'),
    createdAt: t('common.date'),
    motivation: t('editions.volunteers.table_motivation'),
    actions: t('common.actions'),
  }

  return labels[columnId] || columnId
}

// Définition des colonnes (reactive)
const columns = computed((): TableColumn<any>[] => [
  // ID en tout premier
  {
    accessorKey: 'id',
    header: ({ column }) => getSortableHeader(column, 'ID'),
    cell: ({ row }) => row.original.id,
    size: 80,
  },
  // Etat en deuxième
  {
    accessorKey: 'status',
    header: ({ column }) => getSortableHeader(column, t('common.status')),
    cell: ({ row }) => {
      const status = row.original.status
      const acceptanceNote = row.original.acceptanceNote

      // Si accepté avec une note, afficher avec tooltip
      if (status === 'ACCEPTED' && acceptanceNote) {
        return h('div', { class: 'flex items-center gap-1' }, [
          h(
            resolveComponent('UBadge'),
            {
              color: volunteerStatusColor(status),
              variant: 'soft',
              class: 'uppercase text-xs px-2 py-1',
            },
            () => volunteerStatusLabel(status)
          ),
          h(
            resolveComponent('UTooltip'),
            {
              text: acceptanceNote,
              openDelay: 200,
            },
            {
              default: () =>
                h(resolveComponent('UIcon'), {
                  name: 'i-heroicons-information-circle',
                  class: 'text-blue-500 cursor-help text-sm',
                }),
            }
          ),
        ])
      }

      // Sinon, affichage normal sans tooltip
      return h(
        resolveComponent('UBadge'),
        {
          color: volunteerStatusColor(status),
          variant: 'soft',
          class: 'uppercase text-xs px-2 py-1',
        },
        () => volunteerStatusLabel(status)
      )
    },
    size: 120,
  },
  // Date juste après l'état
  {
    accessorKey: 'createdAt',
    header: ({ column }) => getSortableHeader(column, t('common.date')),
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
  // Infos utilisateur
  {
    accessorKey: 'pseudo',
    header: ({ column }) => getSortableHeader(column, t('editions.volunteers.table_user')),
    cell: ({ row }) =>
      h('div', { class: 'flex flex-col' }, [
        h('span', { class: 'font-medium' }, row.original.user.pseudo),
        h('span', { class: 'text-xs text-gray-500' }, row.original.user.email),
        row.original.user.phone
          ? h('span', { class: 'text-xs text-gray-500' }, row.original.user.phone)
          : null,
      ]),
  },
  // Colonnes Prénom et Nom
  {
    accessorKey: 'prenom',
    header: ({ column }) => getSortableHeader(column, t('editions.volunteers.table_first_name')),
    cell: ({ row }) => row.original.user.prenom || '—',
  },
  {
    accessorKey: 'nom',
    header: ({ column }) => getSortableHeader(column, t('editions.volunteers.table_last_name')),
    cell: ({ row }) => row.original.user.nom || '—',
  },
  // Colonne présence
  {
    accessorKey: 'arrivalDateTime',
    header: ({ column }) => getSortableHeader(column, t('editions.volunteers.table_presence')),
    enableSorting: true,
    sortingFn: (rowA: any, rowB: any, _columnId: string) => {
      const arrivalA = rowA.original.arrivalDateTime
      const arrivalB = rowB.original.arrivalDateTime
      const departureA = rowA.original.departureDateTime
      const departureB = rowB.original.departureDateTime

      // Fonction pour convertir le format personnalisé en timestamp
      const parseCustomDate = (dateStr: string | null): number => {
        if (!dateStr) return Number.MAX_SAFE_INTEGER

        // Format: YYYY-MM-DD_timeOfDay (ex: "2025-10-30_afternoon")
        const parts = dateStr.split('_')
        const datePart = parts[0]
        const timePart = parts[1] || 'noon'

        // Convertir timeOfDay en heures
        const timeMap: Record<string, number> = {
          morning: 6,
          noon: 12,
          afternoon: 14,
          evening: 18,
        }

        const hours = timeMap[timePart] || 12
        const date = new Date(`${datePart}T${hours.toString().padStart(2, '0')}:00:00`)

        return date.getTime()
      }

      // Vérifier le sens du tri actuel pour cette colonne
      const currentSort = sorting.value.find((s) => s.id === 'arrivalDateTime')
      const isDescending = currentSort?.desc === true

      if (isDescending) {
        // Tri décroissant: se baser uniquement sur la date de départ
        const depTimeA = parseCustomDate(departureA)
        const depTimeB = parseCustomDate(departureB)
        return depTimeA - depTimeB
      } else {
        // Tri croissant: se baser sur la date d'arrivée, puis sur la date de départ
        const timeA = parseCustomDate(arrivalA)
        const timeB = parseCustomDate(arrivalB)

        // Comparer d'abord les dates d'arrivée
        if (timeA !== timeB) {
          return timeA - timeB
        }

        // Si dates d'arrivée identiques, comparer les dates de départ
        const depTimeA = parseCustomDate(departureA)
        const depTimeB = parseCustomDate(departureB)

        return depTimeA - depTimeB
      }
    },
    cell: ({ row }: any) => {
      const hasSetupAvailability = row.original.setupAvailability
      const hasTeardownAvailability = row.original.teardownAvailability
      const hasEventAvailability = row.original.eventAvailability
      const arrivalDateTime = row.original.arrivalDateTime
      const departureDateTime = row.original.departureDateTime

      if (
        !hasSetupAvailability &&
        !hasTeardownAvailability &&
        !hasEventAvailability &&
        !arrivalDateTime &&
        !departureDateTime
      ) {
        return h('span', '—')
      }

      // Construire les lignes d'affichage
      const lines = []

      // 1. Barre visuelle horizontale à trois sections
      lines.push(
        h('div', { class: 'flex gap-0.5 mb-2' }, [
          // Section Montage
          h(
            resolveComponent('UTooltip'),
            { text: 'Montage', arrow: true },
            {
              default: () =>
                h('div', {
                  class: `h-4 w-6 rounded-l ${
                    hasSetupAvailability ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-600'
                  }`,
                }),
            }
          ),
          // Section Événement
          h(
            resolveComponent('UTooltip'),
            { text: 'Événement', arrow: true },
            {
              default: () =>
                h('div', {
                  class: `h-4 w-6 ${
                    hasEventAvailability ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-600'
                  }`,
                }),
            }
          ),
          // Section Démontage
          h(
            resolveComponent('UTooltip'),
            { text: 'Démontage', arrow: true },
            {
              default: () =>
                h('div', {
                  class: `h-4 w-6 rounded-r ${
                    hasTeardownAvailability ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-600'
                  }`,
                }),
            }
          ),
        ])
      )

      // 2. Date d'arrivée avec granularité et icône
      if (arrivalDateTime) {
        lines.push(
          h('div', { class: 'flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400' }, [
            h(resolveComponent('UIcon'), {
              name: 'i-heroicons-arrow-right-end-on-rectangle',
              class: 'text-gray-500',
              size: '12',
            }),
            h('span', formatDateTimeWithGranularity(arrivalDateTime)),
          ])
        )
      }

      // 3. Date de départ avec granularité et icône
      if (departureDateTime) {
        lines.push(
          h('div', { class: 'flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400' }, [
            h(resolveComponent('UIcon'), {
              name: 'i-heroicons-arrow-left-start-on-rectangle',
              class: 'text-gray-500',
              size: '12',
            }),
            h('span', formatDateTimeWithGranularity(departureDateTime)),
          ])
        )
      }

      return h(
        'div',
        {
          class: 'flex flex-col gap-1 py-1',
        },
        lines
      )
    },
    size: 180,
  } as TableColumn<any>,
  // Colonne préférences horaires si activée (déplacée après Présence)
  ...(props.volunteersInfo?.askTimePreferences
    ? [
        {
          accessorKey: 'timePreferences',
          header: t('editions.volunteers.table_time_preferences'),
          cell: ({ row }: any) => {
            const preferences = row.original.timePreferences || []
            const allSlots = [
              'early_morning',
              'morning',
              'lunch',
              'early_afternoon',
              'late_afternoon',
              'evening',
              'late_evening',
              'night',
            ]

            return h(
              'div',
              { class: 'grid grid-cols-4 gap-1' },
              allSlots.map((slot) => {
                // Si aucun créneau préféré n'est renseigné, considérer tous les créneaux comme cochés
                const isSelected = preferences.length === 0 || preferences.includes(slot)
                const label = t(`editions.volunteers.time_slots_options.${slot}`)

                return h(
                  resolveComponent('UTooltip'),
                  { text: label, openDelay: 200 },
                  {
                    default: () =>
                      h('div', {
                        class: `w-3 h-3 rounded border ${
                          isSelected
                            ? 'bg-green-500 border-green-600'
                            : 'bg-gray-200 border-gray-300 dark:bg-gray-600 dark:border-gray-500'
                        }`,
                        title: label,
                      }),
                  }
                )
              })
            )
          },
        } as TableColumn<any>,
      ]
    : []),
  // Colonne régime si activée
  ...(props.volunteersInfo?.askDiet
    ? [
        {
          accessorKey: 'dietaryPreference',
          header: t('editions.volunteers.table_diet'),
          cell: ({ row }: any) => {
            const val = row.original.dietaryPreference || 'NONE'
            const key =
              val === 'VEGETARIAN'
                ? t('diet.vegetarian')
                : val === 'VEGAN'
                  ? t('diet.vegan')
                  : t('diet.none')
            return h('span', { class: 'text-xs' }, key)
          },
        } as TableColumn<any>,
      ]
    : []),
  // Colonne allergies si activée
  ...(props.volunteersInfo?.askAllergies
    ? [
        {
          accessorKey: 'allergies',
          header: ({ column }: any) =>
            getSortableHeader(column, t('editions.volunteers.table_allergies')),
          cell: ({ row }: any) => {
            if (!row.original.allergies) return '—'

            const severityBadge = row.original.allergySeverity
              ? h(
                  'span',
                  {
                    class: [
                      'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ml-1',
                      getAllergySeverityBadgeClasses(row.original.allergySeverity),
                    ],
                  },
                  t(getAllergySeverityInfo(row.original.allergySeverity).label)
                )
              : null

            return h('div', { class: 'flex items-center gap-1' }, [
              h('span', { class: 'text-xs truncate block max-w-[120px]' }, row.original.allergies),
              severityBadge,
            ])
          },
        } as TableColumn<any>,
      ]
    : []),
  // Colonne contact d'urgence si activée ou si allergies SEVERE/CRITICAL présentes
  ...(props.volunteersInfo?.askEmergencyContact ||
  tableData.value.some(
    (row: any) => row.allergySeverity && requiresEmergencyContact(row.allergySeverity)
  )
    ? [
        {
          accessorKey: 'emergencyContact',
          header: t('pages.volunteers.emergency_contact'),
          cell: ({ row }: any) => {
            const name = row.original.emergencyContactName
            const phone = row.original.emergencyContactPhone

            if (!name && !phone) return h('span', '—')

            const displayText = [name, phone].filter(Boolean).join(' - ')

            return h(
              resolveComponent('UTooltip'),
              { text: displayText, openDelay: 200 },
              {
                default: () =>
                  h(
                    'div',
                    {
                      class: 'max-w-xs truncate cursor-help text-xs',
                      title: displayText,
                    },
                    displayText
                  ),
              }
            )
          },
        } as TableColumn<any>,
      ]
    : []),
  // Colonne animaux de compagnie si activée
  ...(props.volunteersInfo?.askPets
    ? [
        {
          accessorKey: 'hasPets',
          header: t('editions.volunteers.table_pets'),
          cell: ({ row }: any) => {
            if (!row.original.hasPets) return h('span', '—')
            const petsDetails = row.original.petsDetails
            if (!petsDetails) return h('span', { class: 'text-xs' }, t('common.yes'))
            return h(
              resolveComponent('UTooltip'),
              { text: petsDetails, openDelay: 200 },
              {
                default: () =>
                  h(
                    'div',
                    {
                      class: 'flex items-center gap-1 cursor-help',
                    },
                    [
                      h('span', { class: 'text-xs' }, t('common.yes')),
                      h(resolveComponent('UIcon'), {
                        name: 'i-heroicons-information-circle',
                        class: 'text-gray-400',
                        size: '14',
                      }),
                    ]
                  ),
              }
            )
          },
        } as TableColumn<any>,
      ]
    : []),
  // Colonne personnes mineures si activée
  ...(props.volunteersInfo?.askMinors
    ? [
        {
          accessorKey: 'hasMinors',
          header: t('editions.volunteers.table_minors'),
          cell: ({ row }: any) => {
            if (!row.original.hasMinors) return h('span', '—')
            const minorsDetails = row.original.minorsDetails
            if (!minorsDetails) return h('span', { class: 'text-xs' }, t('common.yes'))
            return h(
              resolveComponent('UTooltip'),
              { text: minorsDetails, openDelay: 200 },
              {
                default: () =>
                  h(
                    'div',
                    {
                      class: 'flex items-center gap-1 cursor-help',
                    },
                    [
                      h('span', { class: 'text-xs' }, t('common.yes')),
                      h(resolveComponent('UIcon'), {
                        name: 'i-heroicons-information-circle',
                        class: 'text-gray-400',
                        size: '14',
                      }),
                    ]
                  ),
              }
            )
          },
        } as TableColumn<any>,
      ]
    : []),
  // Colonne véhicule si activée
  ...(props.volunteersInfo?.askVehicle
    ? [
        {
          accessorKey: 'hasVehicle',
          header: t('editions.volunteers.table_vehicle'),
          cell: ({ row }: any) => {
            if (!row.original.hasVehicle) return h('span', '—')
            const vehicleDetails = row.original.vehicleDetails
            if (!vehicleDetails) return h('span', { class: 'text-xs' }, t('common.yes'))
            return h(
              resolveComponent('UTooltip'),
              { text: vehicleDetails, openDelay: 200 },
              {
                default: () =>
                  h(
                    'div',
                    {
                      class: 'flex items-center gap-1 cursor-help',
                    },
                    [
                      h('span', { class: 'text-xs' }, t('common.yes')),
                      h(resolveComponent('UIcon'), {
                        name: 'i-heroicons-information-circle',
                        class: 'text-gray-400',
                        size: '14',
                      }),
                    ]
                  ),
              }
            )
          },
        } as TableColumn<any>,
      ]
    : []),
  // Colonne compagnon si activée
  ...(props.volunteersInfo?.askCompanion
    ? [
        {
          accessorKey: 'companionName',
          header: t('editions.volunteers.table_companion'),
          cell: ({ row }: any) => {
            const companionName = row.original.companionName
            if (!companionName) return h('span', '—')
            return h('span', { class: 'text-xs' }, companionName)
          },
        } as TableColumn<any>,
      ]
    : []),
  // Colonne liste à éviter si activée
  ...(props.volunteersInfo?.askAvoidList
    ? [
        {
          accessorKey: 'avoidList',
          header: t('editions.volunteers.table_avoid_list'),
          cell: ({ row }: any) => {
            const avoidList = row.original.avoidList
            if (!avoidList) return h('span', '—')
            return h(
              resolveComponent('UTooltip'),
              { text: avoidList, openDelay: 200 },
              {
                default: () =>
                  h(
                    'div',
                    {
                      class: 'flex items-center gap-1 cursor-help',
                    },
                    [
                      h('span', { class: 'text-xs max-w-[100px] truncate' }, avoidList),
                      h(resolveComponent('UIcon'), {
                        name: 'i-heroicons-information-circle',
                        class: 'text-gray-400',
                        size: '14',
                      }),
                    ]
                  ),
              }
            )
          },
        } as TableColumn<any>,
      ]
    : []),
  // Colonne compétences si activée
  ...(props.volunteersInfo?.askSkills
    ? [
        {
          accessorKey: 'skills',
          header: t('editions.volunteers.table_skills'),
          cell: ({ row }: any) => {
            const skills = row.original.skills
            if (!skills) return h('span', '—')
            return h(
              resolveComponent('UTooltip'),
              { text: skills, openDelay: 200 },
              {
                default: () =>
                  h(
                    'div',
                    {
                      class: 'flex items-center gap-1 cursor-help',
                    },
                    [
                      h('span', { class: 'text-xs max-w-[150px] truncate' }, skills),
                      h(resolveComponent('UIcon'), {
                        name: 'i-heroicons-information-circle',
                        class: 'text-gray-400',
                        size: '14',
                      }),
                    ]
                  ),
              }
            )
          },
        } as TableColumn<any>,
      ]
    : []),
  // Colonne équipes préférées si activée
  ...(props.volunteersInfo?.askTeamPreferences
    ? [
        {
          accessorKey: 'teamPreferences',
          header: t('editions.volunteers.table_team_preferences'),
          cell: ({ row }: any) => {
            const preferences = row.original.teamPreferences || []
            if (preferences.length === 0) return h('span', '—')

            const teams = volunteerTeams.value || []
            return h(
              'div',
              { class: 'flex flex-wrap gap-1' },
              preferences.map((teamId: string) => {
                const team = teams.find((t: any) => t.id === teamId)
                return h(
                  resolveComponent('UBadge'),
                  {
                    key: teamId,
                    color: 'neutral',
                    variant: 'soft',
                    size: 'sm',
                    style: team?.color
                      ? {
                          backgroundColor: team.color + '20',
                          borderColor: team.color,
                          color: team.color,
                        }
                      : undefined,
                  },
                  () => team?.name || teamId
                )
              })
            )
          },
        } as TableColumn<any>,
      ]
    : []),
  // Colonne équipes assignées (nouveau système)
  {
    accessorKey: 'assignedTeams',
    header: t('editions.volunteers.assigned_team'),
    cell: ({ row }: any) => {
      // Priorité au nouveau système teamAssignments
      const teamAssignments = row.original.teamAssignments
      if (teamAssignments && teamAssignments.length > 0) {
        return h(
          'div',
          { class: 'flex flex-wrap gap-1' },
          teamAssignments.map((assignment: any) =>
            h(
              resolveComponent('UBadge'),
              {
                key: assignment.teamId,
                color: 'primary',
                variant: 'soft',
                size: 'sm',
                style: assignment.team?.color
                  ? {
                      backgroundColor: assignment.team.color + '20',
                      borderColor: assignment.team.color,
                      color: assignment.team.color,
                    }
                  : undefined,
              },
              () => assignment.team?.name || assignment.teamId
            )
          )
        )
      }

      // Fallback vers l'ancien système
      const assignedTeams = row.original.assignedTeams
      if (assignedTeams && assignedTeams.length > 0) {
        return h(
          'div',
          { class: 'flex flex-wrap gap-1' },
          assignedTeams.map((teamName: string) =>
            h(
              resolveComponent('UBadge'),
              {
                key: teamName,
                color: 'gray',
                variant: 'soft',
                size: 'xs',
              },
              () => teamName
            )
          )
        )
      }

      return h('span', '—')
    },
  } as TableColumn<any>,
  // Colonne expérience si activée
  ...(props.volunteersInfo?.askExperience
    ? [
        {
          accessorKey: 'hasExperience',
          header: t('pages.volunteers.experience'),
          cell: ({ row }: any) => {
            if (!row.original.hasExperience) return h('span', '—')
            const experienceDetails = row.original.experienceDetails
            if (!experienceDetails) return h('span', { class: 'text-xs' }, t('common.yes'))
            return h(
              resolveComponent('UTooltip'),
              { text: experienceDetails, openDelay: 200 },
              {
                default: () =>
                  h(
                    'div',
                    {
                      class: 'flex items-center gap-1 cursor-help',
                    },
                    [
                      h('span', { class: 'text-xs' }, t('common.yes')),
                      h(resolveComponent('UIcon'), {
                        name: 'i-heroicons-information-circle',
                        class: 'text-gray-400',
                        size: '14',
                      }),
                    ]
                  ),
              }
            )
          },
        } as TableColumn<any>,
      ]
    : []),
  {
    id: 'motivation',
    header: t('editions.volunteers.table_motivation'),
    cell: ({ row }) => {
      const mot = row.original.motivation
      if (!mot) return h('span', '—')
      return h(
        resolveComponent('UTooltip'),
        { text: mot, openDelay: 200 },
        {
          default: () => h('div', { class: 'max-w-xs truncate cursor-help', title: mot }, mot),
        }
      )
    },
  },
  {
    id: 'source',
    header: t('editions.volunteers.table_source'),
    cell: ({ row }) => {
      const source = row.original.source
      const addedBy = row.original.addedBy
      const addedAt = row.original.addedAt

      // Si c'est une candidature spontanée
      if (source === 'APPLICATION') {
        return h(
          resolveComponent('UBadge'),
          {
            color: 'neutral',
            variant: 'soft',
            class: 'text-xs',
          },
          () => t('editions.volunteers.source_application')
        )
      }

      // Si c'est un ajout manuel
      if (source === 'MANUAL') {
        // Construire le texte du tooltip
        const addedByName = addedBy
          ? `${addedBy.prenom || ''} ${addedBy.nom || ''}`.trim() || addedBy.pseudo
          : t('common.unknown')
        const addedAtFormatted = addedAt ? formatDate(addedAt) : ''

        const tooltipText = t('editions.volunteers.added_manually_tooltip', {
          name: addedByName,
          date: addedAtFormatted,
        })

        return h(
          resolveComponent('UTooltip'),
          {
            text: tooltipText,
            arrow: true,
          },
          {
            default: () =>
              h(
                resolveComponent('UBadge'),
                {
                  color: 'primary',
                  variant: 'soft',
                  class: 'text-xs cursor-help',
                },
                () => t('editions.volunteers.source_manual')
              ),
          }
        )
      }

      return h('span', '—')
    },
    size: 120,
  },
  {
    id: 'actions',
    header: t('common.actions'),
  },
])

function getRowItems(row: TableRow<any>): ContextMenuItem[] {
  const items: ContextMenuItem[] = [
    {
      type: 'label' as const,
      label: `#${row.original.id} - ${row.original.user.pseudo} (${row.original.user.prenom} ${row.original.user.nom})`,
    },
  ]

  if (props.canManageVolunteers) {
    items.push({
      label: t('common.edit'),
      icon: 'i-heroicons-pencil-square',
      onSelect() {
        openEditApplicationModal(row.original)
      },
    })

    if (row.original.status === 'PENDING') {
      items.push({ type: 'separator' })
      items.push({
        label: t('editions.volunteers.action_accept'),
        icon: 'i-heroicons-check-circle',
        color: 'success',
        disabled:
          applicationsActingId.value === row.original.id && actingAction.value === 'ACCEPTED',
        onSelect() {
          decideApplication(row.original, 'ACCEPTED')
        },
      })
      items.push({
        label: t('editions.volunteers.action_reject'),
        icon: 'i-heroicons-x-circle',
        color: 'error',
        disabled:
          applicationsActingId.value === row.original.id && actingAction.value === 'REJECTED',
        onSelect() {
          decideApplication(row.original, 'REJECTED')
        },
      })
      if (row.original.source === 'MANUAL') {
        items.push({ type: 'separator' })
        items.push({
          label: t('editions.volunteers.action_delete'),
          icon: 'i-heroicons-trash',
          color: 'error',
          onSelect() {
            confirmDeleteApplication(row.original)
          },
        })
      }
    }

    if (row.original.status === 'ACCEPTED') {
      items.push({
        label: t('editions.volunteers.action_edit_teams'),
        icon: 'i-heroicons-user-group',
        color: 'primary',
        onSelect() {
          openEditTeamsModal(row.original)
        },
      })
      items.push({ type: 'separator' })
      items.push({
        label: t('editions.volunteers.action_back_pending'),
        icon: 'i-heroicons-arrow-uturn-left',
        color: 'warning',
        disabled:
          applicationsActingId.value === row.original.id && actingAction.value === 'PENDING',
        onSelect() {
          confirmBackToPending(row.original)
        },
      })
      if (row.original.source === 'MANUAL') {
        items.push({ type: 'separator' })
        items.push({
          label: t('editions.volunteers.action_delete'),
          icon: 'i-heroicons-trash',
          color: 'error',
          onSelect() {
            confirmDeleteApplication(row.original)
          },
        })
      }
    } else if (row.original.status === 'REJECTED') {
      items.push({ type: 'separator' })
      items.push({
        label: t('editions.volunteers.action_back_pending'),
        icon: 'i-heroicons-arrow-uturn-left',
        color: 'warning',
        disabled:
          applicationsActingId.value === row.original.id && actingAction.value === 'PENDING',
        onSelect() {
          confirmBackToPending(row.original)
        },
      })
      if (row.original.source === 'MANUAL') {
        items.push({ type: 'separator' })
        items.push({
          label: t('editions.volunteers.action_delete'),
          icon: 'i-heroicons-trash',
          color: 'error',
          onSelect() {
            confirmDeleteApplication(row.original)
          },
        })
      }
    }
  } else {
    items.push({
      label: t('common.no_permission'),
    })
  }

  return items
}

const items = ref<ContextMenuItem[]>([])

function onContextmenu(_e: Event, row: TableRow<any>) {
  items.value = getRowItems(row)
}

// Initialisation
onMounted(() => {
  refreshApplications()
})

// Watchers
watch(
  sorting,
  () => {
    serverPagination.value.page = 1
    refreshApplications()
  },
  { deep: true }
)

// Déclencheur de recherche global (debounce simple)
let searchTimeout: any
watch(globalFilter, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    serverPagination.value.page = 1
    refreshApplications()
  }, 350)
})

// Fonction pour ouvrir le modal d'édition d'une candidature
const openEditApplicationModal = (application: any) => {
  currentEditApplication.value = application
  editModalOpen.value = true
}

// Fonction pour fermer le modal d'édition
const closeEditApplicationModal = () => {
  editModalOpen.value = false
  currentEditApplication.value = null
}

// Fonction pour sauvegarder les modifications d'une candidature (ApplicationModal)
const handleEditApplicationUpdate = async (data: any) => {
  try {
    // Appeler l'API pour sauvegarder les changements via l'utilitaire
    await updateVolunteerApplication(props.editionId, data)

    // Rafraîchir les données
    emit('refreshVolunteersInfo')
    emit('refreshTeamAssignments')
    refreshApplications()

    // Fermer le modal
    closeEditApplicationModal()

    toast.add({
      title: t('editions.volunteers.application_updated'),
      description: t('editions.volunteers.notification_sent_to_volunteer'),
      color: 'success',
    })
  } catch (error: any) {
    toast.add({
      title: t('common.error'),
      description: error?.message || t('editions.volunteers.update_error'),
      color: 'error',
    })
  }
}

// Exposer les méthodes utiles
defineExpose({
  refreshApplications,
})
</script>
