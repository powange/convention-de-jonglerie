import {
  formatEventsForCalendar,
  getCalendarLocale,
  defaultHeaderToolbar,
  defaultCalendarStyle,
  getCalendarButtonText,
  type CalendarEvent,
} from '~/utils/calendar'

import type { CalendarOptions, EventClickArg, EventMountArg } from '@fullcalendar/core'
import type { ComputedRef, Ref } from 'vue'

export interface UseCalendarOptions {
  events: Ref<CalendarEvent[]> | ComputedRef<CalendarEvent[]>
  onEventClick?: (eventId: number) => void
  eventTooltipFormatter?: (event: CalendarEvent) => string[]
  initialView?: string
  height?: string | number
  headerToolbar?: any
  dayMaxEvents?: number
}

export function useCalendar(options: UseCalendarOptions) {
  const { locale, t } = useI18n()
  const router = useRouter()

  const {
    events: sourceEvents,
    onEventClick,
    eventTooltipFormatter,
    initialView = 'dayGridMonth',
    height = defaultCalendarStyle.height,
    headerToolbar = defaultHeaderToolbar,
    dayMaxEvents = defaultCalendarStyle.dayMaxEvents,
  } = options

  const calendarRef = ref<any>(null)
  const ready = ref(false)
  const plugins = shallowRef<any[]>([])
  const allLocales = shallowRef<any[]>([])

  // Charger les plugins dynamiquement
  const loadPlugins = async () => {
    try {
      const [dayGrid, list, interaction, locales] = await Promise.all([
        import('@fullcalendar/daygrid'),
        import('@fullcalendar/list'),
        import('@fullcalendar/interaction'),
        import('@fullcalendar/core/locales-all'),
      ])

      plugins.value = [dayGrid.default, list.default, interaction.default]
      allLocales.value = locales.default
    } catch (error) {
      console.error('Error loading FullCalendar plugins:', error)
    }
  }

  // Événements formatés pour FullCalendar
  const events = computed(() => {
    return formatEventsForCalendar(unref(sourceEvents))
  })

  const fcLocale = computed(() => getCalendarLocale(locale.value))

  // Récupérer la date sauvegardée ou utiliser aujourd'hui
  const getSavedDate = (): Date => {
    if (import.meta.client) {
      const savedDate = localStorage.getItem('calendar-current-date')
      if (savedDate) {
        return new Date(savedDate)
      }
    }
    return new Date()
  }

  // Sauvegarder la date courante
  const saveCurrentDate = (date: Date) => {
    if (import.meta.client) {
      localStorage.setItem('calendar-current-date', date.toISOString())
    }
  }

  // Options réactives selon l'exemple officiel Nuxt 3
  const calendarOptions = reactive<CalendarOptions>({
    plugins: plugins.value,
    locales: allLocales.value,
    initialView,
    initialDate: getSavedDate(),
    height,
    firstDay: defaultCalendarStyle.firstDay,
    locale: fcLocale.value,
    headerToolbar,
    buttonText: getCalendarButtonText(t),
    dayMaxEvents,

    // Événements passés directement (vide au départ, mis à jour par watcher)
    events: [],

    // Sauvegarder la date quand l'utilisateur navigue
    datesSet: (dateInfo) => {
      // Calculer le milieu de la période visible pour avoir le vrai mois affiché
      const startTime = dateInfo.start.getTime()
      const endTime = dateInfo.end.getTime()
      const middleTime = startTime + (endTime - startTime) / 2
      const middleDate = new Date(middleTime)
      saveCurrentDate(middleDate)
    },

    // Gestion des clics sur événements
    eventClick: (info: EventClickArg) => {
      const id = parseInt(info.event.id)
      if (id) {
        if (onEventClick) onEventClick(id)
        else router.push(`/editions/${id}`)
      }
    },

    // Gestion des tooltips
    eventDidMount: (arg: EventMountArg) => {
      if (eventTooltipFormatter) {
        const lines = eventTooltipFormatter(arg.event.extendedProps as CalendarEvent)
        if (lines.length) arg.el.title = lines.join(' • ')
      }
    },
  })

  // Watcher pour mettre à jour les plugins et locales quand ils sont chargés
  watch([plugins, allLocales], ([newPlugins, newLocales]) => {
    calendarOptions.plugins = newPlugins
    calendarOptions.locales = newLocales
  })

  // Watcher pour mettre à jour les événements
  watch(
    events,
    (newEvents) => {
      calendarOptions.events = newEvents
    },
    { deep: true, immediate: true }
  )

  // Initialisation
  onMounted(async () => {
    await loadPlugins()
    nextTick(() => {
      ready.value = true
      // S'assurer que les événements sont chargés au démarrage
      calendarOptions.events = events.value
    })
  })

  return {
    calendarRef,
    calendarOptions,
    ready,
  }
}
