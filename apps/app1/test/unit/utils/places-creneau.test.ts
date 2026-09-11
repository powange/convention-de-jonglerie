import { describe, expect, it } from 'vitest'

import {
  placesOccupees,
  placesRestantes,
  resteUnePlace,
  type OccupationCreneau,
} from '../../../../../layers/volunteers/server/utils/places-creneau'

/**
 * Le calcul était juste mais écrit deux fois, et surtout relevé loin de l'écriture qu'il autorise.
 * Le sortir ici sert d'abord à ce que les deux endpoints d'affectation — bénévoles et
 * organisateurs — comptent pareil : ils se partagent le même plafond, et n'en corriger qu'un
 * laisserait la course ouverte entre les deux.
 */
const creneau = (
  assignments: number,
  organizerAssignments: number,
  maxVolunteers = 2
): OccupationCreneau => ({
  maxVolunteers,
  _count: { assignments, organizerAssignments },
})

describe('placesOccupees', () => {
  it('compte les organisateurs avec les bénévoles', () => {
    // Un organisateur occupe une place comme un autre : décision prise, et écrite dans le schéma.
    expect(placesOccupees(creneau(1, 2))).toBe(3)
  })

  it('rend zéro sur un créneau vide', () => {
    expect(placesOccupees(creneau(0, 0))).toBe(0)
  })
})

describe('resteUnePlace', () => {
  it('accepte tant qu’il reste de la place', () => {
    expect(resteUnePlace(creneau(0, 0, 2))).toBe(true)
    expect(resteUnePlace(creneau(1, 0, 2))).toBe(true)
  })

  it('refuse un créneau exactement plein', () => {
    // `>=` et non `>` : c'est la comparaison qu'un correctif pressé inverse le plus souvent.
    expect(resteUnePlace(creneau(2, 0, 2))).toBe(false)
    expect(resteUnePlace(creneau(0, 2, 2))).toBe(false)
    expect(resteUnePlace(creneau(1, 1, 2))).toBe(false)
  })

  it('refuse un créneau déjà en dépassement', () => {
    // Les données existantes en contiennent : le plafond a pu être abaissé après coup.
    expect(resteUnePlace(creneau(3, 1, 2))).toBe(false)
  })

  it('refuse un créneau sans aucune place', () => {
    expect(resteUnePlace(creneau(0, 0, 0))).toBe(false)
  })

  it('refuse dès qu’un organisateur prend la dernière place', () => {
    // Le cas qui motive le comptage commun : sans lui, ce créneau paraîtrait encore libre.
    expect(resteUnePlace(creneau(1, 0, 2))).toBe(true)
    expect(resteUnePlace(creneau(1, 1, 2))).toBe(false)
  })
})

describe('placesRestantes', () => {
  it('dit combien il en reste', () => {
    expect(placesRestantes(creneau(1, 0, 4))).toBe(3)
    expect(placesRestantes(creneau(1, 2, 4))).toBe(1)
  })

  it('ne descend jamais sous zéro', () => {
    // Un créneau en dépassement offre zéro place, pas un nombre négatif : ce compte est destiné
    // à être affiché, et « −2 places restantes » ne veut rien dire.
    expect(placesRestantes(creneau(5, 0, 2))).toBe(0)
  })

  it('s’accorde avec resteUnePlace', () => {
    for (const benevoles of [0, 1, 2, 3]) {
      for (const organisateurs of [0, 1, 2]) {
        const c = creneau(benevoles, organisateurs, 3)

        expect(placesRestantes(c) > 0).toBe(resteUnePlace(c))
      }
    }
  })
})
