import { describe, expect, it } from 'vitest'

import { dureeEnMinutes, manquesPourWorkshop } from '../../../shared/utils/program-conversion'

describe('dureeEnMinutes', () => {
  it('calcule la durée entre deux instants', () => {
    expect(dureeEnMinutes('2026-10-02T18:00:00Z', '2026-10-02T19:30:00Z')).toBe(90)
  })

  // Un spectacle sans durée est permis ; une durée inventée s'afficherait comme un fait.
  it('rend null sans heure de fin', () => {
    expect(dureeEnMinutes('2026-10-02T18:00:00Z', null)).toBeNull()
    expect(dureeEnMinutes('2026-10-02T18:00:00Z', undefined)).toBeNull()
  })

  it('rend null pour un créneau incohérent', () => {
    expect(dureeEnMinutes('2026-10-02T18:00:00Z', '2026-10-02T17:00:00Z')).toBeNull()
    expect(dureeEnMinutes('2026-10-02T18:00:00Z', '2026-10-02T18:00:00Z')).toBeNull()
  })

  it('rend null sur une date illisible', () => {
    expect(dureeEnMinutes('hier', '2026-10-02T19:00:00Z')).toBeNull()
  })

  // Une jam de 23 h à 1 h dure bien deux heures, pas moins vingt-deux.
  it('traverse minuit correctement', () => {
    expect(dureeEnMinutes('2026-10-02T23:00:00Z', '2026-10-03T01:00:00Z')).toBe(120)
  })

  it('accepte des dates déjà typées', () => {
    expect(dureeEnMinutes(new Date('2026-10-02T10:00:00Z'), new Date('2026-10-02T10:45:00Z'))).toBe(
      45
    )
  })
})

describe('manquesPourWorkshop', () => {
  it('signale une heure de fin manquante', () => {
    expect(manquesPourWorkshop({ endDateTime: null }).finRequise).toBe(true)
    expect(manquesPourWorkshop({ endDateTime: '2026-10-02T19:00:00Z' }).finRequise).toBe(false)
  })

  /**
   * Le piège qu'il faut annoncer : un workshop n'a pas d'état de publication. Convertir un
   * brouillon le rend public sur-le-champ, et l'élément d'origine aura disparu.
   */
  it('signale qu’un brouillon deviendra public', () => {
    expect(manquesPourWorkshop({ isPublic: false }).publicationImmediate).toBe(true)
    expect(manquesPourWorkshop({ isPublic: true }).publicationImmediate).toBe(false)
  })
})
