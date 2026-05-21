<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }">
    <div class="bg-white dark:bg-gray-800 rounded-lg">
      <UiLazyFullCalendar v-if="ready" :options="calendarOptions" class="stock-planning-calendar" />
      <div v-else class="flex items-center justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin text-gray-400" size="20" />
        <span class="ml-2 text-sm text-gray-500">{{ $t('common.loading') }}</span>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { CalendarOptions, EventClickArg, EventInput } from '@fullcalendar/core'
import type { ResourceInput } from '@fullcalendar/resource'

type StockReservationStatus = 'RESERVED' | 'PICKED_UP' | 'RETURNED' | 'CANCELLED'

interface ReservationUser {
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
  user: ReservationUser
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

const props = defineProps<{
  items: PlanningItem[]
  /** Date de début du périmètre (setupStartDate ou startDate) */
  startDate: string | null
  /** Date de fin du périmètre (teardownEndDate ou endDate). Sera +1 jour côté FC. */
  endDate: string | null
}>()

const emit = defineEmits<{
  'reservation-click': [reservation: PlanningReservation, item: PlanningItem]
}>()

const { t, locale } = useI18n()

const plugins = shallowRef<any[]>([])
const allLocales = shallowRef<any[]>([])
const ready = ref(false)

onMounted(async () => {
  try {
    const [resourceTimeline, timeline, interaction, locales] = await Promise.all([
      import('@fullcalendar/resource-timeline'),
      import('@fullcalendar/timeline'),
      import('@fullcalendar/interaction'),
      import('@fullcalendar/core/locales-all'),
    ])
    plugins.value = [resourceTimeline.default, timeline.default, interaction.default]
    allLocales.value = locales.default
    ready.value = true
  } catch (error) {
    console.error('Error loading FullCalendar plugins:', error)
  }
})

const resources = computed<ResourceInput[]>(() =>
  props.items.map((item) => ({
    id: String(item.id),
    title: `${item.name} (×${item.quantity})`,
  }))
)

function statusColor(status: StockReservationStatus): string {
  switch (status) {
    case 'PICKED_UP':
      return '#6b7280' // gris
    case 'RESERVED':
      return '#3b82f6' // bleu
    case 'RETURNED':
      return '#22c55e' // vert
    case 'CANCELLED':
      return '#ef4444' // rouge
  }
}

function itemLocationsSummary(item: PlanningItem): string {
  return item.zone?.name || item.marker?.name || item.location || ''
}

function reservationLocationLabel(r: PlanningReservation): string {
  const parts: string[] = []
  if (r.location) parts.push(r.location)
  if (r.zone?.name) parts.push(r.zone.name)
  if (r.marker?.name) parts.push(r.marker.name)
  return parts.join(' · ')
}

const events = computed<EventInput[]>(() => {
  const list: EventInput[] = []
  for (const item of props.items) {
    const stockageLabel = itemLocationsSummary(item)
    for (const r of item.reservations) {
      // Emplacement d'utilisation (= où le matos doit être amené)
      const useLabel = reservationLocationLabel(r)
      list.push({
        id: `r${r.id}`,
        title: r.usage,
        start: r.startsAt,
        end: r.endsAt,
        resourceId: String(item.id),
        color: statusColor(r.status),
        extendedProps: {
          reservationId: r.id,
          itemId: item.id,
          status: r.status,
          quantityReserved: r.quantityReserved,
          userPseudo: r.user.pseudo,
          useLabel,
          stockageLabel,
          usage: r.usage,
        },
      })
    }
  }
  return list
})

// Ajouter un jour à endDate (validRange.end est exclusif côté FullCalendar)
const exclusiveEndDate = computed(() => {
  if (!props.endDate) return undefined
  const d = new Date(props.endDate)
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
})

const calendarOptions = reactive<CalendarOptions>({
  plugins: [],
  locales: [],
  locale: locale.value,
  schedulerLicenseKey: 'CC-Attribution-NonCommercial-NoDerivatives',
  initialView: 'resourceTimelineWeek',
  initialDate: props.startDate ?? undefined,
  validRange: {
    start: props.startDate ?? undefined,
    end: exclusiveEndDate.value,
  },
  slotMinTime: '00:00:00',
  slotMaxTime: '24:00:00',
  slotDuration: '00:15:00',
  slotLabelInterval: '01:00:00',
  resources: [] as ResourceInput[],
  events: [] as EventInput[],
  editable: false,
  selectable: false,
  resourceAreaWidth: '25%',
  resourceAreaHeaderContent: t('gestion.stock.item_name'),
  height: 'auto',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'resourceTimelineDay,resourceTimelineWeek',
  },
  buttonText: {
    today: t('calendar.today'),
    resourceTimelineDay: t('common.day'),
    resourceTimelineWeek: t('common.week'),
  },
  titleFormat: {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  },
  views: {
    resourceTimelineDay: {
      slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
    },
  },
  eventContent: (arg) => {
    const ext = arg.event.extendedProps as {
      quantityReserved: number
      userPseudo: string
      useLabel: string
      stockageLabel: string
      usage: string
    }
    const container = document.createElement('div')
    container.className = 'stock-event-content'

    const title = document.createElement('div')
    title.className = 'stock-event-title'
    title.textContent = `×${ext.quantityReserved} · ${ext.userPseudo}`
    container.appendChild(title)

    if (ext.usage) {
      const usage = document.createElement('div')
      usage.className = 'stock-event-usage'
      usage.textContent = ext.usage
      container.appendChild(usage)
    }

    // Lieu d'utilisation (où amener le matos) — info principale pour la résa
    if (ext.useLabel) {
      const loc = document.createElement('div')
      loc.className = 'stock-event-loc'
      loc.textContent = `📍 ${ext.useLabel}`
      container.appendChild(loc)
    }

    // Lieu de stockage de l'item (où aller le chercher) — info secondaire
    if (ext.stockageLabel) {
      const stock = document.createElement('div')
      stock.className = 'stock-event-stockage'
      stock.textContent = `📦 ${ext.stockageLabel}`
      container.appendChild(stock)
    }

    return { domNodes: [container] }
  },
  eventClick: (arg: EventClickArg) => {
    const reservationId = arg.event.extendedProps.reservationId as number
    const itemId = arg.event.extendedProps.itemId as number
    const item = props.items.find((i) => i.id === itemId)
    const reservation = item?.reservations.find((r) => r.id === reservationId)
    if (item && reservation) emit('reservation-click', reservation, item)
  },
})

