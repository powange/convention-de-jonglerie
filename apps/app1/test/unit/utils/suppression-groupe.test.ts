import { describe, expect, it } from 'vitest'

import { resumeSuppressionGroupe } from '../../../../../layers/stock/app/utils/suppression-groupe'

/**
 * La confirmation n'annonçait que les objets. Or ce sont les réservations qui font mal : elles ont
 * été posées par d'autres, et quelqu'un qui comptait sur du matériel pour son spectacle le perdait
 * sans avoir été prévenu — sans que celui qui supprime l'ait su non plus.
 */
const objet = (reservations?: number | null) => ({
  _count: reservations === null ? null : { reservations },
})

describe('resumeSuppressionGroupe', () => {
  it('compte les objets et leurs réservations', () => {
    expect(resumeSuppressionGroupe([objet(3), objet(2)])).toEqual({ objets: 2, reservations: 5 })
  })

  it('rend des zéros sur un groupe vide', () => {
    expect(resumeSuppressionGroupe([])).toEqual({ objets: 0, reservations: 0 })
  })

  it('compte un objet sans réservation', () => {
    expect(resumeSuppressionGroupe([objet(0)])).toEqual({ objets: 1, reservations: 0 })
  })

  it('compte quand même un objet dont le décompte manque', () => {
    // L'erreur la plus dangereuse des deux serait d'annoncer moins d'objets qu'il n'y en a : une
    // API qui cesserait de rendre ce champ ferait sinon disparaître des lignes du décompte.
    expect(resumeSuppressionGroupe([objet(null), objet(undefined), objet(4)])).toEqual({
      objets: 3,
      reservations: 4,
    })
  })

  it('compte un objet dont la forme est inattendue', () => {
    expect(resumeSuppressionGroupe([{} as never])).toEqual({ objets: 1, reservations: 0 })
  })
})
