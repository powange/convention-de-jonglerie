import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  formatEventForCalendar,
  formatEventsForCalendar,
  getCalendarLocale,
  getCalendarButtonText,
  getCalendarOptions,
  generateGoogleCalendarLink,
  generateOutlookCalendarLink,
  generateIcsFile,
  defaultHeaderToolbar,
  mobileHeaderToolbar,
  mobileHeaderButtons,
  defaultCalendarStyle,
  type CalendarEvent,
  type CalendarEventData,
} from '../../../app/utils/calendar'

// Traducteur factice : renvoie la clé telle quelle (le code fait `t(...) || fallback`)
const tIdentity = (key: string) => key

describe('calendar utils', () => {
  describe('formatEventForCalendar', () => {
    const baseEvent: CalendarEvent = {
      id: 42,
      name: 'EJC',
      startDate: '2024-06-10T00:00:00Z',
      endDate: '2024-06-15T00:00:00Z',
      convention: { name: 'European Juggling Convention' },
    }

    it('devrait convertir un événement au format FullCalendar', () => {
      const result = formatEventForCalendar(baseEvent)

      expect(result.id).toBe('42')
      expect(result.title).toBe('EJC')
      expect(result.start).toBe('2024-06-10')
      expect(result.allDay).toBe(true)
      expect(result.extendedProps).toBe(baseEvent)
    })

    it('devrait rendre la date de fin exclusive (jour suivant)', () => {
      const result = formatEventForCalendar(baseEvent)
      // FullCalendar attend une fin exclusive : 15 + 1 = 16
      expect(result.end).toBe('2024-06-16')
    })

    it("devrait utiliser le nom de la convention si l'édition n'a pas de nom", () => {
      const event: CalendarEvent = {
        id: 7,
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-02T00:00:00Z',
        convention: { name: 'Convention sans nom édition' },
      }
      const result = formatEventForCalendar(event)
      expect(result.title).toBe('Convention sans nom édition')
    })

    it('devrait convertir un id numérique en chaîne', () => {
      const result = formatEventForCalendar(baseEvent)
      expect(typeof result.id).toBe('string')
    })

    it('devrait gérer un événement à cheval sur deux mois', () => {
      const event: CalendarEvent = {
        id: 1,
        name: 'À cheval',
        startDate: '2024-01-30T00:00:00Z',
        endDate: '2024-02-02T00:00:00Z',
        convention: { name: 'C' },
      }
      const result = formatEventForCalendar(event)
      expect(result.start).toBe('2024-01-30')
      expect(result.end).toBe('2024-02-03')
    })

    it('devrait gérer un événement à cheval sur deux années (31 déc -> 1er jan)', () => {
      const event: CalendarEvent = {
        id: 2,
        name: 'Nouvel an',
        startDate: '2024-12-31T00:00:00Z',
        endDate: '2024-12-31T00:00:00Z',
        convention: { name: 'C' },
      }
      const result = formatEventForCalendar(event)
      expect(result.start).toBe('2024-12-31')
      // fin exclusive => 1er janvier de l'année suivante
      expect(result.end).toBe('2025-01-01')
    })
  })

  describe('formatEventsForCalendar', () => {
    it("devrait convertir une liste d'événements", () => {
      const events: CalendarEvent[] = [
        {
          id: 1,
          name: 'A',
          startDate: '2024-06-10T00:00:00Z',
          endDate: '2024-06-12T00:00:00Z',
          convention: { name: 'CA' },
        },
        {
          id: 2,
          name: 'B',
          startDate: '2024-07-01T00:00:00Z',
          endDate: '2024-07-03T00:00:00Z',
          convention: { name: 'CB' },
        },
      ]
      const result = formatEventsForCalendar(events)
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('1')
      expect(result[0].title).toBe('A')
      expect(result[1].id).toBe('2')
      expect(result[1].end).toBe('2024-07-04')
    })

    it('devrait retourner un tableau vide pour une liste vide', () => {
      expect(formatEventsForCalendar([])).toEqual([])
    })
  })

  describe('getCalendarLocale', () => {
    it('devrait retourner une locale via correspondance exacte', () => {
      expect(getCalendarLocale('fr')).toBe('fr')
      expect(getCalendarLocale('en-GB')).toBe('en-gb')
      expect(getCalendarLocale('pt-BR')).toBe('pt-br')
    })

    it('devrait mapper une locale régionale vers sa base', () => {
      expect(getCalendarLocale('fr-FR')).toBe('fr')
      expect(getCalendarLocale('de-DE')).toBe('de')
    })

    it('devrait utiliser le préfixe quand la locale exacte est absente', () => {
      // fr-CA n'est pas dans la map => préfixe "fr"
      expect(getCalendarLocale('fr-CA')).toBe('fr')
      expect(getCalendarLocale('es-MX')).toBe('es')
    })

    it("devrait retourner 'en' par défaut pour une locale inconnue", () => {
      expect(getCalendarLocale('xx')).toBe('en')
      expect(getCalendarLocale('zz-ZZ')).toBe('en')
      expect(getCalendarLocale('')).toBe('en')
    })
  })

  describe('constantes de configuration', () => {
    it('defaultHeaderToolbar devrait contenir la configuration desktop', () => {
      expect(defaultHeaderToolbar).toEqual({
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,listMonth',
      })
    })

    it('mobileHeaderToolbar devrait contenir la configuration mobile', () => {
      expect(mobileHeaderToolbar.left).toBe('title')
      expect(mobileHeaderToolbar.right).toBe('prev,next')
    })

    it('mobileHeaderButtons devrait contenir les boutons mobile', () => {
      expect(mobileHeaderButtons.left).toBe('today dayGridMonth,listMonth')
    })

    it('defaultCalendarStyle devrait commencer la semaine le lundi', () => {
      expect(defaultCalendarStyle.firstDay).toBe(1)
      expect(defaultCalendarStyle.height).toBe('auto')
      expect(defaultCalendarStyle.dayMaxEvents).toBe(3)
    })
  })

  describe('getCalendarButtonText', () => {
    it('devrait utiliser les traductions fournies', () => {
      const t = (key: string) => `T:${key}`
      const result = getCalendarButtonText(t)
      expect(result).toEqual({
        today: 'T:calendar.today',
        month: 'T:calendar.month',
        list: 'T:calendar.list',
        week: 'T:calendar.week',
        day: 'T:calendar.day',
      })
    })

    it('devrait utiliser les libellés par défaut si la traduction est vide', () => {
      const t = () => ''
      const result = getCalendarButtonText(t)
      expect(result).toEqual({
        today: 'Today',
        month: 'Month',
        list: 'List',
        week: 'Week',
        day: 'Day',
      })
    })
  })

  describe('generateGoogleCalendarLink', () => {
    const event: CalendarEventData = {
      title: 'EJC 2024',
      description: 'Convention de jonglerie',
      location: 'Ovar, Portugal',
      startDate: '2024-08-03T00:00:00Z',
      endDate: '2024-08-11T00:00:00Z',
    }

    it("devrait générer un lien Google Calendar avec l'action TEMPLATE", () => {
      const link = generateGoogleCalendarLink(event)
      expect(link).toContain('https://calendar.google.com/calendar/render?')
      expect(link).toContain('action=TEMPLATE')
    })

    it('devrait formater les dates au format iCal (sans tirets ni deux-points)', () => {
      const link = generateGoogleCalendarLink(event)
      const params = new URLSearchParams(link.split('?')[1])
      expect(params.get('dates')).toBe('20240803T000000Z/20240811T000000Z')
    })

    it('devrait inclure le titre, la description et le lieu', () => {
      const link = generateGoogleCalendarLink(event)
      const params = new URLSearchParams(link.split('?')[1])
      expect(params.get('text')).toBe('EJC 2024')
      expect(params.get('details')).toBe('Convention de jonglerie')
      expect(params.get('location')).toBe('Ovar, Portugal')
    })

    it('devrait gérer une description et un lieu absents', () => {
      const link = generateGoogleCalendarLink({
        title: 'Minimal',
        startDate: '2024-08-03T00:00:00Z',
        endDate: '2024-08-11T00:00:00Z',
      })
      const params = new URLSearchParams(link.split('?')[1])
      expect(params.get('details')).toBe('')
      expect(params.get('location')).toBe('')
      expect(params.has('sprop')).toBe(false)
    })

    it("devrait inclure sprop lorsqu'une url est fournie", () => {
      const link = generateGoogleCalendarLink({ ...event, url: 'https://ejc.com' })
      const params = new URLSearchParams(link.split('?')[1])
      expect(params.get('sprop')).toBe('website:https://ejc.com')
    })
  })

  describe('generateOutlookCalendarLink', () => {
    const event: CalendarEventData = {
      title: 'EJC 2024',
      description: 'desc',
      location: 'Ovar',
      startDate: '2024-08-03T00:00:00Z',
      endDate: '2024-08-11T00:00:00Z',
    }

    it('devrait générer un lien Outlook deeplink', () => {
      const link = generateOutlookCalendarLink(event)
      expect(link).toContain('https://outlook.live.com/calendar/0/deeplink/compose?')
    })

    it('devrait inclure le sujet et les dates au format ISO', () => {
      const link = generateOutlookCalendarLink(event)
      const params = new URLSearchParams(link.split('?')[1])
      expect(params.get('subject')).toBe('EJC 2024')
      expect(params.get('startdt')).toBe('2024-08-03T00:00:00.000Z')
      expect(params.get('enddt')).toBe('2024-08-11T00:00:00.000Z')
      expect(params.get('body')).toBe('desc')
      expect(params.get('location')).toBe('Ovar')
    })

    it("devrait inclure allday=false lorsqu'une url est fournie", () => {
      const link = generateOutlookCalendarLink({ ...event, url: 'https://ejc.com' })
      const params = new URLSearchParams(link.split('?')[1])
      expect(params.get('allday')).toBe('false')
    })

    it('devrait gérer une description et un lieu absents', () => {
      const link = generateOutlookCalendarLink({
        title: 'Minimal',
        startDate: '2024-08-03T00:00:00Z',
        endDate: '2024-08-11T00:00:00Z',
      })
      const params = new URLSearchParams(link.split('?')[1])
      expect(params.get('body')).toBe('')
      expect(params.get('location')).toBe('')
      expect(params.has('allday')).toBe(false)
    })
  })

  describe('generateIcsFile', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-01T10:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    const decode = (dataUri: string) =>
      decodeURIComponent(dataUri.replace('data:text/calendar;charset=utf8,', ''))

    it('devrait générer un data URI calendar', () => {
      const ics = generateIcsFile({
        title: 'EJC',
        startDate: '2024-08-03T00:00:00Z',
        endDate: '2024-08-11T00:00:00Z',
      })
      expect(ics).toContain('data:text/calendar;charset=utf8,')
    })

    it('devrait contenir la structure VCALENDAR / VEVENT', () => {
      const content = decode(
        generateIcsFile({
          title: 'EJC',
          startDate: '2024-08-03T00:00:00Z',
          endDate: '2024-08-11T00:00:00Z',
        })
      )
      expect(content).toContain('BEGIN:VCALENDAR')
      expect(content).toContain('VERSION:2.0')
      expect(content).toContain('BEGIN:VEVENT')
      expect(content).toContain('END:VEVENT')
      expect(content).toContain('END:VCALENDAR')
    })

    it('devrait inclure le titre, les dates et le DTSTAMP', () => {
      const content = decode(
        generateIcsFile({
          title: 'EJC',
          startDate: '2024-08-03T00:00:00Z',
          endDate: '2024-08-11T00:00:00Z',
        })
      )
      expect(content).toContain('SUMMARY:EJC')
      expect(content).toContain('DTSTART:20240803T000000Z')
      expect(content).toContain('DTEND:20240811T000000Z')
      // DTSTAMP basé sur la date système moquée
      expect(content).toContain('DTSTAMP:20240101T100000Z')
    })

    it("devrait inclure la description, le lieu et l'url quand présents", () => {
      const content = decode(
        generateIcsFile({
          title: 'EJC',
          description: 'Ligne 1\nLigne 2',
          location: 'Ovar',
          url: 'https://ejc.com',
          startDate: '2024-08-03T00:00:00Z',
          endDate: '2024-08-11T00:00:00Z',
        })
      )
      expect(content).toContain('DESCRIPTION:Ligne 1\\nLigne 2')
      expect(content).toContain('LOCATION:Ovar')
      expect(content).toContain('URL:https://ejc.com')
    })

    it('ne devrait pas inclure les champs optionnels absents', () => {
      const content = decode(
        generateIcsFile({
          title: 'EJC',
          startDate: '2024-08-03T00:00:00Z',
          endDate: '2024-08-11T00:00:00Z',
        })
      )
      expect(content).not.toContain('DESCRIPTION:')
      expect(content).not.toContain('LOCATION:')
      expect(content).not.toContain('URL:')
    })

    it('devrait échapper les sauts de ligne de la description', () => {
      const content = decode(
        generateIcsFile({
          title: 'EJC',
          description: 'a\nb\nc',
          startDate: '2024-08-03T00:00:00Z',
          endDate: '2024-08-11T00:00:00Z',
        })
      )
      expect(content).toContain('DESCRIPTION:a\\nb\\nc')
    })
  })

  describe('getCalendarOptions', () => {
    const event: CalendarEventData = {
      title: 'EJC 2024',
      startDate: '2024-08-03T00:00:00Z',
      endDate: '2024-08-11T00:00:00Z',
    }

    it('devrait retourner les trois options de calendrier', () => {
      const options = getCalendarOptions(event, tIdentity)
      expect(options).toHaveLength(3)
      expect(options.map((o) => o.label)).toEqual([
        'calendar.google_calendar',
        'calendar.outlook_calendar',
        'calendar.download_ics',
      ])
    })

    it('devrait fournir une icône pour chaque option', () => {
      const options = getCalendarOptions(event, tIdentity)
      expect(options[0].icon).toBe('i-heroicons-calendar')
      expect(options[1].icon).toBe('i-heroicons-calendar')
      expect(options[2].icon).toBe('i-heroicons-arrow-down-tray')
    })

    it('devrait utiliser les libellés par défaut si traduction vide', () => {
      const options = getCalendarOptions(event, () => '')
      expect(options.map((o) => o.label)).toEqual([
        'Google Calendar',
        'Outlook Calendar',
        'Télécharger (.ics)',
      ])
    })

    it("l'action Google devrait ouvrir une fenêtre avec le lien Google", () => {
      const openSpy = vi.fn()
      vi.stubGlobal('window', { open: openSpy })

      const options = getCalendarOptions(event, tIdentity)
      options[0].action(event)

      expect(openSpy).toHaveBeenCalledTimes(1)
      const url = openSpy.mock.calls[0][0]
      expect(url).toContain('calendar.google.com')
      expect(openSpy.mock.calls[0][1]).toBe('_blank')

      vi.unstubAllGlobals()
    })

    it("l'action Outlook devrait ouvrir une fenêtre avec le lien Outlook", () => {
      const openSpy = vi.fn()
      vi.stubGlobal('window', { open: openSpy })

      const options = getCalendarOptions(event, tIdentity)
      options[1].action(event)

      expect(openSpy).toHaveBeenCalledTimes(1)
      expect(openSpy.mock.calls[0][0]).toContain('outlook.live.com')

      vi.unstubAllGlobals()
    })

    it("l'action de téléchargement ICS devrait créer un lien et le cliquer", () => {
      const clickSpy = vi.fn()
      const fakeLink: Record<string, any> = { click: clickSpy }
      const createElementSpy = vi
        .spyOn(document, 'createElement')
        .mockReturnValue(fakeLink as unknown as HTMLElement)

      const options = getCalendarOptions(event, tIdentity)
      options[2].action(event)

      expect(createElementSpy).toHaveBeenCalledWith('a')
      expect(fakeLink.href).toContain('data:text/calendar')
      // Le nom de fichier est assaini (caractères non alphanumériques -> _)
      expect(fakeLink.download).toBe('ejc_2024.ics')
      expect(clickSpy).toHaveBeenCalledTimes(1)

      createElementSpy.mockRestore()
    })
  })
})
