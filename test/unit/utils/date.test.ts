import { describe, it, expect, afterEach, vi } from 'vitest'

import {
  formatDate,
  formatRelativeDate,
  formatDateRange,
  parseDateTimeLocal,
  formatDateTimeLocal,
  addHoursToDateTimeLocal,
  formatDurationCompact,
} from '../../../app/utils/date'

describe('date utils', () => {
  describe('formatDate', () => {
    it('formate une date au format medium (par défaut) en français', () => {
      // 15 juin 2024 à midi UTC -> reste le 15 juin en Europe/Paris
      const result = formatDate('2024-06-15T12:00:00Z')
      expect(result).toBe('15 juin 2024')
    })

    it('accepte un objet Date', () => {
      const result = formatDate(new Date('2024-06-15T12:00:00Z'))
      expect(result).toBe('15 juin 2024')
    })

    it('formate au format short (jj/mm/aaaa)', () => {
      const result = formatDate('2024-06-15T12:00:00Z', { format: 'short' })
      expect(result).toBe('15/06/2024')
    })

    it('formate au format long (avec le jour de la semaine)', () => {
      const result = formatDate('2024-06-15T12:00:00Z', { format: 'long' })
      // 15 juin 2024 est un samedi
      expect(result).toContain('samedi')
      expect(result).toContain('juin')
      expect(result).toContain('2024')
    })

    it("inclut l'heure quand includeTime est true", () => {
      const result = formatDate('2024-06-15T12:30:00Z', { includeTime: true })
      // 12:30 UTC -> 14:30 à Paris (été, UTC+2)
      expect(result).toContain('14:30')
      expect(result).toContain('15')
    })

    it('utilise la timezone Europe/Paris', () => {
      // 23:00 UTC le 15 juin -> 01:00 le 16 juin à Paris (UTC+2 en été)
      const result = formatDate('2024-06-15T23:00:00Z', { format: 'short' })
      expect(result).toBe('16/06/2024')
    })

    it('respecte une locale anglaise', () => {
      const result = formatDate('2024-06-15T12:00:00Z', { locale: 'en-US' })
      expect(result).toBe('June 15, 2024')
    })

    it('retourne une chaîne vide pour une date invalide (string)', () => {
      expect(formatDate('pas-une-date')).toBe('')
    })

    it('retourne une chaîne vide pour une date invalide (Date)', () => {
      expect(formatDate(new Date('invalide'))).toBe('')
    })

    it('retourne une chaîne vide pour une chaîne vide', () => {
      expect(formatDate('')).toBe('')
    })
  })

  describe('formatRelativeDate', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    const setNow = (iso: string) => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(iso))
    }

    // --- Dates dans le futur : comportement intuitif (Math.floor sur diff positif) ---

    it('formate quelques secondes dans le futur', () => {
      setNow('2024-06-15T12:00:00Z')
      expect(formatRelativeDate('2024-06-15T12:00:30Z')).toBe('dans 30 secondes')
    })

    it('formate quelques minutes dans le futur', () => {
      setNow('2024-06-15T12:00:00Z')
      expect(formatRelativeDate('2024-06-15T12:05:00Z')).toBe('dans 5 minutes')
    })

    it('formate quelques heures dans le futur', () => {
      setNow('2024-06-15T12:00:00Z')
      expect(formatRelativeDate('2024-06-15T15:00:00Z')).toBe('dans 3 heures')
    })

    it('formate quelques jours dans le futur', () => {
      setNow('2024-06-15T12:00:00Z')
      expect(formatRelativeDate('2024-06-18T12:00:00Z')).toBe('dans 3 jours')
    })

    it('utilise "demain" via numeric auto pour +1 jour', () => {
      setNow('2024-06-15T12:00:00Z')
      expect(formatRelativeDate('2024-06-16T12:00:00Z')).toBe('demain')
    })

    it('formate plusieurs mois dans le futur', () => {
      setNow('2024-06-15T12:00:00Z')
      expect(formatRelativeDate('2024-09-15T12:00:00Z')).toBe('dans 3 mois')
    })

    it('respecte la locale anglaise (futur)', () => {
      setNow('2024-06-15T12:00:00Z')
      expect(formatRelativeDate('2024-06-15T12:05:00Z', 'en')).toBe('in 5 minutes')
    })

    it('accepte un objet Date', () => {
      setNow('2024-06-15T12:00:00Z')
      expect(formatRelativeDate(new Date('2024-06-15T12:05:00Z'))).toBe('dans 5 minutes')
    })

    // --- Dates dans le passé : multiples exacts de l'unité ---

    it('formate plusieurs jours dans le passé (multiple exact)', () => {
      setNow('2024-06-20T12:00:00Z')
      expect(formatRelativeDate('2024-06-15T12:00:00Z')).toBe('il y a 5 jours')
    })

    it('utilise "hier" via numeric auto pour -1 jour', () => {
      setNow('2024-06-16T12:00:00Z')
      expect(formatRelativeDate('2024-06-15T12:00:00Z')).toBe('hier')
    })

    // --- Particularité connue : Math.floor sur un diff négatif arrondit vers le bas,
    //     donc une petite durée passée (heures/minutes) bascule à -1 jour => "hier". ---

    it('bascule à "hier" pour quelques heures dans le passé (Math.floor négatif)', () => {
      setNow('2024-06-15T15:00:00Z')
      expect(formatRelativeDate('2024-06-15T12:00:00Z')).toBe('hier')
    })

    it('bascule à "hier" pour quelques minutes dans le passé (Math.floor négatif)', () => {
      setNow('2024-06-15T12:05:00Z')
      expect(formatRelativeDate('2024-06-15T12:00:00Z')).toBe('hier')
    })
  })

  describe('formatDateRange', () => {
    it('affiche une seule date si début et fin sont le même jour', () => {
      const result = formatDateRange('2024-06-15T08:00:00Z', '2024-06-15T18:00:00Z')
      expect(result).toBe('15 juin 2024')
    })

    it('affiche une plage compacte pour le même mois et la même année', () => {
      const result = formatDateRange('2024-06-15T12:00:00Z', '2024-06-18T12:00:00Z')
      expect(result).toBe('15 - 18 juin 2024')
    })

    it('affiche deux dates complètes si mois différents', () => {
      const result = formatDateRange('2024-06-28T12:00:00Z', '2024-07-02T12:00:00Z')
      expect(result).toBe('28 juin 2024 - 2 juillet 2024')
    })

    it('affiche deux dates complètes si années différentes', () => {
      const result = formatDateRange('2024-12-30T12:00:00Z', '2025-01-02T12:00:00Z')
      expect(result).toBe('30 décembre 2024 - 2 janvier 2025')
    })

    it('respecte la locale pour la plage compacte', () => {
      const result = formatDateRange('2024-06-15T12:00:00Z', '2024-06-18T12:00:00Z', {
        locale: 'en-US',
      })
      expect(result).toBe('15 - 18 June 2024')
    })

    it('accepte des objets Date', () => {
      const result = formatDateRange(
        new Date('2024-06-15T12:00:00Z'),
        new Date('2024-06-18T12:00:00Z')
      )
      expect(result).toBe('15 - 18 juin 2024')
    })

    it('respecte le format short pour des mois différents', () => {
      const result = formatDateRange('2024-06-28T12:00:00Z', '2024-07-02T12:00:00Z', {
        format: 'short',
      })
      expect(result).toBe('28/06/2024 - 02/07/2024')
    })
  })

  describe('parseDateTimeLocal', () => {
    it('convertit une chaîne datetime-local en Date locale', () => {
      const date = parseDateTimeLocal('2024-06-15T14:30')
      expect(date.getFullYear()).toBe(2024)
      // mois 0-indexé : juin = 5
      expect(date.getMonth()).toBe(5)
      expect(date.getDate()).toBe(15)
      expect(date.getHours()).toBe(14)
      expect(date.getMinutes()).toBe(30)
    })

    it('gère minuit', () => {
      const date = parseDateTimeLocal('2024-01-01T00:00')
      expect(date.getFullYear()).toBe(2024)
      expect(date.getMonth()).toBe(0)
      expect(date.getDate()).toBe(1)
      expect(date.getHours()).toBe(0)
      expect(date.getMinutes()).toBe(0)
    })
  })

  describe('formatDateTimeLocal', () => {
    it('formate une Date locale en chaîne datetime-local', () => {
      const date = new Date(2024, 5, 15, 14, 30)
      expect(formatDateTimeLocal(date)).toBe('2024-06-15T14:30')
    })

    it('pad les valeurs sur 2 chiffres', () => {
      const date = new Date(2024, 0, 5, 9, 7)
      expect(formatDateTimeLocal(date)).toBe('2024-01-05T09:07')
    })

    it("est l'inverse de parseDateTimeLocal (aller-retour)", () => {
      const input = '2024-03-09T08:05'
      expect(formatDateTimeLocal(parseDateTimeLocal(input))).toBe(input)
    })
  })

  describe('addHoursToDateTimeLocal', () => {
    it('ajoute des heures entières', () => {
      expect(addHoursToDateTimeLocal('2024-06-15T14:30', 2)).toBe('2024-06-15T16:30')
    })

    it('ajoute des heures décimales', () => {
      expect(addHoursToDateTimeLocal('2024-06-15T14:30', 1.5)).toBe('2024-06-15T16:00')
    })

    it('gère le passage au jour suivant', () => {
      expect(addHoursToDateTimeLocal('2024-06-15T23:00', 2)).toBe('2024-06-16T01:00')
    })

    it("gère un nombre d'heures négatif", () => {
      expect(addHoursToDateTimeLocal('2024-06-15T01:00', -2)).toBe('2024-06-14T23:00')
    })

    it('gère le passage au mois suivant', () => {
      expect(addHoursToDateTimeLocal('2024-06-30T23:00', 2)).toBe('2024-07-01T01:00')
    })
  })

  describe('formatDurationCompact', () => {
    it("affiche les minutes seules quand moins d'une heure", () => {
      expect(formatDurationCompact(45 * 60 * 1000)).toBe('45min')
    })

    it('affiche les heures seules quand pas de minutes', () => {
      expect(formatDurationCompact(3 * 60 * 60 * 1000)).toBe('3h')
    })

    it('affiche heures et minutes avec padding', () => {
      expect(formatDurationCompact((2 * 60 + 30) * 60 * 1000)).toBe('2h30')
      expect(formatDurationCompact((3 * 60 + 5) * 60 * 1000)).toBe('3h05')
    })

    it('affiche 0min pour une durée nulle', () => {
      expect(formatDurationCompact(0)).toBe('0min')
    })

    it('ignore les secondes résiduelles (arrondi inférieur)', () => {
      // 90 minutes et 59 secondes -> 1h30
      expect(formatDurationCompact((90 * 60 + 59) * 1000)).toBe('1h30')
    })

    it('affiche les minutes pour une durée inférieure à une minute', () => {
      expect(formatDurationCompact(30 * 1000)).toBe('0min')
    })
  })
})
