import { describe, it, expect } from 'vitest'

import { dateDuRemboursement } from '../../../server/utils/treasury-guards'

describe('dateDuRemboursement', () => {
  it('date le remboursement qu’on vient de faire', () => {
    const avant = Date.now()
    const { reimbursedAt } = dateDuRemboursement(false, true)
    expect(reimbursedAt).toBeInstanceOf(Date)
    expect((reimbursedAt as Date).getTime()).toBeGreaterThanOrEqual(avant)
  })

  it('date aussi une ligne créée déjà remboursée', () => {
    // À la création il n'y a pas d'état d'avant : une ligne saisie « déjà remboursée » est datée
    // du jour de la saisie, faute de mieux, plutôt que laissée sans date.
    expect(dateDuRemboursement(undefined, true).reimbursedAt).toBeInstanceOf(Date)
  })

  it('efface la date quand on annule le remboursement', () => {
    // Sans cet effacement, la date resterait à contredire l'état.
    expect(dateDuRemboursement(true, false)).toEqual({ reimbursedAt: null })
    expect(dateDuRemboursement(undefined, false)).toEqual({ reimbursedAt: null })
  })

  it('NE DÉPLACE PAS la date d’un remboursement déjà daté', () => {
    /*
     * Le cas qui justifie le paramètre `avant`. Réenregistrer une ligne pour en corriger le
     * libellé passerait `reimbursed: true` une seconde fois : rendre une date ici écraserait celle
     * du versement réel. L'objet vide laisse la colonne intacte.
     */
    expect(dateDuRemboursement(true, true)).toEqual({})
    expect(Object.keys(dateDuRemboursement(true, true))).toHaveLength(0)
  })
})
