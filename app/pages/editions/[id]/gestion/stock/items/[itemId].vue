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
              <p v-if="item.notes" class="text-xs text-gray-500 mt-2 italic whitespace-pre-wrap">
                {{ item.notes }}
              </p>
              <!-- Emplacement de rangement par défaut -->
              <div
                v-if="item.location || item.zone || item.marker"
                class="mt-2 text-xs text-gray-600 dark:text-gray-400 flex items-center flex-wrap gap-x-2 gap-y-1"
              >
                <UIcon name="i-heroicons-map-pin" class="size-3.5 text-gray-400" />
                <span class="font-medium">{{ $t('gestion.stock.item_storage_location') }} :</span>
                <span v-if="item.location">{{ item.location }}</span>
                <span v-if="item.zone" class="flex items-center gap-1">
                  <span
                    class="size-2.5 rounded-full border border-gray-300"
                    :style="{ backgroundColor: item.zone.color }"
                  />
                  {{ item.zone.name }}
                </span>
                <span v-if="item.marker" class="flex items-center gap-1">
                  <UIcon name="i-heroicons-flag" class="size-3.5" />
                  {{ item.marker.name }}
                </span>
              </div>
              <div v-if="item.isExternalLoan" class="mt-2 flex items-center gap-2 flex-wrap">
                <UBadge :color="loanBadgeColor" variant="soft" size="xs">
                  <UIcon name="i-heroicons-hand-raised" class="size-3 mr-1" />
                  {{ loanBadgeLabel }}
                </UBadge>
              </div>
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

      <!-- Emprunt externe -->
      <UCard v-if="item.isExternalLoan">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-hand-raised" class="size-5 text-gray-500" />
            <h2 class="font-semibold">{{ $t('gestion.stock.external_loan') }}</h2>
          </div>
        </template>
        <dl class="space-y-2 text-sm">
          <div v-if="item.ownerContact" class="flex flex-col sm:flex-row sm:gap-3">
            <dt class="text-gray-500 sm:w-40 shrink-0">{{ $t('gestion.stock.owner_contact') }}</dt>
            <dd class="whitespace-pre-wrap wrap-break-word">{{ item.ownerContact }}</dd>
          </div>
          <div v-if="item.returnDueAt" class="flex flex-col sm:flex-row sm:gap-3">
            <dt class="text-gray-500 sm:w-40 shrink-0">{{ $t('gestion.stock.return_due_at') }}</dt>
            <dd :class="loanIsOverdue ? 'text-error-600 font-medium' : ''">
              {{ formatDate(item.returnDueAt) }}
              <span v-if="loanIsOverdue" class="text-xs ml-1">
                ({{ $t('gestion.stock.overdue') }})
              </span>
            </dd>
          </div>
          <div v-if="item.returnedAt" class="flex flex-col sm:flex-row sm:gap-3">
            <dt class="text-gray-500 sm:w-40 shrink-0">{{ $t('gestion.stock.returned_at') }}</dt>
            <dd class="text-success-600 dark:text-success-400">
              {{ formatDate(item.returnedAt) }}
            </dd>
          </div>
        </dl>
        <template v-if="canManage" #footer>
          <UButton
            v-if="!item.returnedAt"
            icon="i-heroicons-check-circle"
            color="success"
            size="sm"
            :loading="loanActionLoading"
            @click="markLoanReturned"
          >
            {{ $t('gestion.stock.mark_loan_returned') }}
          </UButton>
          <UButton
            v-else
            icon="i-heroicons-arrow-uturn-left"
            color="neutral"
            variant="soft"
            size="sm"
            :loading="loanActionLoading"
            @click="markLoanNotReturned"
          >
            {{ $t('gestion.stock.mark_loan_not_returned') }}
          </UButton>
        </template>
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
          <li
            v-for="r in item.reservations"
            :key="r.id"
            class="py-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3"
          >
            <div class="flex items-start gap-3 flex-1 min-w-0">
              <UiUserAvatar :user="r.user" size="sm" class="shrink-0 mt-0.5" />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap text-sm">
                  <span class="font-medium">{{ r.user.pseudo }}</span>
                  <UBadge :color="statusColor(r.status)" variant="soft" size="xs">
                    {{ $t(`gestion.stock.status.${r.status}`) }}
                  </UBadge>
                  <UBadge color="neutral" variant="soft" size="xs">
                    ×{{ r.quantityReserved }}
                  </UBadge>
                </div>
                <div class="text-xs text-gray-500 mt-1">
                  {{ formatRange(r.startsAt, r.endsAt) }}
                </div>
                <div
                  v-if="r.location || r.zone || r.marker"
                  class="text-xs text-gray-600 dark:text-gray-400 mt-1 flex items-center flex-wrap gap-x-2 gap-y-1"
                >
                  <UIcon name="i-heroicons-map-pin" class="size-3.5" />
                  <span v-if="r.location">{{ r.location }}</span>
                  <span v-if="r.zone" class="flex items-center gap-1">
                    <span
                      class="size-2.5 rounded-full border border-gray-300"
                      :style="{ backgroundColor: r.zone.color }"
                    />
                    {{ r.zone.name }}
                  </span>
                  <span v-if="r.marker" class="flex items-center gap-1">
                    <UIcon name="i-heroicons-flag" class="size-3.5" />
                    {{ r.marker.name }}
                  </span>
                </div>
                <div class="text-sm mt-1 whitespace-pre-wrap wrap-break-word">{{ r.usage }}</div>
              </div>
            </div>
            <div class="flex items-center gap-1 sm:shrink-0 self-end sm:self-start">
              <StockReservationStatusButton
                :edition-id="editionId"
                :reservation-id="r.id"
                :status="r.status"
                :can-edit="canModifyReservation(r)"
                @updated="fetchItem"
              />
              <UDropdownMenu v-if="canModifyReservation(r)" :items="reservationActions(r)">
                <UButton
                  icon="i-heroicons-ellipsis-vertical"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                />
              </UDropdownMenu>
            </div>
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
      :zones="zones"
      :markers="markers"
      :site-map-enabled="!!edition?.siteMapEnabled"
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
  location: string | null
  zone: { id: number; name: string; color: string } | null
  marker: { id: number; name: string } | null
  user: ReservationUser
}
interface StockItemFull {
  id: number
  name: string
  description: string | null
  quantity: number
  notes: string | null
  isExternalLoan: boolean
  ownerContact: string | null
  returnDueAt: string | null
  returnedAt: string | null
  group: { id: number; name: string }
  location: string | null
  zone: { id: number; name: string; color: string } | null
  marker: { id: number; name: string } | null
  reservations: StockReservation[]
}

