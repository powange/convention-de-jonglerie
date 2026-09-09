import { describe, it, expect } from 'vitest'

// @ts-expect-error — module .mjs sans déclarations, importé pour son comportement
import {
  developperRepertoires,
  erreursBloquantes,
  normaliserChemin,
} from '../../../scripts/typecheck-gate.mjs'

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

/**
 * Le faux vert du 8 septembre 2026.
 *
 * `git status --short` réduit un répertoire entièrement nouveau à une seule entrée — le dossier,
 * pas les fichiers. La porte, qui compare des chemins de fichiers, n'en reconnaissait aucun et
 * annonçait « aucune erreur » sur du code jamais examiné. Deux `TS2345` sont passées ainsi.
 */
describe('developperRepertoires', () => {
  const disque = (arborescence: Record<string, string[]>) => ({
    existe: (chemin: string) =>
      chemin in arborescence || Object.values(arborescence).flat().includes(chemin),
    estRepertoire: (chemin: string) => chemin in arborescence,
    lister: (chemin: string) => arborescence[chemin] ?? [],
  })

  const ARBRE = {
    'layers/stock/server/api/stock-tags': [
      'layers/stock/server/api/stock-tags/index.get.ts',
      'layers/stock/server/api/stock-tags/index.post.ts',
    ],
  }

  it('remplace un répertoire par les fichiers qu’il contient', () => {
    expect(developperRepertoires(['layers/stock/server/api/stock-tags'], disque(ARBRE))).toEqual([
      'layers/stock/server/api/stock-tags/index.get.ts',
      'layers/stock/server/api/stock-tags/index.post.ts',
    ])
  })

  it('laisse les fichiers tels quels', () => {
    expect(developperRepertoires(['apps/app1/server/utils/a.ts'], disque(ARBRE))).toEqual([
      'apps/app1/server/utils/a.ts',
    ])
  })

  it('mêle sans peine fichiers et répertoires', () => {
    const resultat = developperRepertoires(
      ['apps/app1/a.ts', 'layers/stock/server/api/stock-tags'],
      disque(ARBRE)
    )

    expect(resultat).toHaveLength(3)
    expect(resultat[0]).toBe('apps/app1/a.ts')
  })

  it('garde un chemin qui n’existe plus', () => {
    // Un fichier supprimé figure dans la liste des modifications : il reste tel quel, et ne
    // correspondra simplement à aucune erreur.
    expect(developperRepertoires(['apps/app1/supprime.ts'], disque({}))).toEqual([
      'apps/app1/supprime.ts',
    ])
  })

  it('rend le fichier attendu à la porte, là où le dossier ne disait rien', () => {
    // Le bout à bout : sans développement, la ligne d'erreur n'était rattachée à rien.
    const ligne =
      '../../layers/stock/server/api/stock-tags/index.post.ts(12,5): error TS2345: Argument…'
    const dossier = ['layers/stock/server/api/stock-tags']

    expect(erreursBloquantes(ligne, dossier, ['2345'])).toHaveLength(0)
    expect(
      erreursBloquantes(ligne, developperRepertoires(dossier, disque(ARBRE)), ['2345'])
    ).toHaveLength(1)
  })
})
