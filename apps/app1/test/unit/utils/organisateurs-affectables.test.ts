import { describe, it, expect } from 'vitest'

import { organisateursAffectables } from '../../../../../layers/volunteers/app/utils/organisateurs-affectables'

/**
 * Un créneau porté par une équipe ne doit proposer que les organisateurs rattachés à cette
 * équipe. Proposer toute l'organisation donnait une liste où l'équipe du créneau ne voulait
 * plus rien dire — et rien à l'écran ne distinguait les deux.
 */

const CANDIDATS = [
  { editionOrganizerId: 1, teamIds: ['accueil'] },
  { editionOrganizerId: 2, teamIds: ['bar', 'accueil'] },
  { editionOrganizerId: 3, teamIds: ['cuisine'] },
  { editionOrganizerId: 4, teamIds: [] },
]

const ids = (resultat: Array<{ editionOrganizerId: number }>) =>
  resultat.map((organisateur) => organisateur.editionOrganizerId)

describe('organisateursAffectables', () => {
  it("ne propose que les organisateurs de l'équipe du créneau", () => {
    expect(ids(organisateursAffectables(CANDIDATS, [], 'accueil'))).toEqual([1, 2])
  })

  it("écarte les organisateurs d'une autre équipe", () => {
    expect(ids(organisateursAffectables(CANDIDATS, [], 'cuisine'))).toEqual([3])
  })

  it("écarte celui qui n'a aucune équipe", () => {
    // Le rattachement devient le préalable : sans équipe, on n'apparaît que sur les créneaux
    // qui n'en ont pas non plus.
    expect(ids(organisateursAffectables(CANDIDATS, [], 'accueil'))).not.toContain(4)
  })

  it('propose tout le monde sur un créneau sans équipe', () => {
    expect(ids(organisateursAffectables(CANDIDATS, [], null))).toEqual([1, 2, 3, 4])
    expect(ids(organisateursAffectables(CANDIDATS, [], undefined))).toEqual([1, 2, 3, 4])
  })

  it("traite « unassigned » comme une absence d'équipe", () => {
    // C'est la valeur que le planning donne aux créneaux sans équipe, et le filtre des
    // bénévoles la traite déjà ainsi.
    expect(ids(organisateursAffectables(CANDIDATS, [], 'unassigned'))).toEqual([1, 2, 3, 4])
  })

  it('retire ceux déjà affectés au créneau', () => {
    const affectes = [{ editionOrganizerId: 1 }]
    expect(ids(organisateursAffectables(CANDIDATS, affectes, 'accueil'))).toEqual([2])
  })

  it('retire les déjà affectés même sans équipe sur le créneau', () => {
    const affectes = [{ editionOrganizerId: 2 }, { editionOrganizerId: 4 }]
    expect(ids(organisateursAffectables(CANDIDATS, affectes, null))).toEqual([1, 3])
  })

  it('rend une liste vide sans candidat', () => {
    expect(organisateursAffectables([], [], 'accueil')).toEqual([])
  })
})
