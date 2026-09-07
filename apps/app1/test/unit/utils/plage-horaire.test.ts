import { describe, it, expect } from 'vitest'

import {
  decomposerDuree,
  dureeTraduisible,
  formatHeure,
  formatPlage,
} from '../../../../../layers/volunteers/app/utils/plage-horaire'

/**
 * L'infobulle du planning annonce « 15h - 16h (1h) ». Le calcul de durée existait déjà à
 * l'identique dans deux modales ; ces fonctions le disent une fois pour les trois.
 */

const le = (heure: string) => `2026-10-02T${heure}:00`

describe('decomposerDuree', () => {
  it("décompose une durée d'une heure pile", () => {
    expect(decomposerDuree(le('15:00'), le('16:00'))).toEqual({ heures: 1, minutes: 0 })
  })

  it('décompose heures et minutes', () => {
    expect(decomposerDuree(le('15:00'), le('16:30'))).toEqual({ heures: 1, minutes: 30 })
  })

  it('décompose une durée de moins d’une heure', () => {
    expect(decomposerDuree(le('15:00'), le('15:45'))).toEqual({ heures: 0, minutes: 45 })
  })

  it('rend null sans bornes', () => {
    expect(decomposerDuree(null, le('16:00'))).toBeNull()
    expect(decomposerDuree(le('15:00'), undefined)).toBeNull()
  })

  it('rend null si la fin précède le début', () => {
    // Une durée négative n'a rien à annoncer : mieux vaut ne rien afficher qu'un « -1h ».
    expect(decomposerDuree(le('16:00'), le('15:00'))).toBeNull()
  })

  it('rend null sur une date illisible', () => {
    expect(decomposerDuree('pas une date', le('16:00'))).toBeNull()
  })
})

describe('dureeTraduisible', () => {
  it('choisit la clé « heures et minutes »', () => {
    expect(dureeTraduisible(le('15:00'), le('16:30'))).toEqual({
      cle: 'volunteers.duration_hours_minutes',
      valeurs: { hours: 1, minutes: 30 },
    })
  })

  it('choisit la clé « heures » quand les minutes sont nulles', () => {
    // Sans cette branche, on afficherait « 1h0 ».
    expect(dureeTraduisible(le('15:00'), le('17:00'))).toEqual({
      cle: 'volunteers.duration_hours',
      valeurs: { hours: 2 },
    })
  })

  it('choisit la clé « minutes » sous l’heure', () => {
    expect(dureeTraduisible(le('15:00'), le('15:15'))).toEqual({
      cle: 'volunteers.duration_minutes',
      valeurs: { minutes: 15 },
    })
  })

  it('rend null quand la durée ne se calcule pas', () => {
    expect(dureeTraduisible(null, null)).toBeNull()
  })
})

describe('formatHeure', () => {
  it("omet les minutes quand il n'y en a pas", () => {
    expect(formatHeure(le('15:00'))).toBe('15h')
  })

  it('affiche les minutes sur deux chiffres', () => {
    // « 15h5 » se lirait mal ; c'est « 15h05 ».
    expect(formatHeure(le('15:05'))).toBe('15h05')
  })

  it('affiche les minutes ordinaires', () => {
    expect(formatHeure(le('15:30'))).toBe('15h30')
  })

  it('rend une chaîne vide sans date', () => {
    expect(formatHeure(null)).toBe('')
    expect(formatHeure('pas une date')).toBe('')
  })
})

describe('formatPlage', () => {
  it('joint les deux bornes', () => {
    expect(formatPlage(le('15:00'), le('16:30'))).toBe('15h - 16h30')
  })

  it('se contente de la borne disponible', () => {
    // Un créneau sans fin reste lisible plutôt que d'afficher un tiret orphelin.
    expect(formatPlage(le('15:00'), null)).toBe('15h')
    expect(formatPlage(null, le('16:00'))).toBe('16h')
  })

  it('rend une chaîne vide sans aucune borne', () => {
    expect(formatPlage(null, null)).toBe('')
  })
})
