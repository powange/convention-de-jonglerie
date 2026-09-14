import { describe, expect, it } from 'vitest'

import { affectationsEchangeables } from '../../../../../layers/volunteers/server/utils/echange-creneaux'

/**
 * Les créneaux tenus par un bénévole VOLANT ne se proposent pas à l'échange.
 *
 * C'est le second sens de la transparence : le volant ne propose pas ses renforts, et personne ne
 * les lui demande. Le filtre est nécessaire parce que la recherche des candidats porte sur
 * l'équipe du CRÉNEAU, pas sur celles de son titulaire — un volant posé en cuisine y ressort donc
 * naturellement.
 */
const volante = { isFloatingTeam: true }
const ordinaire = { isFloatingTeam: false }

const equipes = (paires: Array<[number, { isFloatingTeam: boolean }[]]>) => new Map(paires)

describe('affectationsEchangeables', () => {
  it('retire les affectations d’un volant', () => {
    const gardees = affectationsEchangeables(
      [{ userId: 20 }, { userId: 21 }],
      equipes([
        [20, [volante]],
        [21, [ordinaire]],
      ])
    )

    expect(gardees.map((a) => a.userId)).toEqual([21])
  })

  it('garde celui qui est volant ET dans une équipe ordinaire', () => {
    // Il doit ses heures de cuisine : il a bien une charge à céder.
    const gardees = affectationsEchangeables(
      [{ userId: 20 }],
      equipes([[20, [volante, ordinaire]]])
    )

    expect(gardees).toHaveLength(1)
  })

  it('garde un titulaire dont on ignore les équipes', () => {
    // Une absence d'information ne doit pas retirer quelqu'un du système : mieux vaut proposer un
    // échange de trop que faire disparaître un bénévole sans explication.
    expect(affectationsEchangeables([{ userId: 20 }], equipes([]))).toHaveLength(1)
  })

  it('garde un membre d’équipe autonome', () => {
    // Réservé n'est pas dispensé : ses heures restent dues, donc échangeables.
    const gardees = affectationsEchangeables(
      [{ userId: 20 }],
      equipes([[20, [{ isFloatingTeam: false }]]])
    )

    expect(gardees).toHaveLength(1)
  })

  it('rend une liste vide sans affectations', () => {
    expect(affectationsEchangeables([], equipes([]))).toEqual([])
  })
})
