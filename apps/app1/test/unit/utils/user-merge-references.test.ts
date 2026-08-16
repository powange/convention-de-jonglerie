import { describe, it, expect } from 'vitest'

import {
  splitConflicts,
  orderedUserReferences,
  USER_REFERENCES,
  MERGE_PRIORITY_MODELS,
} from '../../../server/utils/user-merge-references'

describe('splitConflicts', () => {
  it('transfère toutes les lignes quand le compte conservé n’a rien sur la contrainte', () => {
    const result = splitConflicts(
      [
        { id: 1, eventId: 10 },
        { id: 2, eventId: 11 },
      ],
      [],
      ['eventId']
    )

    expect(result.toTransfer).toEqual([1, 2])
    expect(result.duplicates).toEqual([])
  })

  it('écarte la ligne du compte absorbé quand le compte conservé occupe déjà la place', () => {
    const result = splitConflicts(
      [
        { id: 1, eventId: 10 },
        { id: 2, eventId: 11 },
      ],
      [{ eventId: 10 }],
      ['eventId']
    )

    expect(result.toTransfer).toEqual([2])
    expect(result.duplicates).toEqual([1])
  })

  it('écarte tout quand chaque ligne entre en conflit', () => {
    const result = splitConflicts(
      [
        { id: 'a', conversationId: 'c1' },
        { id: 'b', conversationId: 'c2' },
      ],
      [{ conversationId: 'c1' }, { conversationId: 'c2' }],
      ['conversationId']
    )

    expect(result.toTransfer).toEqual([])
    expect(result.duplicates).toEqual(['a', 'b'])
  })

  it('gère les contraintes sur plusieurs colonnes', () => {
    const result = splitConflicts(
      [
        { id: 1, showCallId: 5, applicationId: 7 },
        { id: 2, showCallId: 5, applicationId: 8 },
      ],
      [{ showCallId: 5, applicationId: 7 }],
      ['showCallId', 'applicationId']
    )

    expect(result.toTransfer).toEqual([2])
    expect(result.duplicates).toEqual([1])
  })

  it('distingue null et valeur absente sans les confondre avec une autre clé', () => {
    const result = splitConflicts(
      [
        { id: 1, name: null },
        { id: 2, name: 'preset' },
      ],
      [{ name: null }],
      ['name']
    )

    expect(result.toTransfer).toEqual([2])
    expect(result.duplicates).toEqual([1])
  })

  it('écarte aussi les doublons internes au compte absorbé', () => {
    // Deux lignes du compte absorbé partageant la même clé : une seule peut survivre
    // une fois rattachée au compte conservé.
    const result = splitConflicts(
      [
        { id: 1, workshopId: 3 },
        { id: 2, workshopId: 3 },
      ],
      [],
      ['workshopId']
    )

    expect(result.toTransfer).toEqual([1])
    expect(result.duplicates).toEqual([2])
  })
})

describe('USER_REFERENCES', () => {
  it('ne contient pas deux fois le même couple modèle/colonne', () => {
    const keys = USER_REFERENCES.map((ref) => `${ref.model}.${ref.field}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('ne déclare que des contraintes d’unicité non vides', () => {
    for (const ref of USER_REFERENCES) {
      if (ref.uniqueWith) {
        expect(ref.uniqueWith.length).toBeGreaterThan(0)
        expect(ref.uniqueWith).not.toContain(ref.field)
      }
    }
  })

  it('renseigne un modèle et une colonne pour chaque entrée', () => {
    for (const ref of USER_REFERENCES) {
      expect(ref.model).toMatch(/^[a-z][A-Za-z]*$/)
      expect(ref.field).toMatch(/^[a-z][A-Za-z]*$/)
      expect(ref.group).toBeTruthy()
    }
  })
})

describe('orderedUserReferences', () => {
  it('place les modèles prioritaires en tête', () => {
    const ordered = orderedUserReferences()
    const firstNonPriority = ordered.findIndex(
      (ref) => !(MERGE_PRIORITY_MODELS as readonly string[]).includes(ref.model)
    )
    const lastPriority = ordered.reduce(
      (last, ref, index) =>
        (MERGE_PRIORITY_MODELS as readonly string[]).includes(ref.model) ? index : last,
      -1
    )

    expect(lastPriority).toBeLessThan(firstNonPriority)
  })

  it('conserve toutes les références', () => {
    expect(orderedUserReferences()).toHaveLength(USER_REFERENCES.length)
  })
})