const item = ref<StockItemFull | null>(null)

// Titre de l'onglet : « {nom de l'article} – Stock matériel », cohérent avec la section /stock.
// Tant que l'article n'est pas chargé, on retombe sur le titre générique de la section.
useSeoMeta({
  title: () =>
    item.value?.name
      ? `${item.value.name} – ${t('gestion.stock.title')}`
      : t('gestion.stock.title'),
})

const availability = ref<{ available: number; quantity: number } | null>(null)
const zones = ref<{ id: number; name: string; color: string; types: string[] }[]>([])
const markers = ref<{ id: number; name: string; color: string | null; types: string[] }[]>([])
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

// --- Emprunt externe ---
const loanIsOverdue = computed(() => {
  const it = item.value
  if (!it?.isExternalLoan || it.returnedAt || !it.returnDueAt) return false
  return new Date(it.returnDueAt).getTime() < Date.now()
})
const loanBadgeColor = computed<'success' | 'error' | 'warning' | 'info'>(() => {
  const it = item.value
  if (!it?.isExternalLoan) return 'info'
  if (it.returnedAt) return 'success'
  if (loanIsOverdue.value) return 'error'
  return 'warning'
})
const loanBadgeLabel = computed(() => {
  const it = item.value
  if (!it?.isExternalLoan) return ''
  if (it.returnedAt) return t('gestion.stock.loan_returned')
  if (loanIsOverdue.value) return t('gestion.stock.loan_overdue')
  return t('gestion.stock.loan_to_return')
})
const loanActionLoading = ref(false)

