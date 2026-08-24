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

describe('normalizeHandoutItemSelections', () => {
  it('ramène les deux formes à un couple article / quantité', () => {
    expect(normalizeHandoutItemSelections([7, { handoutItemId: 8, quantity: 4 }])).toEqual([
      { handoutItemId: 7, quantity: 1 },
      { handoutItemId: 8, quantity: 4 },
    ])
  })

  it('donne un exemplaire par défaut quand la quantité est absente', () => {
    expect(normalizeHandoutItemSelections([{ handoutItemId: 9 }])).toEqual([
      { handoutItemId: 9, quantity: 1 },
    ])
  })

  it('écarte les doublons, que l’index unique en base refuserait', () => {
    // (tierId, handoutItemId) est unique : deux entrées du même article feraient échouer
    // le createMany. La dernière quantité l'emporte.
    expect(
      normalizeHandoutItemSelections([
        { handoutItemId: 3, quantity: 1 },
        { handoutItemId: 3, quantity: 5 },
      ])
    ).toEqual([{ handoutItemId: 3, quantity: 5 }])
  })

  it('rend une liste vide pour une sélection vide', () => {
    expect(normalizeHandoutItemSelections([])).toEqual([])
  })
})
