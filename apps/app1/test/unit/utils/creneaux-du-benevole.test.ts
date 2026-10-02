import { describe, expect, it } from 'vitest'

import { creneauxDuBenevole } from '../../../../../layers/volunteers/app/utils/creneaux-du-benevole'

/**
 * Un total d'heures ne dit rien de l'enchaînement : vingt minutes entre deux postes, ou une
 * journée coupée en trois, s'y confondent avec une répartition confortable. C'est ce que ce
 * relevé rend visible.
 */
const creneau = (
  id: string,
  startDateTime: string,
  endDateTime: string,
  benevoles: number[] = [],
  organisateurs: number[] = []
) => ({
  id,
  startDateTime,
  endDateTime,
  assignedVolunteersList: benevoles.map((userId) => ({ user: { id: userId } })),
  assignedOrganizersList: organisateurs.map((userId) => ({ user: { id: userId } })),
})

/**
 * Le créneau tel que l'API le rend, sans le renommage que fait le planning de gestion.
 *
 * ⚠️ C'EST LE DÉFAUT QUE LES DEUX CAS CI-DESSOUS ÉPROUVENT.
 * `/api/editions/:id/volunteer-time-slots` rend `assignments` et `organizerAssignments` ; seul
 * `planning.vue` les recopie sous `assignedVolunteersList` / `assignedOrganizersList`. La page
 * PUBLIQUE des bénévoles passait la réponse brute à la modale « créneaux du bénévole », qui
 * n'affichait donc JAMAIS rien — pour personne, et sans erreur. Les dix cas qui existaient ici ne
 * pouvaient pas le voir : leur fabrique ne connaissait que la forme renommée.
 */
const creneauDeLApi = (
  id: string,
  startDateTime: string,
  endDateTime: string,
  benevoles: number[] = [],
  organisateurs: number[] = []
) => ({
  id,
  startDateTime,
  endDateTime,
  assignments: benevoles.map((userId) => ({ user: { id: userId } })),
  organizerAssignments: organisateurs.map((userId) => ({ user: { id: userId } })),
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

  it("retient les créneaux rendus sous la forme de l'API", () => {
    const creneaux = [
      creneauDeLApi('a', '2026-10-02T09:00:00Z', '2026-10-02T11:00:00Z', [ALICE]),
      creneauDeLApi('b', '2026-10-02T14:00:00Z', '2026-10-02T16:00:00Z', [2]),
      creneauDeLApi('c', '2026-10-02T18:00:00Z', '2026-10-02T20:00:00Z', [], [ORGA]),
    ]

    expect(creneauxDuBenevole(creneaux, ALICE).map((l) => l.creneau.id)).toEqual(['a'])
    expect(creneauxDuBenevole(creneaux, ORGA).map((l) => l.creneau.id)).toEqual(['c'])
  })

  it('accepte les deux formes dans une même liste, sans compter deux fois', () => {
    // Un écran peut mêler les deux : la réponse de l'API et un créneau qu'il a lui-même recopié.
    const creneaux = [
      creneauDeLApi('a', '2026-10-02T09:00:00Z', '2026-10-02T11:00:00Z', [ALICE]),
      creneau('b', '2026-10-02T14:00:00Z', '2026-10-02T16:00:00Z', [ALICE]),
      {
        ...creneauDeLApi('c', '2026-10-02T18:00:00Z', '2026-10-02T20:00:00Z', [ALICE]),
        assignedVolunteersList: [{ user: { id: ALICE } }],
      },
    ]

    expect(creneauxDuBenevole(creneaux, ALICE).map((l) => l.creneau.id)).toEqual(['a', 'b', 'c'])
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
