import { describe, expect, it } from 'vitest'

import { erreurOrdreEmprunt } from '../../../server/utils/emprunt-stock'

/**
 * Un emprunt se déroule dans l'ordre : on va chercher le matériel, puis on le rapporte.
 *
 * Sans cette règle, une fiche pouvait affirmer deux choses contradictoires — « jamais allé le
 * chercher » et « rendu ». Elle est jugée sur l'état APRÈS écriture, sans quoi une requête qui
 * pose les deux dates d'un coup serait refusée à tort.
 */
const JAMAIS = { pickedUpAt: null, returnedAt: null }
const LE_2 = '2026-10-02T10:00:00.000Z'
const LE_5 = '2026-10-05T18:00:00.000Z'

describe('erreurOrdreEmprunt', () => {
  it('laisse marquer la récupération', () => {
    expect(erreurOrdreEmprunt(JAMAIS, { pickedUpAt: LE_2 })).toBeNull()
  })

  it('laisse marquer le retour après la récupération', () => {
    const recupere = { pickedUpAt: LE_2, returnedAt: null }

    expect(erreurOrdreEmprunt(recupere, { returnedAt: LE_5 })).toBeNull()
  })

  it('refuse un retour sans récupération', () => {
    expect(erreurOrdreEmprunt(JAMAIS, { returnedAt: LE_5 })).toMatch(/récupéré/)
  })

  it('accepte les deux dates posées dans la même demande', () => {
    // C'est le cas d'un emprunt saisi après coup : tout est renseigné d'un bloc.
    expect(erreurOrdreEmprunt(JAMAIS, { pickedUpAt: LE_2, returnedAt: LE_5 })).toBeNull()
  })

  it("refuse d'annuler la récupération d'un matériel déjà rendu", () => {
    // La règle vaut dans les deux sens : sinon on retombe sur l'état contradictoire par l'autre
    // bout.
    const rendu = { pickedUpAt: LE_2, returnedAt: LE_5 }

    expect(erreurOrdreEmprunt(rendu, { pickedUpAt: null })).toMatch(/récupéré/)
  })

  it('laisse annuler le retour, puis la récupération', () => {
    const rendu = { pickedUpAt: LE_2, returnedAt: LE_5 }

    expect(erreurOrdreEmprunt(rendu, { returnedAt: null })).toBeNull()
    expect(
      erreurOrdreEmprunt({ pickedUpAt: LE_2, returnedAt: null }, { pickedUpAt: null })
    ).toBeNull()
  })

  it('laisse annuler les deux d’un coup', () => {
    const rendu = { pickedUpAt: LE_2, returnedAt: LE_5 }

    expect(erreurOrdreEmprunt(rendu, { pickedUpAt: null, returnedAt: null })).toBeNull()
  })

  it('ne juge que ce qui change', () => {
    // Une demande qui ne touche ni l'une ni l'autre date laisse l'état tel quel, y compris un
    // état hérité que la règle n'aurait pas laissé créer.
    const incoherent = { pickedUpAt: null, returnedAt: LE_5 }

    expect(erreurOrdreEmprunt(incoherent, {})).toMatch(/récupéré/)
  })
})
