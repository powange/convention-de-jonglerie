import {
  formatEventsForCalendar,
  getCalendarLocale,
  defaultHeaderToolbar,
  mobileHeaderToolbar,
  defaultCalendarStyle,
  getCalendarButtonText,
  CLE_MOIS_DU_CALENDRIER,
  dateDOuvertureDuCalendrier,
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

  // Détection de la taille d'écran
  const isMobile = ref(false)
  if (import.meta.client) {
    const { width } = useWindowSize()
    watch(
      width,
      (newWidth) => {
        isMobile.value = newWidth < 768
      },
      { immediate: true }
    )
  }

  const {
    events: sourceEvents,
    onEventClick,
    eventTooltipFormatter,
    initialView = 'dayGridMonth',
    height = defaultCalendarStyle.height,
    headerToolbar,
    dayMaxEvents = defaultCalendarStyle.dayMaxEvents,
  } = options

  // Utiliser la toolbar mobile ou desktop selon la taille d'écran
  const computedHeaderToolbar = computed(() =>
    headerToolbar ? headerToolbar : isMobile.value ? mobileHeaderToolbar : defaultHeaderToolbar
  )

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

  /**
   * Le mois sur lequel s'ouvrir : celui qu'on regardait, sinon aujourd'hui.
   *
   * `sessionStorage` et non `localStorage`. La mémoire sert à ne pas perdre sa place quand le
   * calendrier est démonté — sur la page d'accueil, passer à la carte puis revenir le démonte —
   * et ce besoin dure le temps d'une visite. En le stockant sans fin, un mois parcouru une fois
   * s'installait pour toujours : signalé en production, l'agenda s'ouvrait sur juin 2026 alors
   * qu'on était en septembre.
   *
   * Les accès sont enveloppés : en navigation privée, avec les données de site bloquées ou dans
   * certains contextes intégrés, lire ou écrire lève — et le calendrier ne s'afficherait pas.
   */
  const getSavedDate = (): Date => {
    if (!import.meta.client) return new Date()

    // L'ancienne mémoire, sans fin, est effacée au passage : elle ne sert plus, et sans ce
    // ménage elle resterait dans le navigateur de chaque visiteur pour toujours.
    //
    // Dans son PROPRE `try` : les deux stockages ne sont pas toujours autorisés ensemble, et un
    // `localStorage` bloqué ne doit pas empêcher de lire le `sessionStorage` qui, lui, marche —
    // on perdrait sa place à chaque aller-retour pour un ménage qui ne regarde que le passé.
    try {
      localStorage.removeItem(CLE_MOIS_DU_CALENDRIER)
    } catch {
      // Tant pis pour le ménage.
    }

    try {
      return dateDOuvertureDuCalendrier(sessionStorage.getItem(CLE_MOIS_DU_CALENDRIER))
    } catch {
      return new Date()
    }
  }

  const saveCurrentDate = (date: Date) => {
    if (!import.meta.client) return

    try {
      sessionStorage.setItem(CLE_MOIS_DU_CALENDRIER, date.toISOString())
    } catch {
      // Perdre sa place vaut mieux que de ne pas afficher le calendrier.
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
    headerToolbar: computedHeaderToolbar.value,
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

  // Watcher pour mettre à jour les toolbars selon la taille d'écran
  watch(isMobile, (mobile) => {
    calendarOptions.headerToolbar = mobile ? mobileHeaderToolbar : defaultHeaderToolbar
  })

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
