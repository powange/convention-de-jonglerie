import { describe, it, expect } from 'vitest'

import { aggregateHandoutItems } from '../../../../server/utils/ticketing/handout-items'

// Une association telle que renvoyée par Prisma : l'article + la quantité définie
// sur cette association précise.
const assoc = (id: number, name: string, cumulative = false, quantity?: number | null) => ({
  handoutItem: { id, name, cumulative },
  quantity,
})

describe('aggregateHandoutItems', () => {
  it('retourne une liste vide pour une entrée vide', () => {
    expect(aggregateHandoutItems([])).toEqual([])
  })

  it('applique la quantité définie sur une association unique', () => {
    const result = aggregateHandoutItems([assoc(1, 'Ticket boisson', true, 3)])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 1, name: 'Ticket boisson', quantity: 3 })
  })

  it('vaut un exemplaire quand la quantité est absente', () => {
    expect(aggregateHandoutItems([assoc(1, 'Bracelet')])[0]?.quantity).toBe(1)
  })

  // Cumulable : les quantités s'additionnent entre associations.
  it('additionne les quantités d’un article cumulable', () => {
    const result = aggregateHandoutItems([
      assoc(2, 'Ticket boisson', true, 3),
      assoc(2, 'Ticket boisson', true, 3),
    ])
    expect(result).toHaveLength(1)
    expect(result[0]?.quantity).toBe(6)
  })

  // Non cumulable : on retient la plus grande quantité, sans additionner.
  it('retient la plus grande quantité d’un article non cumulable', () => {
    const result = aggregateHandoutItems([
      assoc(1, 'Bracelet', false, 1),
      assoc(1, 'Bracelet', false, 2),
      assoc(1, 'Bracelet', false, 1),
    ])
    expect(result).toHaveLength(1)
    expect(result[0]?.quantity).toBe(2)
  })

  it('ne dédouble pas un article non cumulable associé plusieurs fois', () => {
    const result = aggregateHandoutItems([assoc(1, 'Bracelet'), assoc(1, 'Bracelet')])
    expect(result).toHaveLength(1)
    expect(result[0]?.quantity).toBe(1)
  })

  it('traite indépendamment les articles cumulables et non cumulables', () => {
    const result = aggregateHandoutItems([
      assoc(1, 'Bracelet', false, 1),
      assoc(2, 'Ticket boisson', true, 2),
      assoc(1, 'Bracelet', false, 1),
      assoc(2, 'Ticket boisson', true, 2),
    ])
    expect(result).toHaveLength(2)
    expect(result.find((r) => r.id === 1)?.quantity).toBe(1)
    expect(result.find((r) => r.id === 2)?.quantity).toBe(4)
  })

  it("préserve l'ordre de première apparition", () => {
    const result = aggregateHandoutItems([
      assoc(3, 'C'),
      assoc(1, 'A'),
      assoc(3, 'C'),
      assoc(2, 'B'),
    ])
    expect(result.map((r) => r.id)).toEqual([3, 1, 2])
  })

  it('ramène les quantités nulles, négatives ou absentes à un exemplaire', () => {
    expect(aggregateHandoutItems([assoc(1, 'Bracelet', false, 0)])[0]?.quantity).toBe(1)
    expect(aggregateHandoutItems([assoc(1, 'Bracelet', false, -5)])[0]?.quantity).toBe(1)
    expect(aggregateHandoutItems([assoc(1, 'Bracelet', false, null)])[0]?.quantity).toBe(1)
  })

  it('conserve les propriétés supplémentaires de la première occurrence', () => {
    const result = aggregateHandoutItems([
      { handoutItem: { id: 1, name: 'Bracelet', cumulative: true }, quantity: 1 },
      { handoutItem: { id: 1, name: 'Bracelet', cumulative: true }, quantity: 2 },
    ])
    expect(result[0]).toMatchObject({ name: 'Bracelet', quantity: 3 })
  })

  it('ignore les associations sans article', () => {
    const result = aggregateHandoutItems([
      { handoutItem: undefined as any, quantity: 2 },
      assoc(1, 'Bracelet'),
    ])
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(1)
  })
})
