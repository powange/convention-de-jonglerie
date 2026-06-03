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
                <th class="px-2 py-2 w-10 text-center">
                  <UCheckbox
                    :model-value="allSelectedState"
                    :indeterminate="someSelected && !allSelected"
                    :aria-label="$t('common.select_all')"
                    @update:model-value="toggleSelectAll"
                  />
                </th>
                <th class="px-4 py-2 text-left font-medium">{{ $t('gestion.stock.item_name') }}</th>
                <th class="px-4 py-2 text-right font-medium whitespace-nowrap">
                  {{ $t('common.quantity') }}
                </th>
                <th class="px-4 py-2 text-left font-medium whitespace-nowrap">
                  {{ $t('gestion.stock.item_storage_location') }}
                </th>
                <th class="px-4 py-2 text-left font-medium whitespace-nowrap">
                  {{ $t('gestion.stock.item_current_location') }}
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
                :class="[
                  'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
                  selectedItemIds.has(item.id) ? 'bg-primary-50/40 dark:bg-primary-950/30' : '',
                ]"
                @click="goToItem(item.id)"
              >
                <td class="px-2 py-3 align-top text-center" @click.stop>
                  <UCheckbox
                    :model-value="selectedItemIds.has(item.id)"
                    :aria-label="$t('common.select')"
                    @update:model-value="toggleItem(item.id, $event)"
                  />
                </td>
                <td class="px-4 py-3 align-top">
                  <div class="font-medium">{{ item.name }}</div>
                  <StockItemDescription :text="item.description" />
                </td>
                <td class="px-4 py-3 align-top text-right whitespace-nowrap">
                  <span class="font-medium tabular-nums">×{{ item.quantity }}</span>
                </td>
                <td class="px-4 py-3 align-top">
                  <div
                    v-if="item.location || item.zone || item.marker"
                    class="flex items-center flex-wrap gap-1.5 text-sm"
                  >
                    <span
                      v-if="item.zone"
                      class="size-3 rounded-full border border-gray-300"
                      :style="{ backgroundColor: item.zone.color }"
                    />
                    <UIcon v-else-if="item.marker" name="i-heroicons-flag" class="size-4" />
                    <UIcon v-else name="i-heroicons-map-pin" class="size-4 text-gray-400" />
                    <span>{{ item.zone?.name || item.marker?.name || item.location }}</span>
                  </div>
                  <span v-else class="text-sm text-gray-400 italic">
                    {{ $t('gestion.stock.no_location') }}
                  </span>
                </td>
                <td class="px-4 py-3 align-top">
                  <ul v-if="currentLocations(item).length" class="space-y-1 text-sm">
                    <li
                      v-for="r in currentLocations(item)"
                      :key="r.id"
                      class="flex items-center flex-wrap gap-1.5"
                    >
                      <UBadge
                        color="neutral"
                        variant="soft"
                        size="xs"
                        class="tabular-nums shrink-0"
                      >
                        ×{{ r.quantityReserved }}
                      </UBadge>
                      <span
                        v-if="r.zone"
                        class="size-3 rounded-full border border-gray-300"
                        :style="{ backgroundColor: r.zone.color }"
                      />
                      <UIcon v-else-if="r.marker" name="i-heroicons-flag" class="size-4" />
                      <UIcon v-else name="i-heroicons-map-pin" class="size-4 text-gray-400" />
                      <span>{{ r.zone?.name || r.marker?.name || r.location }}</span>
                    </li>
                  </ul>
                  <span v-else class="text-sm text-gray-400 italic">—</span>
                </td>
                <td class="px-4 py-3 align-top text-right whitespace-nowrap">
                  <div
                    :class="item._count.reservations ? '' : 'text-gray-400'"
                    class="tabular-nums"
                  >
                    {{ item._count.reservations }}
                  </div>
                  <div
                    v-if="nextReservation(item)"
                    class="text-xs text-gray-500 mt-0.5 flex items-center justify-end gap-1"
                  >
                    <UBadge
                      :color="reservationBadgeColor(nextReservation(item)!)"
                      variant="soft"
                      size="xs"
                    >
                      {{ reservationBadgeLabel(nextReservation(item)!) }}
                    </UBadge>
                    <span class="whitespace-nowrap">{{
                      formatNextDate(nextReservation(item)!)
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
      :zones="zones"
      :markers="markers"
      :site-map-enabled="!!edition?.siteMapEnabled"
      @saved="handleItemSaved"
    />

    <StockBulkReservationModal
      v-if="group && bulkModalItems.length"
      v-model:open="bulkModalOpen"
      :edition-id="editionId"
      :items="bulkModalItems"
      :zones="zones"
      :markers="markers"
      :site-map-enabled="!!edition?.siteMapEnabled"
      :edition-start-date="edition?.startDate ?? null"
      :edition-setup-start-date="(edition as any)?.volunteersSetupStartDate ?? null"
      @saved="handleBulkSaved"
    />

    <!-- Barre flottante quand au moins 1 item est sélectionné -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-full opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="translate-y-full opacity-0"
      >
        <div
          v-if="someSelected"
          class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg rounded-full px-4 py-2 flex items-center gap-3"
        >
          <span class="text-sm text-gray-700 dark:text-gray-300">
            {{ $t('gestion.stock.selected_count', { count: selectedItemIds.size }) }}
          </span>
          <UButton
            color="primary"
            size="sm"
            icon="i-heroicons-plus"
            @click="openBulkReservationModal"
          >
            {{ $t('gestion.stock.bulk_reserve', { count: selectedItemIds.size }) }}
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-heroicons-x-mark"
            :aria-label="$t('gestion.stock.clear_selection')"
            @click="clearSelection"
          />
        </div>
      </Transition>
    </Teleport>
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

type StockReservationStatus = 'RESERVED' | 'PICKED_UP' | 'RETURNED' | 'CANCELLED'
interface StockItemUpcomingReservation {
  id: number
  status: StockReservationStatus
  startsAt: string
  endsAt: string
  quantityReserved: number
  location: string | null
  zone: { id: number; name: string; color: string } | null
  marker: { id: number; name: string } | null
}
interface StockItem {
  id: number
  name: string
  description: string | null
  quantity: number
  location: string | null
  zone: { id: number; name: string; color: string } | null
  marker: { id: number; name: string } | null
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
  prenom?: string | null
  nom?: string | null
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
interface PlanningItem {
  id: number
  name: string
  quantity: number
  location: string | null
  zone: { id: number; name: string; color: string } | null
  marker: { id: number; name: string } | null
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

// Titre de l'onglet : « {nom du groupe} – Stock matériel », cohérent avec la page liste /stock.
// Tant que le groupe n'est pas chargé, on retombe sur le titre générique de la section.
useSeoMeta({
  title: () =>
    group.value?.name
      ? `${group.value.name} – ${t('gestion.stock.title')}`
      : t('gestion.stock.title'),
})

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

// --- Sélection multi-items pour la réservation groupée ---
const selectedItemIds = ref<Set<number>>(new Set())
const bulkModalOpen = ref(false)
const bulkModalItems = ref<{ id: number; name: string; maxQuantity: number }[]>([])

const someSelected = computed(() => selectedItemIds.value.size > 0)
const allSelected = computed(() => {
  const items = group.value?.items || []
  return items.length > 0 && items.every((it) => selectedItemIds.value.has(it.id))
})
const allSelectedState = computed(() => allSelected.value)

function toggleItem(id: number, checked: boolean) {
  const next = new Set(selectedItemIds.value)
  if (checked) next.add(id)
  else next.delete(id)
  selectedItemIds.value = next
}

function toggleSelectAll(checked: boolean) {
  const items = group.value?.items || []
  selectedItemIds.value = checked ? new Set(items.map((it) => it.id)) : new Set()
}

function clearSelection() {
  selectedItemIds.value = new Set()
}

function openBulkReservationModal() {
  const items = group.value?.items || []
  bulkModalItems.value = items
    .filter((it) => selectedItemIds.value.has(it.id))
    .map((it) => ({ id: it.id, name: it.name, maxQuantity: it.quantity }))
  if (bulkModalItems.value.length === 0) return
  bulkModalOpen.value = true
}

async function handleBulkSaved() {
  clearSelection()
  await refreshPlanning()
}

// Quand le groupe change (navigation entre groupes), on vide la sélection
// pour ne pas garder des IDs d'un autre contexte.
watch(groupId, () => {
  clearSelection()
})

// Quand les items du groupe changent (refetch, suppression, etc.), on retire
// de la sélection les IDs qui n'existent plus pour éviter une barre flottante
// avec un compteur faussé.
watch(
  () => group.value?.items.map((it) => it.id) || [],
  (ids) => {
    if (!selectedItemIds.value.size) return
    const present = new Set(ids)
    const next = new Set<number>()
    for (const id of selectedItemIds.value) {
      if (present.has(id)) next.add(id)
    }
    if (next.size !== selectedItemIds.value.size) {
      selectedItemIds.value = next
    }
  }
)
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

// Recharger les données planning à chaque bascule en mode planning, pour
// refléter d'éventuelles créations/modifications faites depuis la vue liste.
watch(viewMode, (mode) => {
  if (mode === 'planning') {
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

// Pré-calculs mémoïsés par item pour éviter un re-filtrage à chaque tick
// d'horloge ou re-rendu (la colonne est appelée plusieurs fois par ligne).
const itemsComputeMap = computed<
  Record<
    number,
    { next: StockItemUpcomingReservation | null; current: StockItemUpcomingReservation[] }
  >
>(() => {
  const map: Record<
    number,
    { next: StockItemUpcomingReservation | null; current: StockItemUpcomingReservation[] }
  > = {}
  for (const it of group.value?.items || []) {
    const pickedUp = it.reservations
      .filter((r) => r.status === 'PICKED_UP')
      .slice()
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
    map[it.id] = { next: it.reservations[0] ?? null, current: pickedUp }
  }
  return map
})

function nextReservation(item: StockItem): StockItemUpcomingReservation | null {
  return itemsComputeMap.value[item.id]?.next ?? null
}

function currentLocations(item: StockItem): StockItemUpcomingReservation[] {
  return itemsComputeMap.value[item.id]?.current ?? []
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
  await refreshPlanning()
}
async function handleGroupDeleted() {
  router.push(`/editions/${editionId}/gestion/stock`)
}
async function handleItemSaved() {
  await refreshPlanning()
}
</script>
