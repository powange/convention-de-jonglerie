import { describe, it, expect } from 'vitest'

import { aggregateHandoutItems } from '../../../../server/utils/ticketing/handout-items'

const item = (id: number, name: string, cumulative = false) => ({ id, name, cumulative })

describe('aggregateHandoutItems', () => {
  it('retourne une liste vide pour une entrée vide', () => {
    expect(aggregateHandoutItems([])).toEqual([])
  })

  it('conserve un article associé une seule fois avec quantity = 1', () => {
    const result = aggregateHandoutItems([item(1, 'Bracelet')])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 1, name: 'Bracelet', quantity: 1 })
  })

  // Comportement historique : sans le drapeau, on ne remet l'article qu'une fois.
  it('dédoublonne un article NON cumulable associé plusieurs fois', () => {
    const result = aggregateHandoutItems([item(1, 'Bracelet'), item(1, 'Bracelet')])
    expect(result).toHaveLength(1)
    expect(result[0]?.quantity).toBe(1)
  })

  it('cumule un article cumulable associé plusieurs fois', () => {
    const result = aggregateHandoutItems([
      item(2, 'Jeton boisson', true),
      item(2, 'Jeton boisson', true),
      item(2, 'Jeton boisson', true),
    ])
    expect(result).toHaveLength(1)
    expect(result[0]?.quantity).toBe(3)
  })

  it('traite indépendamment les articles cumulables et non cumulables', () => {
    const result = aggregateHandoutItems([
      item(1, 'Bracelet'),
      item(2, 'Jeton boisson', true),
      item(1, 'Bracelet'),
      item(2, 'Jeton boisson', true),
    ])
    expect(result).toHaveLength(2)
    expect(result.find((r) => r.id === 1)?.quantity).toBe(1)
    expect(result.find((r) => r.id === 2)?.quantity).toBe(2)
  })

  it("préserve l'ordre de première apparition", () => {
    const result = aggregateHandoutItems([item(3, 'C'), item(1, 'A'), item(3, 'C'), item(2, 'B')])
    expect(result.map((r) => r.id)).toEqual([3, 1, 2])
  })

  it('conserve les propriétés supplémentaires de la première occurrence', () => {
    const result = aggregateHandoutItems([
      { id: 1, name: 'Bracelet', cumulative: true, source: 'show-a' },
      { id: 1, name: 'Bracelet', cumulative: true, source: 'show-b' },
    ])
    expect(result[0]).toMatchObject({ source: 'show-a', quantity: 2 })
  })

  it('traite un cumulative absent comme non cumulable', () => {
    const result = aggregateHandoutItems([
      { id: 1, name: 'Bracelet' },
      { id: 1, name: 'Bracelet' },
    ])
    expect(result[0]?.quantity).toBe(1)
  })
})
