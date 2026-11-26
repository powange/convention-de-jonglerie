<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }">
    <div class="bg-white dark:bg-gray-800 rounded-lg">
      <!-- `--entete-ressources` : le titre de la colonne des objets, que EventCalendar ne sait pas
           poser (FullCalendar avait `resourceAreaHeaderContent`). Affiché par le CSS. -->
      <UiLazyEventCalendar
        v-if="ready"
        :options="calendarOptions"
        class="stock-planning-calendar"
        :style="{ '--entete-ressources': JSON.stringify($t('gestion.stock.item_name')) }"
      />
      <div v-else class="flex items-center justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin text-gray-400" size="20" />
        <span class="ml-2 text-sm text-gray-500">{{ $t('common.loading') }}</span>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
/**
 * Planning des réservations d'un groupe de stock : une ligne par objet, ses sorties sur la frise.
 *
 * EventCalendar (licence MIT) et non plus FullCalendar, dont la vue « ligne de temps par
 * ressource » relevait des modules premium. Les heures arrivent au calendrier en heures du LIEU
 * (cf. `calendrier-flottant`) : EventCalendar n'accepte pas de fuseau nommé.
 */
import { useAvatar } from '#imports'

import { versChampLocal } from '#core/shared/utils/fuseau-edition'
import { decalageDuFuseau, type OptionsCalendrier } from '#ui-commun/app/utils/calendrier-flottant'

type StockReservationStatus = 'RESERVED' | 'PICKED_UP' | 'RETURNED' | 'CANCELLED'

interface ReservationUser {
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
  /** Date de fin du périmètre (teardownEndDate ou endDate). Sera +1 jour côté calendrier. */
  endDate: string | null
  /** Fuseau de l'édition. Les réservations se lisent en heure de LIEU. */
  fuseau?: string | null
}>()

const emit = defineEmits<{
  'reservation-click': [reservation: PlanningReservation, item: PlanningItem]
}>()

const { t, locale } = useI18n()
const { getUserAvatar, generateInitialsAvatar } = useAvatar()

// Plus de greffons à charger : EventCalendar arrive d'un bloc, chargé par le composant.
const ready = ref(false)
onMounted(() => {
  ready.value = true
})

