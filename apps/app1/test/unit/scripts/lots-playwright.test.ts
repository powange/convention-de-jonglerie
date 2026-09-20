import { describe, expect, it } from 'vitest'

import { mediane, repartir } from '../../../scripts/lots-playwright.mjs'

/**
 * La répartition des fichiers de test entre les lots de la CI.
 *
 * `--shard` de Playwright équilibre le nombre de tests, pas leur durée : un lot mettait 293 s là
 * où un autre en mettait 118, à nombre égal. Ces fonctions décident de la répartition par durée.
 *
 * Deux propriétés comptent plus que l'optimalité, et ce sont elles qui sont vérifiées ici : aucun
 * fichier ne doit disparaître — il ne s'exécuterait nulle part, sans que rien ne le signale — et
 * la répartition doit être déterministe, faute de quoi deux exécutions du même commit ne testeraient
 * pas la même chose.
 */

const DUREES = { a: 30, b: 20, c: 10, d: 10, e: 5, f: 5 }

describe('mediane', () => {
  it('rend la valeur du milieu', () => {
    expect(mediane([1, 5, 100])).toBe(5)
  })

  it('résiste à une liste vide', () => {
    expect(mediane([])).toBe(0)
  })

  it('ne se laisse pas tirer par une valeur extrême', () => {
    // C'est la raison du choix de la médiane : une moyenne rendrait 204 ici.
    expect(mediane([1, 2, 3, 4, 1000])).toBe(3)
  })
})

describe('repartir', () => {
  it('place chaque fichier une fois et une seule', () => {
    const lots = repartir(Object.keys(DUREES), DUREES, 3)
    const places = lots.flatMap((l) => l.fichiers).sort()

    expect(places).toEqual(Object.keys(DUREES).sort())
  })

  it('équilibre les lots par durée, pas par nombre', () => {
    const lots = repartir(Object.keys(DUREES), DUREES, 3)

    // 80 s au total sur trois lots : le glouton tombe ici sur l'optimum exact.
    expect(lots.map((l) => l.cout)).toEqual([30, 25, 25])
    // Et le lot le plus coûteux n'est pas celui qui a le plus de fichiers.
    expect(lots[0].fichiers).toEqual(['a'])
  })

  it('donne la durée médiane à un fichier jamais mesuré', () => {
    // Le cas du fichier de test ajouté après le dernier relevé. L'ignorer reviendrait à le croire
    // gratuit et à surcharger son lot en silence.
    const lots = repartir([...Object.keys(DUREES), 'nouveau'], DUREES, 3)
    const cout = lots.reduce((s, l) => s + l.cout, 0)

    expect(lots.flatMap((l) => l.fichiers)).toContain('nouveau')
    expect(cout).toBe(80 + mediane(Object.values(DUREES)))
  })

  it('répartit à l’identique quel que soit l’ordre reçu', () => {
    // La liste vient d'une lecture de disque : son ordre n'est pas garanti d'une machine à
    // l'autre, et la CI doit pourtant répartir pareil.
    const direct = repartir(Object.keys(DUREES), DUREES, 3)
    const inverse = repartir([...Object.keys(DUREES)].reverse(), DUREES, 3)

    expect(inverse.map((l) => l.fichiers)).toEqual(direct.map((l) => l.fichiers))
  })

  it('départage deux durées égales par ordre alphabétique', () => {
    const lots = repartir(['z', 'a'], { z: 10, a: 10 }, 2)

    expect(lots[0].fichiers).toEqual(['a'])
  })

  it('tolère plus de lots que de fichiers', () => {
    const lots = repartir(['a', 'b'], DUREES, 4)

    expect(lots).toHaveLength(4)
    expect(lots.flatMap((l) => l.fichiers).sort()).toEqual(['a', 'b'])
  })
})
