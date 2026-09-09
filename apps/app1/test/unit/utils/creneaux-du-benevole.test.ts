import { describe, expect, it } from 'vitest'

import { creneauxDuBenevole } from '../../../../../layers/volunteers/app/utils/creneaux-du-benevole'

/**
 * Un total d'heures ne dit rien de l'enchaînement : vingt minutes entre deux postes, ou une
 * journée coupée en trois, s'y confondent avec une répartition confortable. C'est ce que ce
 * relevé rend visible.
 */
const creneau = (
  id: string,
  start: string,
  end: string,
  benevoles: number[] = [],
  organisateurs: number[] = []
) => ({
  id,
  start,
  end,
  assignedVolunteersList: benevoles.map((userId) => ({ user: { id: userId } })),
  assignedOrganizersList: organisateurs.map((userId) => ({ user: { id: userId } })),
})

const ALICE = 1
const ORGA = 50

describe('creneauxDuBenevole', () => {
  it('ne retient que les créneaux de la personne', () => {
    const creneaux = [
      creneau('a', '2026-10-02T09:00:00Z', '2026-10-02T11:00:00Z', [ALICE]),
      creneau('b', '2026-10-02T14:00:00Z', '2026-10-02T16:00:00Z', [2]),
    ]

    expect(creneauxDuBenevole(creneaux, ALICE).map((l) => l.creneau.id)).toEqual(['a'])
  })

  it('compte les affectations d’organisateur comme les autres', () => {
    // Ils tiennent des créneaux : leur enchaînement se surveille pareillement.
    const creneaux = [creneau('a', '2026-10-02T09:00:00Z', '2026-10-02T11:00:00Z', [], [ORGA])]

    expect(creneauxDuBenevole(creneaux, ORGA)).toHaveLength(1)
  })

  it('range les créneaux du plus tôt au plus tard', () => {
    // La liste vient du planning : rien ne garantit qu'un créneau ajouté après coup s'y range.
    const creneaux = [
      creneau('tard', '2026-10-02T14:00:00Z', '2026-10-02T16:00:00Z', [ALICE]),
      creneau('tot', '2026-10-02T09:00:00Z', '2026-10-02T11:00:00Z', [ALICE]),
    ]

    expect(creneauxDuBenevole(creneaux, ALICE).map((l) => l.creneau.id)).toEqual(['tot', 'tard'])
  })

  it('ne donne pas d’intervalle au premier créneau', () => {
    const creneaux = [creneau('a', '2026-10-02T09:00:00Z', '2026-10-02T11:00:00Z', [ALICE])]

    expect(creneauxDuBenevole(creneaux, ALICE)[0]?.intervalleMinutes).toBeNull()
  })

  it('mesure la pause entre deux créneaux', () => {
    const creneaux = [
      creneau('a', '2026-10-02T09:00:00Z', '2026-10-02T11:00:00Z', [ALICE]),
      creneau('b', '2026-10-02T14:30:00Z', '2026-10-02T16:00:00Z', [ALICE]),
    ]

    expect(creneauxDuBenevole(creneaux, ALICE)[1]?.intervalleMinutes).toBe(210)
  })

  it('compte la nuit comme un repos ordinaire, simplement plus long', () => {
    const creneaux = [
      creneau('a', '2026-10-02T16:00:00Z', '2026-10-02T18:00:00Z', [ALICE]),
      creneau('b', '2026-10-03T09:00:00Z', '2026-10-03T11:00:00Z', [ALICE]),
    ]

    expect(creneauxDuBenevole(creneaux, ALICE)[1]?.intervalleMinutes).toBe(15 * 60)
  })

  it('rend zéro pour un enchaînement direct', () => {
    const creneaux = [
      creneau('a', '2026-10-02T09:00:00Z', '2026-10-02T11:00:00Z', [ALICE]),
      creneau('b', '2026-10-02T11:00:00Z', '2026-10-02T13:00:00Z', [ALICE]),
    ]

    expect(creneauxDuBenevole(creneaux, ALICE)[1]?.intervalleMinutes).toBe(0)
  })

  it('rend un intervalle négatif en cas de chevauchement', () => {
    // La personne est attendue à deux endroits à la fois : l'écran doit pouvoir le signaler,
    // et non le confondre avec un enchaînement serré.
    const creneaux = [
      creneau('a', '2026-10-02T09:00:00Z', '2026-10-02T11:00:00Z', [ALICE]),
      creneau('b', '2026-10-02T10:30:00Z', '2026-10-02T12:00:00Z', [ALICE]),
    ]

    expect(creneauxDuBenevole(creneaux, ALICE)[1]?.intervalleMinutes).toBe(-30)
  })

  it('écarte un créneau dont la date est illisible', () => {
    const creneaux = [
      creneau('cassé', 'pas une date', 'pas une date non plus', [ALICE]),
      creneau('a', '2026-10-02T09:00:00Z', '2026-10-02T11:00:00Z', [ALICE]),
    ]

    expect(creneauxDuBenevole(creneaux, ALICE).map((l) => l.creneau.id)).toEqual(['a'])
  })

  it('rend une liste vide pour quelqu’un sans créneau', () => {
    expect(creneauxDuBenevole([], ALICE)).toEqual([])
  })
})
