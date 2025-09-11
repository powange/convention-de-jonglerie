<template>
  <div class="flex flex-col flex-1 w-full">
    <div
      class="flex justify-between px-4 py-3.5 border border-accented border-b-0 bg-elevated rounded-t-lg"
    >
      <div class="flex gap-2">
        <UButton
          size="lg"
          variant="soft"
          color="neutral"
          icon="i-heroicons-arrow-path"
          :loading="applicationsLoading"
          @click="refreshApplications"
        >
          {{ t('common.refresh') }}
        </UButton>

        <!-- Filtres -->
        <UModal>
          <UButton
            :label="t('common.filters')"
            color="neutral"
            variant="subtle"
            icon="i-heroicons-funnel"
          />

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
            </div>
          </template>
        </UModal>
      </div>

      <UDropdownMenu
        :items="
          tableRef?.tableApi
            ?.getAllColumns()
            .filter((column) => column.getCanHide())
            .map((column) => ({
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
          size="lg"
          variant="soft"
          :label="t('editions.volunteers.columns')"
          trailing-icon="i-heroicons-chevron-down"
        />
      </UDropdownMenu>
    </div>
    <div
      class="flex justify-between items-center border border-accented border-b-0 px-4 py-2 bg-elevated"
    >
      <span class="text-xs text-gray-500 italic">{{ $t('common.sort_tip') }}</span>
      <UButton
        size="lg"
        color="neutral"
        variant="soft"
        icon="i-heroicons-arrow-down-tray"
        :loading="exportingApplications"
        @click="exportApplications"
      >
        {{ t('editions.volunteers.export') }}
      </UButton>
    </div>
    <UTable
      ref="tableRef"
      v-model:sorting="sorting"
      v-model:column-visibility="columnVisibility"
      :data="tableData"
      :columns="columns"
      :loading="applicationsLoading"
      class="border border-accented"
      sticky
    />
    <div v-if="tableData.length === 0 && !applicationsLoading" class="text-xs text-gray-500 py-2">
      {{ t('editions.volunteers.no_applications') }}
    </div>
  </div>

  <div class="flex flex-wrap items-center gap-3 text-xs">
    <span>{{ filteredCountLabel }}</span>
    <span v-if="serverPagination.totalPages > 1" class="flex items-center gap-2">
      <UButton
        size="xs"
        variant="ghost"
        :disabled="serverPagination.page === 1 || applicationsLoading"
        icon="i-heroicons-chevron-left"
        @click="goToPage(serverPagination.page - 1)"
      />
      <span>{{ serverPagination.page }} / {{ serverPagination.totalPages }}</span>
      <UButton
        size="xs"
        variant="ghost"
        :disabled="serverPagination.page === serverPagination.totalPages || applicationsLoading"
        icon="i-heroicons-chevron-right"
        @click="goToPage(serverPagination.page + 1)"
      />
    </span>
  </div>
</template>

<script setup lang="ts">
import { h, resolveComponent, watch, onMounted } from 'vue'

import type { TableColumn } from '@nuxt/ui'
import type { Column } from '@tanstack/vue-table'

interface Props {
  volunteersInfo: any
  editionId: number
  canManageVolunteers: boolean
}

const emit = defineEmits<{
  refreshVolunteersInfo: []
}>()

const props = defineProps<Props>()

const { t } = useI18n()
const toast = useToast()
const { formatDateTimeWithGranularity } = useDateFormat()

// Variables d'état internes du tableau
const applications = ref<any[]>([])
const applicationsLoading = ref(false)
const exportingApplications = ref(false)
const serverPagination = ref({ page: 1, pageSize: 20, total: 0, totalPages: 1 })
const applicationsFilterStatus = ref<string>('ALL')
const applicationsFilterTeams = ref<string[]>([])
const applicationsFilterPresence = ref<string[]>([])
const globalFilter = ref('')
const sorting = ref<{ id: string; desc: boolean }[]>([{ id: 'createdAt', desc: true }])
const columnVisibility = ref<Record<string, boolean>>({
  id: false,
})
const applicationsActingId = ref<number | null>(null)
const actingAction = ref<'ACCEPTED' | 'REJECTED' | 'PENDING' | null>(null)

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
  if (!props.volunteersInfo?.askTeamPreferences || !props.volunteersInfo?.teams?.length) {
    return []
  }
  return props.volunteersInfo.teams.map((team: any) => ({
    label: team.name,
    value: team.name,
  }))
})

const volunteerPresenceItems = computed(() => [
  { label: t('editions.volunteers.presence_setup'), value: 'setup' },
  { label: t('editions.volunteers.presence_event'), value: 'event' },
  { label: t('editions.volunteers.presence_teardown'), value: 'teardown' },
])

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

const resetApplicationsFilters = () => {
  applicationsFilterStatus.value = 'ALL'
  applicationsFilterTeams.value = []
  applicationsFilterPresence.value = []
  globalFilter.value = ''
  sorting.value = [{ id: 'createdAt', desc: true }]
  serverPagination.value.page = 1
  refreshApplications()
}

const goToPage = (p: number) => {
  if (p < 1 || p > serverPagination.value.totalPages) return
  serverPagination.value.page = p
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
        sortField,
        sortDir,
        sortSecondary,
        search: globalFilter.value || undefined,
      },
    } as any)
    applications.value = res.applications || []
    if (res.pagination) serverPagination.value = res.pagination
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || t('common.error'), color: 'error' })
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
  applicationsActingId.value = app.id
  actingAction.value = status
  try {
    const res: any = await $fetch(
      `/api/editions/${props.editionId}/volunteers/applications/${app.id}`,
      {
        method: 'PATCH',
        body: { status },
      } as any
    )
    if (res?.application) {
      app.status = res.application.status
      emit('refreshVolunteersInfo')
    }
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || t('common.error'), color: 'error' })
  } finally {
    applicationsActingId.value = null
    actingAction.value = null
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
      title: e?.statusMessage || t('common.error'),
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
    hasPets: t('editions.volunteers.table_pets'),
    hasMinors: t('editions.volunteers.table_minors'),
    hasVehicle: t('editions.volunteers.table_vehicle'),
    companionName: t('editions.volunteers.table_companion'),
    avoidList: t('editions.volunteers.table_avoid_list'),
    skills: t('editions.volunteers.table_skills'),
    timePreferences: t('editions.volunteers.table_time_preferences'),
    teamPreferences: t('editions.volunteers.table_team_preferences'),
    createdAt: t('common.date'),
    motivation: t('editions.volunteers.table_motivation'),
    actions: t('common.actions'),
  }

  return labels[columnId] || columnId
}