const resources = computed(() =>
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

function reservationLocationLabel(r: PlanningReservation): string {
  const parts: string[] = []
  if (r.location) parts.push(r.location)
  if (r.zone?.name) parts.push(r.zone.name)
  if (r.marker?.name) parts.push(r.marker.name)
  return parts.join(' · ')
}

/** Une date-heure du lieu, telle que le calendrier l'affiche (cf. `calendrier-flottant`). */
const versCalendrier = (instant: string) => versChampLocal(instant, props.fuseau)

const events = computed(() => {
  const list: Record<string, unknown>[] = []
  for (const item of props.items) {
    for (const r of item.reservations) {
      // Emplacement d'utilisation de la réservation (= où le matos doit être
      // amené pendant la sortie). L'emplacement de rangement de l'item n'est
      // pas affiché ici, il l'est déjà dans la vue liste.
      const useLabel = reservationLocationLabel(r)
      list.push({
        id: `r${r.id}`,
        title: r.usage,
        start: versCalendrier(r.startsAt),
        end: versCalendrier(r.endsAt),
        resourceIds: [String(item.id)],
        backgroundColor: statusColor(r.status),
        extendedProps: {
          reservationId: r.id,
          itemId: item.id,
          status: r.status,
          quantityReserved: r.quantityReserved,
          user: r.user,
          useLabel,
          usage: r.usage,
        },
      })
    }
  }
  return list
})

// Ajouter un jour à endDate (validRange.end est exclusif)
const exclusiveEndDate = computed(() => {
  if (!props.endDate) return undefined
  const d = new Date(props.endDate)
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
})

/**
 * Nombre de jours de la vue « semaine » : ceux du périmètre, sept au plus. EventCalendar affiche
 * toute la durée de la vue, jours hors périmètre compris (grisés) ; FullCalendar la rognait.
 */
const joursDeLaVue = computed(() => {
  if (!props.startDate || !exclusiveEndDate.value) return 7
  const ecart = Math.round(
    (Date.parse(`${exclusiveEndDate.value}T00:00:00Z`) -
      Date.parse(`${props.startDate.slice(0, 10)}T00:00:00Z`)) /
      86_400_000
  )
  return Number.isFinite(ecart) ? Math.min(7, Math.max(1, ecart)) : 7
})

const calendarOptions = reactive<OptionsCalendrier>({
  locale: locale.value,

  // L'instant présent dans le fuseau de l'édition ; les réservations, elles, arrivent en heures du
  // lieu (cf. `calendrier-flottant`). Même choix que le planning des bénévoles.
  timeZone: decalageDuFuseau(props.fuseau),

  view: 'resourceTimelineWeek',
  date: props.startDate?.slice(0, 10) ?? undefined,
  validRange: {
    start: props.startDate?.slice(0, 10) ?? undefined,
    end: exclusiveEndDate.value,
  },
  slotMinTime: '00:00:00',
  slotMaxTime: '24:00:00',
  slotDuration: '00:15:00',
  slotLabelInterval: '01:00:00',
  // Une heure d'environ 120 px (quatre cases de 30 px), comme sous FullCalendar.
  slotWidth: 30,
  resources: [],
  events: [],
  editable: false,
  selectable: false,
  // Pas de barre de l'heure actuelle ici : FullCalendar ne l'affichait pas sur ce planning.
  nowIndicator: false,
  height: 'auto',
  headerToolbar: {
    start: 'prev,next today',
    center: 'title',
    end: 'resourceTimelineDay,resourceTimelineWeek',
  },
  buttonText: (textes: Record<string, string>) => ({
    ...textes,
    today: t('calendar.today'),
    resourceTimelineDay: t('common.day'),
    resourceTimelineWeek: t('common.week'),
  }),
  titleFormat: {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  },
  views: {
    resourceTimelineDay: {
      slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
    },
    resourceTimelineWeek: {
      duration: { days: joursDeLaVue.value },
      slotLabelFormat: { hour: '2-digit' },
      dayHeaderFormat: { weekday: 'short', day: '2-digit', month: '2-digit' },
    },
  },
  eventContent: (arg: any) => {
    const ext = arg.event.extendedProps as {
      quantityReserved: number
      user: ReservationUser
      useLabel: string
      usage: string
    }
    const container = document.createElement('div')
    container.className = 'stock-event-content'

    // Ligne 1 : quantité + titre (usage)
    const title = document.createElement('div')
    title.className = 'stock-event-title'
    title.textContent = ext.usage
      ? `×${ext.quantityReserved} · ${ext.usage}`
      : `×${ext.quantityReserved}`
    container.appendChild(title)

    // Ligne 2 : localisation de la réservation
    if (ext.useLabel) {
      const loc = document.createElement('div')
      loc.className = 'stock-event-loc'
      loc.textContent = `📍 ${ext.useLabel}`
      container.appendChild(loc)
    }

    // Ligne 3 : utilisateur (avatar + prénom nom)
    if (ext.user) {
      const userLine = document.createElement('div')
      userLine.className = 'stock-event-user'

      const displayName =
        [ext.user.prenom, ext.user.nom].filter(Boolean).join(' ') || ext.user.pseudo || ''

      const avatar = document.createElement('img')
      avatar.src = getUserAvatar(ext.user, 16)
      avatar.alt = ''
      avatar.className = 'stock-event-avatar'
      // Fallback en cas d'échec de chargement (Gravatar 404, image perdue…)
      avatar.onerror = () => {
        avatar.onerror = null
        avatar.src = generateInitialsAvatar(displayName || '?', 16)
      }
      userLine.appendChild(avatar)

      const name = document.createElement('span')
      name.textContent = displayName
      userLine.appendChild(name)

      container.appendChild(userLine)
    }

    return { domNodes: [container] }
  },
  eventClick: (arg: any) => {
    const reservationId = arg.event.extendedProps.reservationId as number
    const itemId = arg.event.extendedProps.itemId as number
    const item = props.items.find((i) => i.id === itemId)
    const reservation = item?.reservations.find((r) => r.id === reservationId)
    if (item && reservation) emit('reservation-click', reservation, item)
  },
})

// Date de la première réservation, pour positionner la vue par défaut dessus
const firstReservationDate = computed<string | null>(() => {
  let earliest: string | null = null
  for (const item of props.items) {
    for (const r of item.reservations) {
      if (Number.isNaN(new Date(r.startsAt).getTime())) continue
      if (earliest === null || new Date(r.startsAt) < new Date(earliest)) earliest = r.startsAt
    }
  }
  // Le JOUR du lieu : c'est lui que le calendrier affiche.
  return earliest !== null ? versCalendrier(earliest).slice(0, 10) : null
})

// Sync les données dans les options réactives
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
    calendarOptions.date = firstResa || start?.slice(0, 10) || undefined
    calendarOptions.validRange = { start: start?.slice(0, 10) ?? undefined, end }
    calendarOptions.views.resourceTimelineWeek.duration = { days: joursDeLaVue.value }
  },
  { immediate: true }
)
// L'édition se charge en asynchrone : le calendrier est souvent construit AVANT que son fuseau
// soit connu. Les réservations suivent d'elles-mêmes (`events` dépend du fuseau).
watch(
  () => props.fuseau,
  (nouveau) => {
    calendarOptions.timeZone = decalageDuFuseau(nouveau)
  }
)

