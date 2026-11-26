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
      { startDateTime: '2026-10-02T14:30:00' },
      { startDateTime: '2026-10-02T18:00:00' },
    ])

    expect(position).toBe('14:30:00')
  })

  it('compte les jours en heures, au-delà de vingt-quatre', () => {
    // `scrollTime` est une durée depuis le début de la vue, pas une heure de la journée : un
    // créneau au sixième jour se vise à 120 h et quelques.
    const position = positionInitialeDuPlanning('2026-10-02', [
      { startDateTime: '2026-10-07T09:00:00' },
    ])

    expect(position).toBe('129:00:00')
  })

  it('retient le plus précoce, quel que soit l’ordre de la liste', () => {
    const position = positionInitialeDuPlanning('2026-10-02', [
      { startDateTime: '2026-10-04T08:00:00' },
      { startDateTime: '2026-10-02T20:00:00' },
      { startDateTime: '2026-10-03T09:00:00' },
    ])

    expect(position).toBe('20:00:00')
  })

  it('tient compte du retard appliqué au créneau', () => {
    // La frise doit viser l'heure réellement affichée, retard compris.
    const position = positionInitialeDuPlanning('2026-10-02', [
      { startDateTime: '2026-10-02T10:00:00', delayMinutes: 45 },
    ])

    expect(position).toBe('10:45:00')
  })

  it('ne bouge pas quand il n’y a aucun créneau', () => {
    // Le comportement d'origine : on reste sur le premier jour du montage ou de l'édition.
    expect(positionInitialeDuPlanning('2026-10-02', [])).toBeNull()
  })

  it('ne bouge pas sans date de début exploitable', () => {
    expect(
      positionInitialeDuPlanning(undefined, [{ startDateTime: '2026-10-02T10:00:00' }])
    ).toBeNull()
    expect(positionInitialeDuPlanning('', [{ startDateTime: '2026-10-02T10:00:00' }])).toBeNull()
  })

  it('ignore un créneau antérieur au début de la vue', () => {
    // Un défilement négatif n'a pas de sens, et `scrollTime` ne recule pas avant l'origine.
    expect(
      positionInitialeDuPlanning('2026-10-02', [{ startDateTime: '2026-10-01T10:00:00' }])
    ).toBeNull()
  })

  it('écarte les dates illisibles plutôt que de rendre une position absurde', () => {
    const position = positionInitialeDuPlanning('2026-10-02', [
      { startDateTime: 'pas une date' },
      { startDateTime: '2026-10-03T07:15:00' },
    ])

    expect(position).toBe('31:15:00')
  })

  /*
   * Sous Flowvent, l'édition arrive sous forme complète. Y accoler « T00:00:00 » rendait une date
   * invalide : la frise ne se posait jamais sur le premier créneau.
   */
  it('accepte une date de début complète, et n’en garde que le jour', () => {
    const position = positionInitialeDuPlanning('2026-10-02T00:00:00.000Z', [
      { startDateTime: '2026-10-03T07:15:00' },
    ])

    expect(position).toBe('31:15:00')
  })

  /*
   * Le calendrier affiche ses journées à l'heure du LIEU : la frise vise l'heure murale du
   * créneau là-bas, quel que soit le fuseau de la machine qui regarde.
   */
  it('vise l’heure du lieu quand l’édition déclare un fuseau', () => {
    // 08:00 UTC = 10:00 à Paris en octobre (heure d'été) ; 16:00 UTC = 01:00 le lendemain à Tokyo.
    expect(
      positionInitialeDuPlanning(
        '2026-10-02',
        [{ startDateTime: '2026-10-02T08:00:00Z' }],
        'Europe/Paris'
      )
    ).toBe('10:00:00')
    expect(
      positionInitialeDuPlanning(
        '2026-10-02',
        [{ startDateTime: '2026-10-02T16:00:00Z' }],
        'Asia/Tokyo'
      )
    ).toBe('25:00:00')
  })
})
