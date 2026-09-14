import { describe, expect, it } from 'vitest'

import {
  benevolesDesComptes,
  estEquipeVolante,
  estHorsDesComptes,
  estVolant,
} from '../../../shared/utils/benevoles-volants'

/**
 * Les bénévoles volants.
 *
 * Deux notions se ressemblent et ne doivent surtout pas se confondre : ÊTRE volant (appartenir à
 * une équipe volante, ce qui sert à l'affichage) et être HORS DES COMPTES (n'appartenir qu'à des
 * équipes volantes, ce qui dispense d'heures). Les mélanger dispenserait de ses heures quelqu'un
 * qui est aussi en cuisine.
 */
const volante = { isFloatingTeam: true }
const ordinaire = { isFloatingTeam: false }

describe('estEquipeVolante', () => {
  it('reconnaît une équipe volante', () => {
    expect(estEquipeVolante(volante)).toBe(true)
  })

  it('refuse tout ce qui n’est pas un oui franc', () => {
    // Une réponse d'API antérieure à ce réglage ne doit dispenser personne de ses heures.
    expect(estEquipeVolante(ordinaire)).toBe(false)
    expect(estEquipeVolante({})).toBe(false)
    expect(estEquipeVolante({ isFloatingTeam: null })).toBe(false)
    expect(estEquipeVolante(null)).toBe(false)
    expect(estEquipeVolante(undefined)).toBe(false)
  })
})

describe('estVolant', () => {
  it('est vrai dès qu’une équipe est volante', () => {
    expect(estVolant([volante])).toBe(true)
    expect(estVolant([ordinaire, volante])).toBe(true)
  })

  it('est faux sans aucune équipe volante', () => {
    expect(estVolant([ordinaire])).toBe(false)
    expect(estVolant([])).toBe(false)
    expect(estVolant(null)).toBe(false)
    expect(estVolant(undefined)).toBe(false)
  })
})

describe('estHorsDesComptes', () => {
  it('dispense celui qui n’est QUE volant', () => {
    expect(estHorsDesComptes([volante])).toBe(true)
    expect(estHorsDesComptes([volante, { isFloatingTeam: true }])).toBe(true)
  })

  it('ne dispense PAS celui qui a aussi une équipe ordinaire', () => {
    // Le point le plus important du fichier. Quelqu'un qui est à la fois en cuisine et volant
    // reste un bénévole ordinaire : l'assignation automatique doit lui donner ses heures de
    // cuisine. C'est n'être QUE volant qui exempte.
    expect(estHorsDesComptes([ordinaire, volante])).toBe(false)
    expect(estHorsDesComptes([volante, ordinaire])).toBe(false)
  })

  it('ne dispense pas un bénévole SANS équipe', () => {
    // Et ce n'est pas une précaution : c'est le cas le plus courant, celui d'un accepté pas
    // encore placé — précisément celui que l'assignation automatique doit traiter. Le dispenser
    // viderait l'assignation automatique de son objet.
    expect(estHorsDesComptes([])).toBe(false)
    expect(estHorsDesComptes(null)).toBe(false)
    expect(estHorsDesComptes(undefined)).toBe(false)
  })

  it('ne dispense pas sur une équipe au réglage manquant', () => {
    expect(estHorsDesComptes([{}])).toBe(false)
    expect(estHorsDesComptes([volante, {}])).toBe(false)
  })
})

describe('benevolesDesComptes', () => {
  it('écarte ceux qui ne sont que volants', () => {
    const benevoles = [
      { id: 1, equipes: [volante] },
      { id: 2, equipes: [ordinaire] },
      { id: 3, equipes: [volante, ordinaire] },
      { id: 4, equipes: [] },
    ]

    expect(benevolesDesComptes(benevoles).map((b) => b.id)).toEqual([2, 3, 4])
  })

  it('garde tout le monde quand aucune équipe n’est volante', () => {
    const benevoles = [{ equipes: [ordinaire] }, { equipes: [] }]

    expect(benevolesDesComptes(benevoles)).toHaveLength(2)
  })

  it('survit à un bénévole sans champ d’équipes', () => {
    expect(benevolesDesComptes([{} as { equipes?: never }])).toHaveLength(1)
  })

  it('rend une liste vide sans se plaindre', () => {
    expect(benevolesDesComptes([])).toEqual([])
  })
})
