<template>
  <UContainer class="py-6">
    <!-- Breadcrumb -->
    <div class="mb-4">
      <UButton
        :to="`/editions/${editionId}/gestion/stock`"
        variant="ghost"
        color="neutral"
        size="sm"
        icon="i-heroicons-arrow-left"
      >
        {{ $t('gestion.stock.title') }}
      </UButton>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin size-8 text-gray-400" />
    </div>

    <div
      v-else-if="!group"
      class="text-center py-16 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl"
    >
      <UIcon name="i-heroicons-question-mark-circle" class="size-12 text-gray-400 mx-auto mb-3" />
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        {{ $t('gestion.stock.group_not_found') }}
      </p>
    </div>

    <div v-else class="space-y-4">
      <UCard>
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div class="flex items-start gap-3 flex-1 min-w-0">
            <UIcon name="i-heroicons-archive-box" class="text-amber-600 size-6 mt-1 shrink-0" />
            <div class="flex-1 min-w-0">
              <h1 class="text-xl font-semibold">{{ group.name }}</h1>
              <p v-if="group.description" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {{ group.description }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <UTabs
              v-model="viewMode"
              :items="viewModeItems"
              size="sm"
              color="primary"
              variant="pill"
              :ui="{ list: 'w-auto' }"
            />
            <UButton
              v-if="canManage"
              icon="i-heroicons-plus"
              size="sm"
              color="primary"
              @click="openItemModal(null)"
            >
              {{ $t('gestion.stock.new_item') }}
            </UButton>
            <UDropdownMenu v-if="canManage" :items="groupActions">
              <UButton
                icon="i-heroicons-ellipsis-vertical"
                size="sm"
                variant="ghost"
                color="neutral"
              />
            </UDropdownMenu>
          </div>
        </div>
      </UCard>

      <div
        v-if="!group.items.length"
        class="text-center py-16 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl"
      >
        <UIcon name="i-heroicons-cube" class="size-10 text-gray-400 mx-auto mb-2" />
        <p class="text-gray-600 dark:text-gray-400 mb-3 text-sm">
          {{ $t('gestion.stock.empty_group') }}
        </p>
        <UButton
          v-if="canManage"
          icon="i-heroicons-plus"
          color="primary"
          size="sm"
          @click="openItemModal(null)"
        >
          {{ $t('gestion.stock.new_item') }}
        </UButton>
      </div>

      <UCard v-else-if="viewMode === 'list'" :ui="{ body: 'p-0 sm:p-0' }">
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead
              class="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase text-gray-600 dark:text-gray-400"
            >
              <tr>
                <th class="px-4 py-2 text-left font-medium">{{ $t('gestion.stock.item_name') }}</th>
                <th class="px-4 py-2 text-right font-medium whitespace-nowrap">
                  {{ $t('common.quantity') }}
                </th>
                <th class="px-4 py-2 text-left font-medium whitespace-nowrap">
                  {{ $t('gestion.stock.locations') }}
                </th>
                <th class="px-4 py-2 text-right font-medium whitespace-nowrap">
                  {{ $t('gestion.stock.reservations_title') }}
                </th>
                <th class="px-2 py-2" />
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
              <tr
                v-for="item in group.items"
                :key="item.id"
                class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                @click="goToItem(item.id)"
              >
                <td class="px-4 py-3 align-top">
                  <div class="font-medium">{{ item.name }}</div>
                  <StockItemDescription :text="item.description" />
                </td>
                <td class="px-4 py-3 align-top text-right whitespace-nowrap">
                  <span class="font-medium tabular-nums">×{{ item.quantity }}</span>
                </td>
                <td class="px-4 py-3 align-top">
                  <div v-if="item.locations.length" class="flex flex-wrap gap-1.5">
                    <UBadge
                      v-for="loc in item.locations"
                      :key="loc.id"
                      color="neutral"
                      variant="soft"
                      size="md"
                      class="font-normal"
                    >
                      <span class="flex items-center gap-1.5">
                        <span
                          v-if="loc.zone"
                          class="size-3 rounded-full"
                          :style="{ backgroundColor: loc.zone.color }"
                        />
                        <UIcon v-else-if="loc.marker" name="i-heroicons-flag" class="size-4" />
                        <UIcon v-else name="i-heroicons-map-pin" class="size-4" />
                        {{ loc.zone?.name || loc.marker?.name || loc.location }}
                        <span class="text-gray-500">×{{ loc.quantity }}</span>
                      </span>
                    </UBadge>
                  </div>
                  <span v-else class="text-sm text-gray-400 italic">
                    {{ $t('gestion.stock.no_locations_yet') }}
                  </span>
                </td>
                <td class="px-4 py-3 align-top text-right whitespace-nowrap">
                  <div :class="item._count.reservations ? '' : 'text-gray-400'" class="tabular-nums">
                    {{ item._count.reservations }}
                  </div>
                  <div
                    v-if="item.reservations[0]"
                    class="text-xs text-gray-500 mt-0.5 flex items-center justify-end gap-1"
                  >
                    <UBadge
                      :color="reservationBadgeColor(item.reservations[0])"
                      variant="soft"
                      size="xs"
                    >
                      {{ reservationBadgeLabel(item.reservations[0]) }}
                    </UBadge>
                    <span class="whitespace-nowrap">{{
                      formatNextDate(item.reservations[0])
                    }}</span>
                  </div>
                </td>
                <td class="px-2 py-3 align-top text-right">
                  <UIcon name="i-heroicons-chevron-right" class="size-4 text-gray-400" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <StockPlanning
        v-else-if="viewMode === 'planning'"
        :items="planningItems"
        :start-date="planningStartDate"
        :end-date="planningEndDate"
        @reservation-click="openReservationFromPlanning"
      />
    </div>

    <StockReservationModal
      v-if="planningReservationContext"
      v-model:open="reservationModalOpen"
      :edition-id="editionId"
      :item-id="planningReservationContext.itemId"
      :item-quantity="planningReservationContext.itemQuantity"
      :reservation="planningReservationContext.reservation"
      :can-moderate="canManage"
      :zones="zones"
      :markers="markers"
      :site-map-enabled="!!edition?.siteMapEnabled"
      :edition-start-date="edition?.startDate ?? null"
      :edition-setup-start-date="(edition as any)?.volunteersSetupStartDate ?? null"
      @saved="refreshPlanning"
    />

    <StockGroupModal
      v-model:open="groupModalOpen"
      :edition-id="editionId"
      :group="group"
      @saved="handleGroupSaved"
      @deleted="handleGroupDeleted"
    />
    <StockItemModal
      v-if="group"
      v-model:open="itemModalOpen"
      :edition-id="editionId"
      :group-id="group.id"
      :item="editingItem"
      @saved="handleItemSaved"
    />
  </UContainer>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

definePageMeta({
  layout: 'edition-dashboard',
  middleware: ['auth-protected'],
})

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const authStore = useAuthStore()
const editionStore = useEditionStore()
const editionId = parseInt(route.params.id as string)
const groupId = computed(() => parseInt(route.params.groupId as string))

interface StockItemLocationLite {
  id: number
  location: string | null
  quantity: number
  zone: { id: number; name: string; color: string } | null
  marker: { id: number; name: string } | null
}
type StockReservationStatus = 'RESERVED' | 'PICKED_UP' | 'RETURNED' | 'CANCELLED'
interface StockItemUpcomingReservation {
  id: number
  status: StockReservationStatus
  startsAt: string
  endsAt: string
  quantityReserved: number
}
interface StockItem {
  id: number
  name: string
  description: string | null
  quantity: number
  locations: StockItemLocationLite[]
  reservations: StockItemUpcomingReservation[]
  _count: { reservations: number }
}
interface StockGroupItem {
  id: number
  name: string
  description: string | null
  displayOrder: number
  items: StockItem[]
}

interface PlanningReservationUser {
  id: number
  pseudo: string
  emailHash: string | null
  profilePicture: string | null
  updatedAt?: string
}
interface PlanningReservation {
  id: number
  status: StockReservationStatus
  startsAt: string
  endsAt: string
  quantityReserved: number
  usage: string
  location: string | null
  zone: { id: number; name: string; color: string } | null
  marker: { id: number; name: string } | null
  user: PlanningReservationUser
}
interface PlanningItemLocation {
  id: number
  location: string | null
  quantity: number
  zone: { id: number; name: string; color: string } | null
  marker: { id: number; name: string } | null
}
interface PlanningItem {
  id: number
  name: string
  quantity: number
  locations: PlanningItemLocation[]
  reservations: PlanningReservation[]
}

interface ZoneOption {
  id: number
  name: string
  color: string
  types: string[]
}
interface MarkerOption {
  id: number
  name: string
  color: string | null
  types: string[]
}

const allGroups = ref<StockGroupItem[]>([])
const zones = ref<ZoneOption[]>([])
const markers = ref<MarkerOption[]>([])
const loading = ref(true)
const viewMode = ref<'list' | 'planning'>('list')
const planningItems = ref<PlanningItem[]>([])
const planningLoading = ref(false)

const edition = computed(() => editionStore.getEditionById(editionId))
const group = computed<StockGroupItem | null>(
  () => allGroups.value.find((g) => g.id === groupId.value) || null
)

const canManage = computed(() => {
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

async function fetchAll() {
  try {
    loading.value = true
    const [groupsRes, zonesRes, markersRes] = await Promise.all([
      $fetch<{ success: boolean; data: { groups: StockGroupItem[] } }>(
        `/api/editions/${editionId}/stock-groups`
      ),
      $fetch<{ success: boolean; data: { zones: any[] } } | any[]>(
        `/api/editions/${editionId}/zones`
      ).catch(() => null),
      $fetch<{ success: boolean; data: { markers: any[] } } | any[]>(
        `/api/editions/${editionId}/markers`
      ).catch(() => null),
    ])
    allGroups.value = groupsRes?.data?.groups || []
    const zonesData = Array.isArray(zonesRes)
      ? zonesRes
      : (zonesRes?.data?.zones ?? (zonesRes as any)?.data ?? [])
    zones.value = (zonesData || []).map((z: any) => ({
      id: z.id,
      name: z.name,
      color: z.color,
      types: Array.isArray(z.zoneTypes) ? z.zoneTypes : [],
    }))
    const markersData = Array.isArray(markersRes)
      ? markersRes
      : (markersRes?.data?.markers ?? (markersRes as any)?.data ?? [])
    markers.value = (markersData || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      color: m.color ?? null,
      types: Array.isArray(m.markerTypes) ? m.markerTypes : [],
    }))
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (!edition.value) {
    await editionStore.fetchEditionById(editionId, { force: true })
  }
})

await fetchAll()

const groupModalOpen = ref(false)
const itemModalOpen = ref(false)
const editingItem = ref<StockItem | null>(null)
const reservationModalOpen = ref(false)
const planningReservationContext = ref<{
  itemId: number
  itemQuantity: number
  reservation: PlanningReservation
} | null>(null)

const viewModeItems = computed(() => [
  { label: t('gestion.stock.list_view'), value: 'list', icon: 'i-heroicons-list-bullet' },
  {
    label: t('gestion.stock.planning_view'),
    value: 'planning',
    icon: 'i-heroicons-calendar-days',
  },
])

// Périmètre temporel : montage → démontage si défini, sinon édition seule
const planningStartDate = computed<string | null>(() => {
  const e = edition.value as any
  return e?.volunteersSetupStartDate || e?.startDate || null
})
const planningEndDate = computed<string | null>(() => {
  const e = edition.value as any
  return e?.volunteersTeardownEndDate || e?.endDate || null
})

async function fetchPlanning() {
  if (!group.value) return
  try {
    planningLoading.value = true
    const res = await $fetch<{ success: boolean; data: { items: PlanningItem[] } }>(
      `/api/editions/${editionId}/stock-groups/${group.value.id}/planning`
    )
    planningItems.value = res?.data?.items || []
  } finally {
    planningLoading.value = false
  }
}

// Charger les données planning à la 1ère bascule en mode planning, puis garder à jour
watch(viewMode, (mode) => {
  if (mode === 'planning' && !planningItems.value.length) {
    fetchPlanning()
  }
})

function openReservationFromPlanning(reservation: PlanningReservation, item: PlanningItem) {
  planningReservationContext.value = {
    itemId: item.id,
    itemQuantity: item.quantity,
    reservation,
  }
  reservationModalOpen.value = true
}

async function refreshPlanning() {
  await Promise.all([fetchAll(), fetchPlanning()])
}

// Tick d'horloge réactif pour que les badges « En cours / Prochaine / En retard »
// bascule sans refetch quand la page reste ouverte.
const now = useNow({ interval: 60_000 })

type ReservationState = 'overdue' | 'ongoing' | 'upcoming'

function reservationState(r: StockItemUpcomingReservation): ReservationState {
  const t = now.value.getTime()
  if (r.status === 'PICKED_UP' && new Date(r.endsAt).getTime() < t) return 'overdue'
  if (new Date(r.startsAt).getTime() <= t && new Date(r.endsAt).getTime() > t) return 'ongoing'
  return 'upcoming'
}

function reservationBadgeColor(r: StockItemUpcomingReservation): 'success' | 'info' | 'error' {
  switch (reservationState(r)) {
    case 'overdue':
      return 'error'
    case 'ongoing':
      return 'success'
    case 'upcoming':
      return 'info'
  }
}

function reservationBadgeLabel(r: StockItemUpcomingReservation): string {
  switch (reservationState(r)) {
    case 'overdue':
      return t('gestion.stock.overdue')
    case 'ongoing':
      return t('gestion.stock.ongoing')
    case 'upcoming':
      return t('gestion.stock.upcoming')
  }
}

function formatNextDate(r: StockItemUpcomingReservation): string {
  const state = reservationState(r)
  const date = state === 'upcoming' ? r.startsAt : r.endsAt
  return new Intl.DateTimeFormat(locale.value, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

function openItemModal(item: StockItem | null) {
  editingItem.value = item
  itemModalOpen.value = true
}

function goToItem(itemId: number) {
  router.push(`/editions/${editionId}/gestion/stock/items/${itemId}`)
}

const groupActions = computed(() => [
  [
    {
      label: t('common.edit'),
      icon: 'i-heroicons-pencil-square',
      onSelect: () => {
        groupModalOpen.value = true
      },
    },
    {
      label: t('common.delete'),
      icon: 'i-heroicons-trash',
      color: 'error' as const,
      onSelect: () => deleteGroup(),
    },
  ],
])

async function deleteGroup() {
  if (!group.value) return
  if (
    !confirm(
      t('gestion.stock.confirm_delete_group', {
        name: group.value.name,
        count: group.value.items.length,
      })
    )
  )
    return
  await $fetch(`/api/editions/${editionId}/stock-groups/${group.value.id}`, { method: 'DELETE' })
  router.push(`/editions/${editionId}/gestion/stock`)
}

async function handleGroupSaved() {
  await fetchAll()
}
async function handleGroupDeleted() {
  router.push(`/editions/${editionId}/gestion/stock`)
}
async function handleItemSaved() {
  await fetchAll()
}
</script>
