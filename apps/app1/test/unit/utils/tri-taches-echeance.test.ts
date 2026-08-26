import { describe, expect, it } from 'vitest'

/**
 * Le tri des tâches par échéance.
 *
 * Demandé par une utilisatrice : la page affichait une échéance sur chaque ligne mais les
 * ordonnait par position manuelle, sans moyen de les classer par date.
 *
 * Le comparateur est reproduit ici depuis `[groupId].vue`, où il vit dans un computed non
 * exportable. Duplication assumée et signalée : si la page change, ce test cesse de refléter
 * la réalité. Ce qu'il protège vaut ce prix — le traitement des tâches SANS échéance, qu'un
 * comparateur naïf sur `null` placerait en tête du tri décroissant.
 */

type Tache = { titre: string; deadline: string | null }

function trier(liste: Tache[], sens: 1 | -1): Tache[] {
  return liste.slice().sort((a, b) => {
    if (!a.deadline && !b.deadline) return 0
    if (!a.deadline) return 1
    if (!b.deadline) return -1
    return (new Date(a.deadline).getTime() - new Date(b.deadline).getTime()) * sens
  })
}

const TACHES: Tache[] = [
  { titre: 'lointaine', deadline: '2026-09-30T10:00:00Z' },
  { titre: 'sans date', deadline: null },
  { titre: 'proche', deadline: '2026-09-01T10:00:00Z' },
  { titre: 'intermédiaire', deadline: '2026-09-15T10:00:00Z' },
]

describe('tri des tâches par échéance', () => {
  it('classe de la plus proche à la plus lointaine', () => {
    expect(trier(TACHES, 1).map((t) => t.titre)).toEqual([
      'proche',
      'intermédiaire',
      'lointaine',
      'sans date',
    ])
  })

  it('classe de la plus lointaine à la plus proche', () => {
    expect(trier(TACHES, -1).map((t) => t.titre)).toEqual([
      'lointaine',
      'intermédiaire',
      'proche',
      'sans date',
    ])
  })

  it('laisse les tâches sans échéance à la fin dans les DEUX sens', () => {
    // Le point qui compte : une tâche sans date n'est pas « la plus lointaine ». La remonter
    // en tête du tri décroissant laisserait croire à une échéance qu'elle n'a pas.
    for (const sens of [1, -1] as const) {
      expect(trier(TACHES, sens).at(-1)?.titre, `sens ${sens}`).toBe('sans date')
    }
  })

  it('ne modifie pas la liste d’origine', () => {
    // Le computed dérive des données du groupe : trier en place les corromprait.
    const avant = TACHES.map((t) => t.titre)
    trier(TACHES, 1)
    expect(TACHES.map((t) => t.titre)).toEqual(avant)
  })

  it('garde un ordre stable entre deux tâches sans échéance', () => {
    const liste: Tache[] = [
      { titre: 'a', deadline: null },
      { titre: 'b', deadline: null },
    ]
    expect(trier(liste, 1).map((t) => t.titre)).toEqual(['a', 'b'])
  })
})