watch(
  () => locale.value,
  (val) => {
    calendarOptions.locale = val
  }
)
</script>

<style>
/* Styles repris du planning bénévoles pour cohérence visuelle.
   Non-scoped car le calendrier génère le DOM dynamiquement, hors de portée du compilateur. */
.stock-planning-calendar .ec {
  font-size: 0.875rem;
}
/* Colonne des objets : EventCalendar la dimensionne d'après son contenu ; on la borne, comme les
   25 % de `resourceAreaWidth` sous FullCalendar. */
.stock-planning-calendar .ec-sidebar {
  max-inline-size: 18rem;
}
@media (max-width: 768px) {
  .stock-planning-calendar .ec-sidebar {
    max-inline-size: 7.5rem;
  }
}
.stock-planning-calendar .ec-toolbar {
  padding: 0.75rem 0.75rem 0;
}
/* En-têtes : le jour centré, les heures à gauche, en gras (comme sous FullCalendar). */
.stock-planning-calendar .ec-header .ec-col-head,
.stock-planning-calendar .ec-header .ec-slot {
  font-weight: 700;
  color: rgb(17 24 39);
}
.stock-planning-calendar .ec-header .ec-col-head {
  text-align: center;
}
.stock-planning-calendar .ec-header .ec-slot {
  text-align: start;
}
.stock-planning-calendar .ec-day-view .ec-header .ec-col-head {
  display: none;
}
/* Titre de la colonne des objets (cf. `--entete-ressources` posé par le composant). */
.stock-planning-calendar .ec-header .ec-sidebar {
  display: flex;
  align-items: center;
  padding: 0 0.5rem;
  font-weight: 700;
  color: rgb(17 24 39);
}
.stock-planning-calendar .ec-header .ec-sidebar::before {
  content: var(--entete-ressources, '');
}
.stock-planning-calendar .ec-body .ec-sidebar {
  text-align: start;
  background-color: rgb(249 250 251);
  color: rgb(17 24 39);
}
.stock-planning-calendar .ec-row-head {
  padding: 0.5rem;
}
.stock-planning-calendar .ec-event {
  cursor: pointer;
  color: white;
  border-radius: 0.25rem;
}
.stock-planning-calendar .ec-event-body {
  min-width: 0;
  width: 100%;
}

/* Variantes dark mode */
.dark .stock-planning-calendar .ec {
  --ec-border-color: rgb(75 85 99); /* gray-600 */
}
.dark .stock-planning-calendar .ec-header .ec-col-head,
.dark .stock-planning-calendar .ec-header .ec-slot,
.dark .stock-planning-calendar .ec-header .ec-sidebar {
  color: rgb(243 244 246);
}
.dark .stock-planning-calendar .ec-body .ec-sidebar {
  background-color: rgb(31 41 55);
  color: rgb(243 244 246);
}
.stock-planning-calendar .stock-event-content {
  padding: 2px 4px;
  font-size: 0.75rem;
  line-height: 1.2;
  overflow: hidden;
  min-width: 0;
}
.stock-planning-calendar .stock-event-title {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stock-planning-calendar .stock-event-loc {
  font-size: 0.7rem;
  opacity: 0.9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}
.stock-planning-calendar .stock-event-user {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  font-size: 0.7rem;
  opacity: 0.95;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stock-planning-calendar .stock-event-avatar {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
</style>
