import { describe, it, expect } from 'vitest'

import { estPresentPendant, fenetreDe } from '../../../shared/utils/presence-benevole'

const creneau = (heureDebut: number, heureFin: number) => ({
  debut: Date.UTC(2026, 7, 1, heureDebut),
  fin: Date.UTC(2026, 7, 1, heureFin),
})

describe('fenêtre de présence d’un bénévole', () => {
  it('ne s’oppose à rien quand rien n’est déclaré', () => {
    const fenetre = fenetreDe({})

    expect(fenetre).toEqual({ arrivee: null, depart: null })
    expect(estPresentPendant(fenetre, creneau(9, 12))).toBe(true)
  })

  it('refuse un créneau antérieur à l’arrivée', () => {
    const fenetre = fenetreDe({ arrivalDateTime: '2026-08-01_noon' })

    expect(estPresentPendant(fenetre, creneau(9, 11))).toBe(false)
  })

  it('accepte un créneau qui commence pile à l’arrivée', () => {
    const fenetre = fenetreDe({ arrivalDateTime: '2026-08-01_noon' })

    expect(estPresentPendant(fenetre, creneau(12, 14))).toBe(true)
  })

  it('refuse un créneau qui déborde après le départ', () => {
    // C'est le cœur de la règle : la question porte sur le créneau ENTIER, pas sur son début.
    // Quelqu'un qui repart à midi ne tient pas un créneau de 10 h à 14 h.
    const fenetre = fenetreDe({ departureDateTime: '2026-08-01_morning' })

    expect(estPresentPendant(fenetre, creneau(10, 14))).toBe(false)
  })

  it('accepte un créneau qui s’achève pile au départ', () => {
    const fenetre = fenetreDe({ departureDateTime: '2026-08-01_morning' })

    expect(estPresentPendant(fenetre, creneau(9, 12))).toBe(true)
  })

  it('tient compte des deux bornes à la fois', () => {
    const fenetre = fenetreDe({
      arrivalDateTime: '2026-08-01_morning',
      departureDateTime: '2026-08-01_evening',
    })

    expect(estPresentPendant(fenetre, creneau(9, 20))).toBe(true)
    expect(estPresentPendant(fenetre, creneau(6, 9))).toBe(false)
  })

  it('ouvre la journée en grand quand le moment est inconnu', () => {
    // Une donnée qu'on ne comprend pas ne doit pas fonder un refus : c'est la même prudence que
    // celle du module repas, qui rend tous les repas quand il ne sait pas.
    const fenetre = fenetreDe({
      arrivalDateTime: '2026-08-01_nimportequoi',
      departureDateTime: '2026-08-01',
    })

    expect(estPresentPendant(fenetre, creneau(0, 24))).toBe(true)
  })

  it('ignore une date illisible plutôt que de tout refuser', () => {
    const fenetre = fenetreDe({ arrivalDateTime: 'pas-une-date_morning' })

    expect(fenetre.arrivee).toBeNull()
    expect(estPresentPendant(fenetre, creneau(9, 12))).toBe(true)
  })

  it('laisse passer un créneau aux bornes illisibles', () => {
    const fenetre = fenetreDe({ arrivalDateTime: '2026-08-02_morning' })

    expect(estPresentPendant(fenetre, { debut: NaN, fin: NaN })).toBe(true)
  })
})
