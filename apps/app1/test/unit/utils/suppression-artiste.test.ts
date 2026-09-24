import { describe, expect, it } from 'vitest'

import {
  numerosOrphelinsApresSuppression,
  spectaclesVidesApresRetrait,
  type SpectacleAvecNumeros,
} from '../../../shared/utils/suppression-artiste'

/** Un cabaret dont les numéros portent les artistes indiqués. */
function cabaret(
  id: number,
  title: string,
  numeros: Array<{ id: number; title: string; artistes: number[] }>
): SpectacleAvecNumeros {
  return {
    id,
    title,
    numeros: numeros.map((n) => ({
      id: n.id,
      title: n.title,
      showId: id,
      liens: n.artistes.map((artistId) => ({ artistId, actId: n.id })),
    })),
  }
}

describe('les numéros que la suppression laisserait sans personne', () => {
  it('retient un numéro dont l’artiste était le seul interprète', () => {
    const spectacles = [
      cabaret(1, 'Cabaret du samedi', [{ id: 10, title: 'Massues', artistes: [7] }]),
    ]

    const orphelins = numerosOrphelinsApresSuppression(spectacles, 7)

    expect(orphelins).toHaveLength(1)
    expect(orphelins[0]).toMatchObject({ actId: 10, actTitle: 'Massues', showId: 1 })
  })

  it('ignore un numéro partagé avec quelqu’un d’autre', () => {
    const spectacles = [cabaret(1, 'Cabaret', [{ id: 10, title: 'Duo', artistes: [7, 8] }])]

    expect(numerosOrphelinsApresSuppression(spectacles, 7)).toEqual([])
  })

  it('ignore un numéro DÉJÀ vide avant la suppression', () => {
    // On ne propose pas de nettoyer ce que cette suppression n'a pas causé.
    const spectacles = [cabaret(1, 'Cabaret', [{ id: 10, title: 'Numéro orphelin', artistes: [] }])]

    expect(numerosOrphelinsApresSuppression(spectacles, 7)).toEqual([])
  })

  it('ne retient que les numéros de l’artiste, au sein d’un même cabaret', () => {
    const spectacles = [
      cabaret(1, 'Cabaret', [
        { id: 10, title: 'Le sien', artistes: [7] },
        { id: 11, title: 'Celui d’un autre', artistes: [8] },
      ]),
    ]

    const orphelins = numerosOrphelinsApresSuppression(spectacles, 7)

    expect(orphelins.map((o) => o.actId)).toEqual([10])
  })
})

describe('« dernier numéro du spectacle »', () => {
  it('le dit quand il ne resterait rien dans le cabaret', () => {
    const spectacles = [cabaret(1, 'Cabaret', [{ id: 10, title: 'Massues', artistes: [7] }])]

    expect(numerosOrphelinsApresSuppression(spectacles, 7)[0]!.dernierDuSpectacle).toBe(true)
  })

  it('ne le dit pas quand un autre numéro reste peuplé', () => {
    const spectacles = [
      cabaret(1, 'Cabaret', [
        { id: 10, title: 'Massues', artistes: [7] },
        { id: 11, title: 'Diabolo', artistes: [8] },
      ]),
    ]

    expect(numerosOrphelinsApresSuppression(spectacles, 7)[0]!.dernierDuSpectacle).toBe(false)
  })

  it('le dit pour TOUS les numéros quand l’artiste les tient tous', () => {
    /*
     * Le cas qui piège : pris un par un, aucun de ces trois numéros n'est « le dernier ». Les
     * cocher tous viderait pourtant le cabaret, et l'écran doit pouvoir le dire.
     */
    const spectacles = [
      cabaret(1, 'Cabaret solo', [
        { id: 10, title: 'Un', artistes: [7] },
        { id: 11, title: 'Deux', artistes: [7] },
        { id: 12, title: 'Trois', artistes: [7] },
      ]),
    ]

    const orphelins = numerosOrphelinsApresSuppression(spectacles, 7)

    expect(orphelins).toHaveLength(3)
    expect(orphelins.every((o) => o.dernierDuSpectacle)).toBe(true)
  })
})

describe('les spectacles vidés par ce qu’on emporte', () => {
  const spectacles = [
    cabaret(1, 'Cabaret', [
      { id: 10, title: 'Un', artistes: [7] },
      { id: 11, title: 'Deux', artistes: [7] },
    ]),
  ]

  it('retient le spectacle quand tous ses numéros partent', () => {
    expect(spectaclesVidesApresRetrait(spectacles, [10, 11])).toEqual([1])
  })

  it('ne le retient pas s’il en reste un', () => {
    // C'est la garde du point d'API : on ne supprime un spectacle que s'il ne reste vraiment rien.
    expect(spectaclesVidesApresRetrait(spectacles, [10])).toEqual([])
  })

  it('ignore un spectacle sans aucun numéro', () => {
    // Un spectacle STANDARD n'a pas de numéros ; cette suppression n'a pas à l'emporter.
    expect(spectaclesVidesApresRetrait([cabaret(2, 'Spectacle simple', [])], [])).toEqual([])
  })
})
