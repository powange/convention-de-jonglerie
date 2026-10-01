import { describe, it, expect } from 'vitest'

import {
  handoutItemSelectionSchema,
  normalizeHandoutItemSelections,
} from '../../../../server/utils/ticketing/handout-item-selection'

describe('handoutItemSelectionSchema', () => {
  it('accepte la forme envoyée par les modales de billetterie', () => {
    // Payload exact refusé en production : « expected number, received object »
    expect(handoutItemSelectionSchema.parse({ handoutItemId: 5, quantity: 3 })).toEqual({
      handoutItemId: 5,
      quantity: 3,
    })
  })

  it("accepte encore l'identifiant nu, forme documentée avant les quantités", () => {
    expect(handoutItemSelectionSchema.parse(5)).toBe(5)
  })

  it('refuse une quantité nulle ou négative', () => {
    expect(() => handoutItemSelectionSchema.parse({ handoutItemId: 5, quantity: 0 })).toThrow()
    expect(() => handoutItemSelectionSchema.parse({ handoutItemId: 5, quantity: -2 })).toThrow()
  })

  it('refuse une entrée sans identifiant', () => {
    expect(() => handoutItemSelectionSchema.parse({ quantity: 2 })).toThrow()
  })
})

describe('les PHASES, quand elles sont fournies', () => {
  it('🔬 normalise les phases, et rend un tableau vide à défaut', () => {
    /*
     * ⚠️ VIDE = TOUTES LES PHASES, c'est la convention de `phases-edition.ts` et c'est ce qui rend
     * l'ajout de la colonne sans effet sur l'existant. L'identifiant nu — la forme documentée
     * avant les quantités — doit donc rendre la MÊME structure que la forme objet, sans quoi
     * l'appelant devrait savoir laquelle il a reçue.
     */
    expect(normalizeHandoutItemSelections([4])).toEqual([
      { handoutItemId: 4, quantity: 1, phases: [] },
    ])
    expect(
      normalizeHandoutItemSelections([{ handoutItemId: 4, phases: ['TEARDOWN', 'SETUP'] }])
    ).toEqual([{ handoutItemId: 4, quantity: 1, phases: ['SETUP', 'TEARDOWN'] }])
  })

  it('les autres porteurs d’articles ignorent ce champ sans se casser', () => {
    /*
     * 📍 Tarifs, options, spectacles et repas passent par cette même normalisation et leurs tables
     * n'ont PAS de colonne `phases` : ils déstructurent `{ handoutItemId, quantity }`. Ce test
     * fixe le contrat — un champ en plus ne doit jamais devenir un champ obligatoire pour eux.
     */
    const [selection] = normalizeHandoutItemSelections([{ handoutItemId: 8, quantity: 2 }])
    const { handoutItemId, quantity } = selection!

    expect({ handoutItemId, quantity }).toEqual({ handoutItemId: 8, quantity: 2 })
  })
})

describe('normalizeHandoutItemSelections', () => {
  it('ramène les deux formes à un couple article / quantité', () => {
    expect(
      normalizeHandoutItemSelections([7, { handoutItemId: 8, quantity: 4, phases: [] }])
    ).toEqual([
      { handoutItemId: 7, quantity: 1, phases: [] },
      { handoutItemId: 8, quantity: 4, phases: [] },
    ])
  })

  it('donne un exemplaire par défaut quand la quantité est absente', () => {
    expect(normalizeHandoutItemSelections([{ handoutItemId: 9 }])).toEqual([
      { handoutItemId: 9, quantity: 1, phases: [] },
    ])
  })

  it('écarte les doublons, que l’index unique en base refuserait', () => {
    // (tierId, handoutItemId) est unique : deux entrées du même article feraient échouer
    // le createMany. La dernière quantité l'emporte.
    expect(
      normalizeHandoutItemSelections([
        { handoutItemId: 3, quantity: 1, phases: [] },
        { handoutItemId: 3, quantity: 5, phases: [] },
      ])
    ).toEqual([{ handoutItemId: 3, quantity: 5, phases: [] }])
  })

  it('rend une liste vide pour une sélection vide', () => {
    expect(normalizeHandoutItemSelections([])).toEqual([])
  })

  /**
   * Ce que la fonction a repris de sa jumelle, désormais supprimée.
   *
   * Il y avait deux normalisations : celle-ci dédoublonnait sans borner, l'autre bornait sans
   * dédoublonner — et c'était l'autre qu'employaient la création et la mise à jour des tarifs,
   * des options, des spectacles et des repas. Ces chemins n'ont pas tous un schéma zod devant
   * eux : la borne doit donc vivre ici aussi.
   */
  it('accepte une sélection absente', () => {
    // La jumelle l'acceptait, et ses appelants passent un champ facultatif.
    expect(normalizeHandoutItemSelections(undefined)).toEqual([])
    expect(normalizeHandoutItemSelections(null)).toEqual([])
  })

  it('BORNE une quantité nulle, négative ou fractionnaire à un exemplaire', () => {
    // On ne remet pas « zéro bracelet », et une demi-unité n'a pas de sens non plus.
    expect(normalizeHandoutItemSelections([{ handoutItemId: 1, quantity: 0, phases: [] }])).toEqual(
      [{ handoutItemId: 1, quantity: 1, phases: [] }]
    )
    expect(normalizeHandoutItemSelections([{ handoutItemId: 2, quantity: -3 }])).toEqual([
      { handoutItemId: 2, quantity: 1, phases: [] },
    ])
    expect(normalizeHandoutItemSelections([{ handoutItemId: 3, quantity: 2.7 }])).toEqual([
      { handoutItemId: 3, quantity: 2, phases: [] },
    ])
  })
})
