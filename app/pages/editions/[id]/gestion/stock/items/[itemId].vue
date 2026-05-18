<template>
  <UContainer class="py-6">
    <!-- Breadcrumb -->
    <div class="mb-4 flex items-center gap-2 text-sm">
      <UButton
        :to="`/editions/${editionId}/gestion/stock`"
        variant="ghost"
        color="neutral"
        size="sm"
        icon="i-heroicons-arrow-left"
      >
        {{ $t('gestion.stock.title') }}
      </UButton>
      <span v-if="item" class="text-gray-400">/</span>
      <UButton
        v-if="item"
        :to="`/editions/${editionId}/gestion/stock/${item.group.id}`"
        variant="ghost"
        color="neutral"
        size="sm"
      >
        {{ item.group.name }}
      </UButton>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin size-8 text-gray-400" />
    </div>

    <div
      v-else-if="!item"
      class="text-center py-16 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl"
    >
      <UIcon name="i-heroicons-question-mark-circle" class="size-12 text-gray-400 mx-auto mb-3" />
      <p class="text-gray-600 dark:text-gray-400">{{ $t('gestion.stock.item_not_found') }}</p>
    </div>

    <div v-else class="space-y-4">
      <UCard>
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div class="flex items-start gap-3 flex-1 min-w-0">
            <UIcon name="i-heroicons-cube" class="text-amber-600 size-6 mt-1 shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h1 class="text-xl font-semibold">{{ item.name }}</h1>
                <UBadge color="neutral" variant="soft" size="sm">×{{ item.quantity }}</UBadge>
                <UBadge :color="availabilityColor" variant="soft" size="sm">
                  {{ availabilityLabel }}
                </UBadge>
              </div>
              <p v-if="item.description" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {{ item.description }}
              </p>
              <div class="text-xs text-gray-500 mt-2 flex items-center gap-3 flex-wrap">
                <span class="flex items-center gap-1">
                  <UIcon name="i-heroicons-map-pin" class="size-3" />
                  {{ item.location }}
                </span>
                <span v-if="item.zone" class="flex items-center gap-1">
                  <span
                    class="size-3 rounded-full border border-gray-300"
                    :style="{ backgroundColor: item.zone.color }"
                  />
                  {{ item.zone.name }}
                </span>
                <span v-if="item.marker" class="flex items-center gap-1">
                  <UIcon name="i-heroicons-flag" class="size-3" />
                  {{ item.marker.name }}
                </span>
              </div>
              <p v-if="item.notes" class="text-xs text-gray-500 mt-2 italic whitespace-pre-wrap">
                {{ item.notes }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <UButton
              icon="i-heroicons-plus"
              size="sm"
              color="primary"
              @click="openReservationModal(null)"
            >
              {{ $t('gestion.stock.new_reservation') }}
            </UButton>
            <UDropdownMenu v-if="canManage" :items="itemActions">
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

      <!-- Réservations -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-calendar-days" class="size-5 text-gray-500" />
            <h2 class="font-semibold">{{ $t('gestion.stock.reservations_title') }}</h2>
          </div>
        </template>

        <div v-if="!item.reservations.length" class="text-sm text-gray-500 italic text-center py-4">
          {{ $t('gestion.stock.no_reservations') }}
        </div>
        <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
          <li v-for="r in item.reservations" :key="r.id" class="py-3 flex items-start gap-3">
            <UiUserAvatar :user="r.user" size="sm" class="shrink-0 mt-0.5" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap text-sm">
                <span class="font-medium">{{ r.user.pseudo }}</span>
                <UBadge :color="statusColor(r.status)" variant="soft" size="xs">
                  {{ $t(`gestion.stock.status.${r.status}`) }}
                </UBadge>
                <UBadge color="neutral" variant="soft" size="xs">×{{ r.quantityReserved }}</UBadge>
              </div>
              <div class="text-xs text-gray-500 mt-1">
                {{ formatRange(r.startsAt, r.endsAt) }}
              </div>
              <div class="text-sm mt-1 whitespace-pre-wrap">{{ r.usage }}</div>
            </div>
            <UDropdownMenu v-if="canModifyReservation(r)" :items="reservationActions(r)">
              <UButton
                icon="i-heroicons-ellipsis-vertical"
                size="xs"
                variant="ghost"
                color="neutral"
              />
            </UDropdownMenu>
          </li>
        </ul>
      </UCard>
    </div>

    <StockItemModal
      v-if="item"
      v-model:open="itemModalOpen"
      :edition-id="editionId"
      :group-id="item.group.id"
      :item="item"
      :zones="zones"
      :markers="markers"
      :site-map-enabled="!!edition?.siteMapEnabled"
      @saved="fetchItem"
    />
    <StockReservationModal
      v-if="item"
      v-model:open="reservationModalOpen"
      :edition-id="editionId"
      :item-id="item.id"
      :item-quantity="item.quantity"
      :reservation="editingReservation"
      :can-moderate="canManage"
      :edition-start-date="edition?.startDate ?? null"
      :edition-setup-start-date="(edition as any)?.volunteersSetupStartDate ?? null"
      @saved="fetchItem"
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
const itemId = computed(() => parseInt(route.params.itemId as string))

interface ReservationUser {
  id: number
  pseudo: string
  prenom: string | null
  nom: string | null
  email: string
  emailHash: string | null
  profilePicture: string | null
}
type StockReservationStatus = 'RESERVED' | 'PICKED_UP' | 'RETURNED' | 'CANCELLED'
interface StockReservation {
  id: number
  stockItemId: number
  userId: number
  startsAt: string
  endsAt: string
  usage: string
  quantityReserved: number
  status: StockReservationStatus
  user: ReservationUser
}
interface StockItemFull {
  id: number
  name: string
  description: string | null
  location: string
  quantity: number
  notes: string | null
  group: { id: number; name: string }
  zone: { id: number; name: string; color: string } | null
  marker: { id: number; name: string } | null
  reservations: StockReservation[]
}

const item = ref<StockItemFull | null>(null)
const availability = ref<{ available: number; quantity: number } | null>(null)
const zones = ref<{ id: number; name: string; color: string }[]>([])
const markers = ref<{ id: number; name: string }[]>([])
const loading = ref(true)

const edition = computed(() => editionStore.getEditionById(editionId))

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

const availabilityColor = computed<'success' | 'warning' | 'error' | 'neutral'>(() => {
  if (!availability.value) return 'neutral'
  if (availability.value.available === 0) return 'error'
  if (availability.value.available < availability.value.quantity) return 'warning'
  return 'success'
})

const availabilityLabel = computed(() => {
  if (!availability.value) return ''
  return t('gestion.stock.available_now', {
    available: availability.value.available,
    total: availability.value.quantity,
  })
})

async function fetchItem() {
  try {
    loading.value = true
    const res = await $fetch<{ success: boolean; data: { item: StockItemFull } }>(
      `/api/editions/${editionId}/stock-items/${itemId.value}`
    )
    item.value = res?.data?.item || null
    if (item.value) {
      const avRes = await $fetch<{
        success: boolean
        data: { available: number; quantity: number }
      }>(`/api/editions/${editionId}/stock-items/${itemId.value}/availability`)
      availability.value = avRes?.data || null
    }
  } finally {
    loading.value = false
  }
}

async function fetchMapData() {
  const [zonesRes, markersRes] = await Promise.all([
    $fetch<any>(`/api/editions/${editionId}/zones`).catch(() => null),
    $fetch<any>(`/api/editions/${editionId}/markers`).catch(() => null),
  ])
  const zonesData = Array.isArray(zonesRes)
    ? zonesRes
    : (zonesRes?.data?.zones ?? zonesRes?.data ?? [])
  zones.value = (zonesData || []).map((z: any) => ({ id: z.id, name: z.name, color: z.color }))
  const markersData = Array.isArray(markersRes)
    ? markersRes
    : (markersRes?.data?.markers ?? markersRes?.data ?? [])
  markers.value = (markersData || []).map((m: any) => ({ id: m.id, name: m.name }))
}

onMounted(async () => {
  if (!edition.value) {
    await editionStore.fetchEditionById(editionId, { force: true })
  }
})

await Promise.all([fetchItem(), fetchMapData()])

const itemModalOpen = ref(false)
const reservationModalOpen = ref(false)
const editingReservation = ref<StockReservation | null>(null)

function openReservationModal(r: StockReservation | null) {
  editingReservation.value = r
  reservationModalOpen.value = true
}

const itemActions = computed(() => [
  [
    {
      label: t('common.edit'),
      icon: 'i-heroicons-pencil-square',
      onSelect: () => {
        itemModalOpen.value = true
      },
    },
    {
      label: t('common.delete'),
      icon: 'i-heroicons-trash',
      color: 'error' as const,
      onSelect: () => deleteItem(),
    },
  ],
])

async function deleteItem() {
  if (!item.value) return
  if (!confirm(t('gestion.stock.confirm_delete_item', { name: item.value.name }))) return
  const groupId = item.value.group.id
  await $fetch(`/api/editions/${editionId}/stock-items/${item.value.id}`, { method: 'DELETE' })
  router.push(`/editions/${editionId}/gestion/stock/${groupId}`)
}

function canModifyReservation(r: StockReservation): boolean {
  return r.userId === authStore.user?.id || canManage.value
}

function reservationActions(r: StockReservation) {
  return [
    [
      {
        label: t('common.edit'),
        icon: 'i-heroicons-pencil-square',
        onSelect: () => openReservationModal(r),
      },
      {
        label: t('common.delete'),
        icon: 'i-heroicons-trash',
        color: 'error' as const,
        onSelect: () => deleteReservation(r),
      },
    ],
  ]
}

async function deleteReservation(r: StockReservation) {
  if (!confirm(t('gestion.stock.confirm_delete_reservation'))) return
  await $fetch(`/api/editions/${editionId}/stock-reservations/${r.id}`, { method: 'DELETE' })
  await fetchItem()
}

function statusColor(s: StockReservationStatus): 'neutral' | 'info' | 'success' | 'error' {
  switch (s) {
    case 'RESERVED':
      return 'info'
    case 'PICKED_UP':
      return 'neutral'
    case 'RETURNED':
      return 'success'
    case 'CANCELLED':
      return 'error'
  }
}

function formatRange(start: string, end: string): string {
  try {
    const fmt = new Intl.DateTimeFormat(locale.value, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    return `${fmt.format(new Date(start))} → ${fmt.format(new Date(end))}`
  } catch {
    return `${start} → ${end}`
  }
}
</script>
