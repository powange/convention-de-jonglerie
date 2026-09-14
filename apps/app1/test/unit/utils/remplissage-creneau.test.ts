import { describe, expect, it } from 'vitest'

import {
  creneauAPourvoir,
  placesOccupees,
} from '../../../../../layers/volunteers/app/utils/remplissage-creneau'

/**
 * Le repère visuel des créneaux qu'il reste à pourvoir.
 *
 * Ce qui se joue ici n'est pas l'apparence mais le COMPTE : un créneau signalé à tort envoie
 * chercher du monde là où il n'en manque pas, et un créneau oublié laisse un trou dans le
 * planning le jour J.
 */
const creneau = (surcharge: Record<string, unknown> = {}) => ({
  maxVolunteers: 3,
  assignedVolunteers: 1,
  assignedOrganizersList: [],
  ...surcharge,
})

describe('placesOccupees', () => {
  it('additionne les bénévoles et les organisateurs', () => {
    // Un organisateur occupe une place : l'oublier ferait paraître libre un créneau complet.
    expect(placesOccupees(creneau({ assignedVolunteers: 2, assignedOrganizersList: [{}] }))).toBe(3)
  })

  it('survit à un créneau sans aucune affectation', () => {
    expect(placesOccupees({})).toBe(0)
  })
})

describe('creneauAPourvoir', () => {
  it('signale un créneau dont la jauge n’est pas atteinte', () => {
    expect(creneauAPourvoir(creneau({ assignedVolunteers: 1 }))).toBe(true)
  })

  it('ne signale RIEN quand les organisateurs complètent la jauge', () => {
    // Le cas qui distingue cette règle d'un simple `assignedVolunteers < max` : deux bénévoles et
    // un organisateur remplissent un créneau de trois.
    expect(
      creneauAPourvoir(creneau({ assignedVolunteers: 2, assignedOrganizersList: [{ id: 1 }] }))
    ).toBe(false)
  })

  it('ne signale pas un créneau exactement complet', () => {
    expect(creneauAPourvoir(creneau({ assignedVolunteers: 3 }))).toBe(false)
  })

  it('ne signale pas un créneau en dépassement', () => {
    // Il y a un problème, mais ce n'est pas « il manque du monde ».
    expect(creneauAPourvoir(creneau({ assignedVolunteers: 5 }))).toBe(false)
  })

  it('ne signale pas un créneau sans jauge', () => {
    // Sans maximum, il n'y a pas d'objectif à atteindre : tout marquer serait du bruit.
    expect(creneauAPourvoir(creneau({ maxVolunteers: null }))).toBe(false)
    expect(creneauAPourvoir(creneau({ maxVolunteers: 0 }))).toBe(false)
  })

  it('ne signale pas un créneau d’équipe volante ou autonome', () => {
    // Ces créneaux sont délibérément hors des heures à pourvoir : personne d'autre ne viendra les
    // couvrir. Les marquer ferait paraître l'édition sous-dotée alors qu'il ne manque rien —
    // exactement ce que les statistiques évitent déjà.
    expect(creneauAPourvoir(creneau({ assignedVolunteers: 0 }), true)).toBe(false)
  })

  it('signale bien ce même créneau si l’équipe n’est PAS hors charge', () => {
    // Le contrôle du test précédent : sans ce cas, il resterait vert même si le drapeau était
    // ignoré, puisqu'il ne vérifie qu'une absence.
    expect(creneauAPourvoir(creneau({ assignedVolunteers: 0 }), false)).toBe(true)
  })

  it('signale un créneau totalement vide', () => {
    expect(creneauAPourvoir({ maxVolunteers: 2 })).toBe(true)
  })
})
