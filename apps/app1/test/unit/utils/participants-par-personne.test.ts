import { describe, expect, it } from 'vitest'

import {
  compterLesParticipants,
  type BilletACompter,
} from '../../../shared/utils/participants-par-personne'

/**
 * Le contrôle d'accès affichait « x / y » en comptant des LIGNES DE COMMANDE. Une personne qui
 * prend un billet vendredi et un billet samedi y comptait deux fois, au numérateur comme au
 * dénominateur.
 *
 * Ces tests portent sur la règle de regroupement, là où elle peut se tromper : deux billets à
 * rapprocher, deux homonymes à ne pas fondre, et les billets sans identité exploitable.
 */

const DEBUT_DU_JOUR = new Date('2026-08-01T00:00:00.000Z')
const HIER = new Date('2026-07-31T18:00:00.000Z')
const CE_MATIN = new Date('2026-08-01T09:30:00.000Z')

const billet = (p: Partial<BilletACompter>): BilletACompter => ({
  firstName: 'Alice',
  lastName: 'Martin',
  entryValidated: false,
  entryValidatedAt: null,
  ...p,
})

describe('compterLesParticipants', () => {
  it('compte deux billets d’une même personne comme une seule personne', () => {
    // Le cas qui a motivé le changement : un billet vendredi, un billet samedi.
    const comptes = compterLesParticipants(
      [
        billet({ entryValidated: true, entryValidatedAt: CE_MATIN }),
        billet({ entryValidated: false }),
      ],
      DEBUT_DU_JOUR
    )

    expect(comptes.billets).toEqual({ total: 2, valides: 1, validesAujourdhui: 1 })
    expect(comptes.personnes).toEqual({ total: 1, valides: 1, validesAujourdhui: 1 })
  })

  it('une personne entrée compte une fois même si tous ses billets sont validés', () => {
    // L'inverse du piège précédent : le regroupement ne doit pas non plus compter deux entrées.
    const comptes = compterLesParticipants(
      [
        billet({ entryValidated: true, entryValidatedAt: CE_MATIN }),
        billet({ entryValidated: true, entryValidatedAt: CE_MATIN }),
      ],
      DEBUT_DU_JOUR
    )

    expect(comptes.billets.valides).toBe(2)
    expect(comptes.personnes).toEqual({ total: 1, valides: 1, validesAujourdhui: 1 })
  })

  it('rapproche deux écritures d’un même nom : accents, casse, espaces', () => {
    const comptes = compterLesParticipants(
      [
        billet({ firstName: 'Zoé', lastName: 'Lefèvre' }),
        billet({ firstName: '  zoe ', lastName: 'LEFEVRE' }),
      ],
      DEBUT_DU_JOUR
    )

    expect(comptes.personnes.total).toBe(1)
  })

  it('ne fond pas deux prénoms différents portant le même nom', () => {
    // Un couple, une fratrie : même nom, deux personnes.
    const comptes = compterLesParticipants(
      [billet({ firstName: 'Alice' }), billet({ firstName: 'Bob' })],
      DEBUT_DU_JOUR
    )

    expect(comptes.personnes.total).toBe(2)
  })

  it('compte chaque billet sans identité exploitable comme une personne à part', () => {
    /*
     * Conséquence assumée du regroupement par nom et prénom : sans les deux, on ne peut rien
     * rapprocher. Les fondre en une seule personne inventerait quelqu'un, les retirer ferait
     * disparaître des participants réels — les deux seraient pires que ce compte-là.
     *
     * Le nom seul ne suffit pas : c'est la règle de `cleIdentiteCivile`, qui vaut aussi ici.
     */
    const comptes = compterLesParticipants(
      [
        billet({ firstName: null, lastName: null }),
        billet({ firstName: null, lastName: null }),
        billet({ firstName: '', lastName: 'Martin' }),
        billet({ firstName: '', lastName: 'Martin' }),
      ],
      DEBUT_DU_JOUR
    )

    expect(comptes.billets.total).toBe(4)
    expect(comptes.personnes.total).toBe(4)
  })

  it('une personne entrée hier n’est pas comptée dans les entrées du jour', () => {
    const comptes = compterLesParticipants(
      [billet({ entryValidated: true, entryValidatedAt: HIER })],
      DEBUT_DU_JOUR
    )

    expect(comptes.personnes).toEqual({ total: 1, valides: 1, validesAujourdhui: 0 })
  })

  it('une personne entrée hier ET aujourd’hui compte une fois dans les entrées du jour', () => {
    const comptes = compterLesParticipants(
      [
        billet({ entryValidated: true, entryValidatedAt: HIER }),
        billet({ entryValidated: true, entryValidatedAt: CE_MATIN }),
      ],
      DEBUT_DU_JOUR
    )

    expect(comptes.billets.validesAujourdhui).toBe(1)
    expect(comptes.personnes.validesAujourdhui).toBe(1)
  })

  it('ignore une validation sans horodatage pour le compte du jour', () => {
    // `entryValidated` sans `entryValidatedAt` : la requête d'origine l'excluait déjà du jour,
    // par son filtre `entryValidatedAt: { gte: today }`. On garde ce comportement.
    const comptes = compterLesParticipants(
      [billet({ entryValidated: true, entryValidatedAt: null })],
      DEBUT_DU_JOUR
    )

    expect(comptes.personnes).toEqual({ total: 1, valides: 1, validesAujourdhui: 0 })
  })

  it('rend des zéros sans billet, plutôt que de lever', () => {
    const comptes = compterLesParticipants([], DEBUT_DU_JOUR)

    expect(comptes.billets).toEqual({ total: 0, valides: 0, validesAujourdhui: 0 })
    expect(comptes.personnes).toEqual({ total: 0, valides: 0, validesAujourdhui: 0 })
  })

  it('le compte par personne ne dépasse jamais le compte par billet', () => {
    /*
     * L'invariant qui protège l'écran : les deux tuiles affichent ces nombres côte à côte, et un
     * total regroupé supérieur au total par billet se lirait comme un bug. Il tient parce que les
     * deux comptes sortent du même tableau — c'est la raison d'être de la lecture unique côté
     * serveur.
     */
    const melange = [
      billet({ firstName: 'Alice', entryValidated: true, entryValidatedAt: CE_MATIN }),
      billet({ firstName: 'Alice', entryValidated: true, entryValidatedAt: CE_MATIN }),
      billet({ firstName: 'Bob' }),
      billet({ firstName: null, lastName: null, entryValidated: true, entryValidatedAt: HIER }),
    ]

    const comptes = compterLesParticipants(melange, DEBUT_DU_JOUR)

    expect(comptes.personnes.total).toBeLessThanOrEqual(comptes.billets.total)
    expect(comptes.personnes.valides).toBeLessThanOrEqual(comptes.billets.valides)
    expect(comptes.personnes.validesAujourdhui).toBeLessThanOrEqual(
      comptes.billets.validesAujourdhui
    )
  })
})
