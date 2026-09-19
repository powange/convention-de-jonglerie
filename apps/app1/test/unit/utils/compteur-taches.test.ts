import { describe, expect, it } from 'vitest'

import { compterTachesEnRetard } from '../../../../../layers/tasks/app/utils/compteur-taches'

/**
 * La pastille des tâches.
 *
 * Tout se joue sur une distinction : « zéro » et « on ne sait pas » ne s'affichent pas pareil. La
 * première dit qu'il n'y a rien en retard, la seconde ne dit rien du tout — et une réponse
 * malformée ne permet jamais de dire la première.
 */
describe('compterTachesEnRetard', () => {
  it('rend le nombre de tâches en retard', () => {
    expect(compterTachesEnRetard({ data: { overdue: 4 } })).toBe(4)
  })

  it('rend zéro quand rien n’est en retard', () => {
    // Là, l'absence EST une réponse : la pastille s'éteint pour de bon.
    expect(compterTachesEnRetard({ data: { overdue: 0 } })).toBe(0)
  })

  it('ne conclut rien d’une réponse inexploitable', () => {
    // `null` n'affiche aucune pastille ; zéro affirmerait que rien n'est en retard.
    expect(compterTachesEnRetard(null)).toBeNull()
    expect(compterTachesEnRetard(undefined)).toBeNull()
    expect(compterTachesEnRetard({})).toBeNull()
    expect(compterTachesEnRetard({ data: null })).toBeNull()
    expect(compterTachesEnRetard({ data: { overdue: null } })).toBeNull()
  })

  it('ne conclut rien d’un nombre qui ne vient pas de ce point d’API', () => {
    expect(compterTachesEnRetard({ data: { overdue: -1 } })).toBeNull()
    expect(compterTachesEnRetard({ data: { overdue: 2.5 } })).toBeNull()
    expect(compterTachesEnRetard({ data: { overdue: Number.NaN } })).toBeNull()
  })

  it('ne conclut rien d’un type inattendu', () => {
    expect(compterTachesEnRetard({ data: { overdue: '3' } } as never)).toBeNull()
  })
})
