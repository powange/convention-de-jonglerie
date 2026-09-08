import { describe, expect, it } from 'vitest'

import { positionInitialeDuPlanning } from '../../../../../layers/volunteers/app/utils/position-initiale-planning'

/**
 * La frise s'ouvrait sur le premier jour du montage, souvent vide : sur une période de dix jours
 * dont les créneaux ne commencent qu'au sixième, il fallait faire défiler à la main pour
 * retrouver son planning.
 *
 * Les dates sont écrites en heure locale, sans `Z` : la position se mesure depuis minuit du
 * premier jour de la vue, lui aussi local, et les tests resteraient sinon suspendus au fuseau de
 * la machine qui les exécute.
 */
describe('positionInitialeDuPlanning', () => {
  it('vise le premier créneau, le même jour', () => {
    const position = positionInitialeDuPlanning('2026-10-02', [
      { start: '2026-10-02T14:30:00' },
      { start: '2026-10-02T18:00:00' },
    ])

    expect(position).toBe('14:30:00')
  })

  it('compte les jours en heures, au-delà de vingt-quatre', () => {
    // `scrollTime` est une durée depuis le début de la vue, pas une heure de la journée : un
    // créneau au sixième jour se vise à 120 h et quelques.
    const position = positionInitialeDuPlanning('2026-10-02', [{ start: '2026-10-07T09:00:00' }])

    expect(position).toBe('129:00:00')
  })

  it('retient le plus précoce, quel que soit l’ordre de la liste', () => {
    const position = positionInitialeDuPlanning('2026-10-02', [
      { start: '2026-10-04T08:00:00' },
      { start: '2026-10-02T20:00:00' },
      { start: '2026-10-03T09:00:00' },
    ])

    expect(position).toBe('20:00:00')
  })

  it('tient compte du retard appliqué au créneau', () => {
    // La frise doit viser l'heure réellement affichée, retard compris.
    const position = positionInitialeDuPlanning('2026-10-02', [
      { start: '2026-10-02T10:00:00', delayMinutes: 45 },
    ])

    expect(position).toBe('10:45:00')
  })

  it('ne bouge pas quand il n’y a aucun créneau', () => {
    // Le comportement d'origine : on reste sur le premier jour du montage ou de l'édition.
    expect(positionInitialeDuPlanning('2026-10-02', [])).toBeNull()
  })

  it('ne bouge pas sans date de début exploitable', () => {
    expect(positionInitialeDuPlanning(undefined, [{ start: '2026-10-02T10:00:00' }])).toBeNull()
    expect(positionInitialeDuPlanning('', [{ start: '2026-10-02T10:00:00' }])).toBeNull()
  })

  it('ignore un créneau antérieur au début de la vue', () => {
    // Un défilement négatif n'a pas de sens, et `scrollTime` ne recule pas avant l'origine.
    expect(positionInitialeDuPlanning('2026-10-02', [{ start: '2026-10-01T10:00:00' }])).toBeNull()
  })

  it('écarte les dates illisibles plutôt que de rendre une position absurde', () => {
    const position = positionInitialeDuPlanning('2026-10-02', [
      { start: 'pas une date' },
      { start: '2026-10-03T07:15:00' },
    ])

    expect(position).toBe('31:15:00')
  })
})
