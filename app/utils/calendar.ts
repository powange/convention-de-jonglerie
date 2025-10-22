import { DateTime } from 'luxon'

import { getEditionDisplayName } from './editionName'

import type { EventInput } from '@fullcalendar/core'

export interface CalendarEvent {
  id: number
  name?: string
  startDate: string
  endDate: string
  convention?: { name: string }
  [key: string]: any
}

/**
 * Convertit un événement au format FullCalendar
 */
export function formatEventForCalendar(event: CalendarEvent): EventInput {
  const start = DateTime.fromISO(event.startDate).toISODate()
  const endExclusive = DateTime.fromISO(event.endDate).plus({ days: 1 }).toISODate()

  return {
    id: String(event.id),
    title: getEditionDisplayName(event),
    start,
    end: endExclusive,
    allDay: true,
    extendedProps: event,
  }
}

/**
 * Convertit une liste d'événements au format FullCalendar
 */
export function formatEventsForCalendar(events: CalendarEvent[]): EventInput[] {
  return events.map((e) => formatEventForCalendar(e))
}

/**
 * Détermine la locale FullCalendar en fonction de la locale i18n
 */
export function getCalendarLocale(locale: string): string {
  // FullCalendar supporte de nombreuses locales
  // On peut étendre cette fonction pour supporter plus de langues
  const localeMap: Record<string, string> = {
    fr: 'fr',
    'fr-FR': 'fr',
    en: 'en',
    'en-US': 'en',
    'en-GB': 'en-gb',
    de: 'de',
    'de-DE': 'de',
    es: 'es',
    'es-ES': 'es',
    it: 'it',
    'it-IT': 'it',
    pt: 'pt',
    'pt-PT': 'pt',
    'pt-BR': 'pt-br',
    nl: 'nl',
    'nl-NL': 'nl',
    pl: 'pl',
    'pl-PL': 'pl',
    ru: 'ru',
    'ru-RU': 'ru',
    uk: 'uk',
    'uk-UA': 'uk',
    da: 'da',
    'da-DK': 'da',
    cs: 'cs',
    'cs-CZ': 'cs',
    sv: 'sv',
    'sv-SE': 'sv',
  }

  // Recherche exacte
  if (localeMap[locale]) {
    return localeMap[locale]
  }

  // Recherche par préfixe (ex: fr-CA -> fr)
  const prefix = locale.split('-')[0]
  if (localeMap[prefix]) {
    return localeMap[prefix]
  }

  // Par défaut, anglais
  return 'en'
}

/**
 * Options par défaut pour la toolbar du calendrier
 */
export const defaultHeaderToolbar = {
  left: 'prev,next today',
  center: 'title',
  right: 'dayGridMonth,listMonth',
}

/**
 * Options de style par défaut
 */
export const defaultCalendarStyle = {
  height: 'auto',
  firstDay: 1, // Lundi comme premier jour de la semaine
  dayMaxEvents: 3,
}

/**
 * Génère les labels de boutons traduits
 */
export function getCalendarButtonText(t: any) {
  return {
    today: t('calendar.today') || 'Today',
    month: t('calendar.month') || 'Month',
    list: t('calendar.list') || 'List',
    week: t('calendar.week') || 'Week',
    day: t('calendar.day') || 'Day',
  }
}

/**
 * Interface pour les données d'événement à ajouter au calendrier
 */
export interface CalendarEventData {
  title: string
  description?: string
  location?: string
  startDate: string
  endDate: string
  url?: string
}

/**
 * Formate une date au format iCal (YYYYMMDDTHHMMSSZ)
 */
function formatDateForIcal(dateString: string): string {
  const date = new Date(dateString)
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

/**
 * Génère un lien Google Calendar
 */
export function generateGoogleCalendarLink(event: CalendarEventData): string {
  const startDate = formatDateForIcal(event.startDate)
  const endDate = formatDateForIcal(event.endDate)

  const description = event.description || ''

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${startDate}/${endDate}`,
    details: description,
    location: event.location || '',
    ...(event.url && { sprop: `website:${event.url}` }),
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Génère un lien Outlook Calendar
 */
export function generateOutlookCalendarLink(event: CalendarEventData): string {
  const startDate = new Date(event.startDate).toISOString()
  const endDate = new Date(event.endDate).toISOString()

  const body = event.description || ''

  const params = new URLSearchParams({
    subject: event.title,
    startdt: startDate,
    enddt: endDate,
    body,
    location: event.location || '',
    ...(event.url && { allday: 'false' }),
  })

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}

/**
 * Génère un fichier ICS pour les autres calendriers
 */
export function generateIcsFile(event: CalendarEventData): string {
  const startDate = formatDateForIcal(event.startDate)
  const endDate = formatDateForIcal(event.endDate)
  const now = formatDateForIcal(new Date().toISOString())

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Juggling Convention//Event//EN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@juggling-convention.com`,
    `DTSTAMP:${now}`,
    `DTSTART:${startDate}`,
    `DTEND:${endDate}`,
    `SUMMARY:${event.title}`,
    ...(event.description ? [`DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`] : []),
    ...(event.location ? [`LOCATION:${event.location}`] : []),
    ...(event.url ? [`URL:${event.url}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  return `data:text/calendar;charset=utf8,${encodeURIComponent(icsContent)}`
}

/**
 * Options de calendrier disponibles
 */
export interface CalendarOption {
  label: string
  icon: string
  action: (event: CalendarEventData) => void
}

/**
 * Génère les options de calendrier avec traductions
 */
export function getCalendarOptions(event: CalendarEventData, t: any): CalendarOption[] {
  return [
    {
      label: t('calendar.google_calendar') || 'Google Calendar',
      icon: 'i-heroicons-calendar',
      action: () => {
        window.open(generateGoogleCalendarLink(event), '_blank')
      },
    },
    {
      label: t('calendar.outlook_calendar') || 'Outlook Calendar',
      icon: 'i-heroicons-calendar',
      action: () => {
        window.open(generateOutlookCalendarLink(event), '_blank')
      },
    },
    {
      label: t('calendar.download_ics') || 'Télécharger (.ics)',
      icon: 'i-heroicons-arrow-down-tray',
      action: () => {
        const link = document.createElement('a')
        link.href = generateIcsFile(event)
        link.download = `${event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`
        link.click()
      },
    },
  ]
}