// Date de la première réservation, pour positionner la vue par défaut dessus
const firstReservationDate = computed<string | null>(() => {
  let earliest: number | null = null
  for (const item of props.items) {
    for (const r of item.reservations) {
      const t = new Date(r.startsAt).getTime()
      if (!isNaN(t) && (earliest === null || t < earliest)) earliest = t
    }
  }
  return earliest !== null ? new Date(earliest).toISOString() : null
})

// Sync les plugins, locales et données dans les options réactives
watch([plugins, allLocales], ([newPlugins, newLocales]) => {
  calendarOptions.plugins = newPlugins
  calendarOptions.locales = newLocales
})
watch(
  resources,
  (val) => {
    calendarOptions.resources = val
  },
  { deep: true, immediate: true }
)
watch(
  events,
  (val) => {
    calendarOptions.events = val
  },
  { deep: true, immediate: true }
)
watch(
  () => [props.startDate, exclusiveEndDate.value, firstReservationDate.value] as const,
  ([start, end, firstResa]) => {
    // Positionner la vue initiale sur la 1ère réservation si elle existe, sinon
    // sur la date de début de la période. Évite d'arriver sur une vue vide.
    calendarOptions.initialDate = firstResa || start || undefined
    calendarOptions.validRange = { start: start ?? undefined, end }
  },
  { immediate: true }
)
watch(
  () => locale.value,
  (val) => {
    calendarOptions.locale = val
  }
)
</script>

<style scoped>
.stock-planning-calendar :deep(.fc) {
  font-size: 0.875rem;
}
.stock-planning-calendar :deep(.fc-event) {
  cursor: pointer;
}
.stock-planning-calendar :deep(.stock-event-content) {
  padding: 2px 4px;
  font-size: 0.75rem;
  line-height: 1.1;
  overflow: hidden;
}
.stock-planning-calendar :deep(.stock-event-title) {
  font-weight: 600;
}
.stock-planning-calendar :deep(.stock-event-usage) {
  opacity: 0.95;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stock-planning-calendar :deep(.stock-event-loc),
.stock-planning-calendar :deep(.stock-event-stockage) {
  font-size: 0.65rem;
  opacity: 0.85;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
