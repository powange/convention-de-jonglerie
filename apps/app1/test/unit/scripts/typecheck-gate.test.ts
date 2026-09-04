import { describe, it, expect } from 'vitest'

// @ts-expect-error — module .mjs sans déclarations, importé pour son comportement
import { erreursBloquantes, normaliserChemin } from '../../../scripts/typecheck-gate.mjs'

/**
 * Le garde-fou n'a de valeur que s'il attrape l'erreur qui a atteint la production, et seulement
 * sur les fichiers que la branche touche. D'où le vrai message de `nuxt typecheck` en exemple,
 * plutôt qu'une ligne inventée qui pourrait ne rien avoir en commun avec la sortie réelle.
 */
const LIGNE_REELLE =
  "../../layers/workshops/server/api/editions/[id]/workshops/[workshopId].put.ts(24,7): error TS2345: Argument of type '{ id: number; editionId: number; }' is not assignable to parameter of type 'number'."
const FICHIER_REEL = 'layers/workshops/server/api/editions/[id]/workshops/[workshopId].put.ts'

describe('Garde-fou de typage sur les fichiers modifiés', () => {
  it('rend les chemins comparables à ceux de git', () => {
    // Le journal cite depuis `apps/app1` ; git depuis la racine.
    expect(normaliserChemin('../../layers/a/b.ts')).toBe('layers/a/b.ts')
    expect(normaliserChemin('server/api/c.ts')).toBe('apps/app1/server/api/c.ts')
  })

  it('bloque l’erreur qui a atteint la production', () => {
    expect(erreursBloquantes(LIGNE_REELLE, [FICHIER_REEL], ['2345'])).toHaveLength(1)
  })

  it('laisse passer la même erreur sur un fichier non touché', () => {
    // C'est tout l'objet du gel : la dette existante ne bloque personne.
    expect(erreursBloquantes(LIGNE_REELLE, ['apps/app1/autre.ts'], ['2345'])).toHaveLength(0)
  })

  it('ignore les codes hors de la liste', () => {
    const autre = LIGNE_REELLE.replace('TS2345', 'TS2339')
    expect(erreursBloquantes(autre, [FICHIER_REEL], ['2345'])).toHaveLength(0)
  })

  it('ne compte qu’une fois une erreur répétée', () => {
    // `nuxt typecheck` sort chaque erreur deux fois ; la lire en double ferait douter du compte.
    const journal = [LIGNE_REELLE, 'bruit', LIGNE_REELLE].join('\n')
    expect(erreursBloquantes(journal, [FICHIER_REEL], ['2345'])).toHaveLength(1)
  })

  it('ne se laisse pas abuser par un chemin qui contient celui d’un fichier modifié', () => {
    const voisin = LIGNE_REELLE.replace('[workshopId].put.ts', '[workshopId].put.extra.ts')
    expect(erreursBloquantes(voisin, [FICHIER_REEL], ['2345'])).toHaveLength(0)
  })
})