// Définition des colonnes
const columns: TableColumn<any>[] = [
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
    cell: ({ row }) =>
      h(
        resolveComponent('UBadge'),
        {
          color: volunteerStatusColor(row.original.status),
          variant: 'soft',
          class: 'uppercase text-xs px-2 py-1',
        },
        () => volunteerStatusLabel(row.original.status)
      ),
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
    accessorKey: 'presence',
    header: t('editions.volunteers.table_presence'),
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
                const label = t(`editions.volunteers.time_slots.${slot}`)

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
          cell: ({ row }: any) =>
            row.original.allergies
              ? h('span', { class: 'text-xs truncate block max-w-[160px]' }, row.original.allergies)
              : '—',
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

            const teams = props.volunteersInfo?.teams || []
            const teamNames = preferences
              .map((teamId: string) => {
                const team = teams.find((t: any) => t.id === teamId)
                return team?.name || teamId
              })
              .join(', ')

            return h(
              resolveComponent('UTooltip'),
              { text: teamNames, openDelay: 200 },
              {
                default: () =>
                  h(
                    'div',
                    {
                      class: 'max-w-xs truncate cursor-help text-xs',
                      title: teamNames,
                    },
                    teamNames
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
    id: 'actions',
    header: t('common.actions'),
    cell: ({ row }) => {
      // N'afficher les actions que si l'utilisateur peut gérer les bénévoles
      if (!props.canManageVolunteers) {
        return h('span', { class: 'text-xs text-gray-500 italic' }, t('common.no_permission'))
      }

      const status = row.original.status
      if (status === 'PENDING') {
        return h('div', { class: 'flex gap-2' }, [
          h(
            resolveComponent('UButton'),
            {
              size: 'xs',
              color: 'success',
              variant: 'soft',
              loading:
                applicationsActingId.value === row.original.id && actingAction.value === 'ACCEPTED',
              onClick: () => decideApplication(row.original, 'ACCEPTED'),
            },
            () => t('editions.volunteers.action_accept')
          ),
          h(
            resolveComponent('UButton'),
            {
              size: 'xs',
              color: 'error',
              variant: 'soft',
              loading:
                applicationsActingId.value === row.original.id && actingAction.value === 'REJECTED',
              onClick: () => decideApplication(row.original, 'REJECTED'),
            },
            () => t('editions.volunteers.action_reject')
          ),
        ])
      }
      if (status === 'ACCEPTED' || status === 'REJECTED') {
        return h('div', { class: 'flex gap-2' }, [
          h(
            resolveComponent('UButton'),
            {
              size: 'xs',
              color: 'warning',
              variant: 'soft',
              loading:
                applicationsActingId.value === row.original.id && actingAction.value === 'PENDING',
              onClick: () => {
                if (confirm(t('editions.volunteers.confirm_back_pending'))) {
                  decideApplication(row.original, 'PENDING' as any)
                }
              },
            },
            () => t('editions.volunteers.action_back_pending')
          ),
        ])
      }
      return null
    },
  },
]

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

// Exposer les méthodes utiles
defineExpose({
  refreshApplications,
})
</script>