async function markLoanReturned() {
  if (!item.value) return
  loanActionLoading.value = true
  try {
    await $fetch(`/api/editions/${editionId}/stock-items/${item.value.id}`, {
      method: 'PUT',
      body: { returnedAt: new Date().toISOString() },
    })
    useToast().add({ title: t('common.saved'), icon: 'i-heroicons-check-circle', color: 'success' })
    await fetchItem()
  } catch (e: any) {
    useToast().add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    loanActionLoading.value = false
  }
}

async function markLoanNotReturned() {
  if (!item.value) return
  loanActionLoading.value = true
  try {
    await $fetch(`/api/editions/${editionId}/stock-items/${item.value.id}`, {
      method: 'PUT',
      body: { returnedAt: null },
    })
    useToast().add({ title: t('common.saved'), icon: 'i-heroicons-check-circle', color: 'success' })
    await fetchItem()
  } catch (e: any) {
    useToast().add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    loanActionLoading.value = false
  }
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(locale.value, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

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
  zones.value = (zonesData || []).map((z: any) => ({
    id: z.id,
    name: z.name,
    color: z.color,
    types: Array.isArray(z.zoneTypes) ? z.zoneTypes : [],
  }))
  const markersData = Array.isArray(markersRes)
    ? markersRes
    : (markersRes?.data?.markers ?? markersRes?.data ?? [])
  markers.value = (markersData || []).map((m: any) => ({
    id: m.id,
    name: m.name,
    color: m.color ?? null,
    types: Array.isArray(m.markerTypes) ? m.markerTypes : [],
  }))
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
  const actions: Array<
    Array<{
      label: string
      icon: string
      color?: 'error'
      onSelect: () => void
    }>
  > = [
    [
      {
        label: t('common.edit'),
        icon: 'i-heroicons-pencil-square',
        onSelect: () => openReservationModal(r),
      },
    ],
  ]
  // Annuler (uniquement si la résa est encore active)
  if (r.status === 'RESERVED' || r.status === 'PICKED_UP') {
    actions[0].push({
      label: t('gestion.stock.cancel_reservation'),
      icon: 'i-heroicons-x-circle',
      onSelect: () => cancelReservation(r),
    })
  }
  actions.push([
    {
      label: t('common.delete'),
      icon: 'i-heroicons-trash',
      color: 'error',
      onSelect: () => deleteReservation(r),
    },
  ])
  return actions
}

async function deleteReservation(r: StockReservation) {
  if (!confirm(t('gestion.stock.confirm_delete_reservation'))) return
  await $fetch(`/api/editions/${editionId}/stock-reservations/${r.id}`, { method: 'DELETE' })
  await fetchItem()
}

async function cancelReservation(r: StockReservation) {
  if (!confirm(t('gestion.stock.confirm_cancel_reservation'))) return
  try {
    await $fetch(`/api/editions/${editionId}/stock-reservations/${r.id}`, {
      method: 'PUT',
      body: { status: 'CANCELLED' },
    })
    useToast().add({
      title: t('common.saved'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
    await fetchItem()
  } catch (e: any) {
    useToast().add({
      title: e?.data?.message || t('common.error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  }
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
    const s = new Date(start)
    const e = new Date(end)
    const dateFmt = new Intl.DateTimeFormat(locale.value, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    const timeFmt = new Intl.DateTimeFormat(locale.value, {
      hour: '2-digit',
      minute: '2-digit',
    })
    // Si même jour, format compact « 10 juin 2026, 10:00 → 18:00 »
    const sameDay =
      s.getFullYear() === e.getFullYear() &&
      s.getMonth() === e.getMonth() &&
      s.getDate() === e.getDate()
    if (sameDay) {
      return `${dateFmt.format(s)}, ${timeFmt.format(s)} → ${timeFmt.format(e)}`
    }
    return `${dateFmt.format(s)} ${timeFmt.format(s)} → ${dateFmt.format(e)} ${timeFmt.format(e)}`
  } catch {
    return `${start} → ${end}`
  }
}
</script>
