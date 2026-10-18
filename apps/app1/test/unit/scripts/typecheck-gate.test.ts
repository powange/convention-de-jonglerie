import { describe, it, expect } from 'vitest'

// @ts-expect-error — module .mjs sans déclarations, importé pour son comportement
import {
  developperRepertoires,
  diagnostiquerAboutissement,
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

/**
 * Le journal réellement produit par la CI pendant des semaines : 1 891 octets, aucune ligne
 * `error TS`, et un plantage mémoire au milieu. Recopié de l'artefact `typecheck-log` du passage
 * 39060512481 sur `main` plutôt que réécrit, pour que le test porte sur la vraie sortie.
 */
const JOURNAL_OOM_REEL = `
> typecheck
> nuxt typecheck

[warn] [nuxt-site-config] [Nuxt Site Config] Invalid config provided, please correct:

<--- Last few GCs --->

[2211:0x259f4000]   114567 ms: Scavenge 4076.9 (4099.7) -> 4072.1 (4117.2) MB, pooled: 0 MB
[2211:0x259f4000]   115955 ms: Mark-Compact (reduce) 4086.1 (4117.5) -> 4070.0 (4090.2) MB

FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [node]
`

describe('Le journal de typage doit être complet avant qu’une porte le lise', () => {
  it('attrape le VRAI journal d’OOM qui a rendu la porte vacante', () => {
    const { abouti, raison } = diagnostiquerAboutissement(JOURNAL_OOM_REEL, 134)

    expect(abouti).toBe(false)
    expect(raison).toMatch(/mémoire/)
  })

  it('⚠️ et l’attrape même si le code de sortie prétend que tout va bien', () => {
    // C'est exactement ce que faisait le `|| true` de l'étape : il forçait 0.
    expect(diagnostiquerAboutissement(JOURNAL_OOM_REEL, 0).abouti).toBe(false)
  })

  it('laisse passer un journal abouti QUI CONTIENT des erreurs de type', () => {
    // Des milliers d'erreurs préexistantes : leur présence est normale, ce n'est pas un plantage.
    const journal = `${LIGNE_REELLE}\nFound 1 error in 1 file.`

    expect(diagnostiquerAboutissement(journal, 2).abouti).toBe(true)
  })

  it('📍 et laisse passer un journal abouti SANS aucune erreur', () => {
    /*
     * Le cas qui compte pour la durée de vie de cette garde. Si elle se prouvait par la présence
     * d'erreurs, elle tomberait le jour où la dette atteindrait zéro — au seul moment où elle
     * n'aurait plus rien à dire. Elle cherche donc des traces de plantage, pas des erreurs.
     */
    expect(diagnostiquerAboutissement('> typecheck\n> nuxt typecheck\n', 0).abouti).toBe(true)
  })

  it('attrape un processus tué par un signal, journal muet compris', () => {
    // Un `kill -9` ne laisse rien dans le journal : seul le code de sortie le dit.
    expect(diagnostiquerAboutissement('', 137).abouti).toBe(false)
    expect(diagnostiquerAboutissement('', 137).raison).toMatch(/signal 9/)
  })
})

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
