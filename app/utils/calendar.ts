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
