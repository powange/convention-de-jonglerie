import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

// @ts-expect-error — module .mjs sans déclarations, importé pour son comportement
import {
  calculerPerimetre,
  rendreVerdict,
  SAUTABLES_SI_APP2_SEUL,
} from '../../../scripts/perimetre-ci.mjs'

/**
 * `ci-verte` est le seul check que la règle de `main` exige : ce que ce script accepte décide de
 * ce qui peut être mergé. Deux défauts sont à craindre, dans des directions opposées :
 *
 *  - accepter trop : un job requis sauté (par un échec en amont) passerait pour un saut voulu, et
 *    une PR rouge serait mergée ;
 *  - accepter trop peu : un job sauté à dessein ferait échouer `ci-verte`, et TOUTES les PR
 *    d'app2 resteraient bloquées.
 *
 * Le second se voit tout de suite. Le premier ne se voit jamais, d'où le détail des cas.
 */

const WORKFLOW = join(process.cwd(), '..', '..', '.github', 'workflows', 'tests.yml')

const tousVerts = (noms: string[]) =>
  Object.fromEntries(noms.map((n) => [n, { result: 'success' }])) as Record<
    string,
    { result: string }
  >

const JOBS = [
  'changements',
  'setup',
  'lint',
  'typecheck',
  'build',
  'base-de-test',
  'test-unit',
  'test',
  'playwright',
]

describe('périmètre de la CI', () => {
  it('une PR limitée à apps/app2 ne fait tourner que le nécessaire', () => {
    const r = calculerPerimetre('pull_request', [
      'apps/app2/app/pages/index.vue',
      'apps/app2/package.json',
      '',
    ])
    expect(r.perimetre).toBe('app2-seul')
  })

  it('⚠️ un seul fichier hors de apps/app2 suffit à tout faire tourner — y compris un layer', () => {
    expect(
      calculerPerimetre('pull_request', ['apps/app2/a.ts', 'layers/core/b.ts']).perimetre
    ).toBe('complet')
    expect(calculerPerimetre('pull_request', ['apps/app2/a.ts', 'docs/x.md']).perimetre).toBe(
      'complet'
    )
    expect(calculerPerimetre('pull_request', ['apps/app1/a.ts']).perimetre).toBe('complet')
  })

  it('⚠️ un préfixe voisin n’est pas app2 (apps/app20, apps/app2.md)', () => {
    expect(calculerPerimetre('pull_request', ['apps/app20/a.ts']).perimetre).toBe('complet')
    expect(calculerPerimetre('pull_request', ['apps/app2.md']).perimetre).toBe('complet')
  })

  it('⚠️ une liste vide ou illisible fait tout tourner', () => {
    expect(calculerPerimetre('pull_request', []).perimetre).toBe('complet')
    expect(calculerPerimetre('pull_request', ['', '  ']).perimetre).toBe('complet')
  })

  it('hors PR, la suite est toujours complète', () => {
    for (const evt of ['push', 'workflow_dispatch', 'schedule']) {
      expect(calculerPerimetre(evt, ['apps/app2/a.ts']).perimetre).toBe('complet')
    }
  })
})

describe('verdict de ci-verte', () => {
  it('tout vert → vert, quel que soit le périmètre', () => {
    expect(rendreVerdict(tousVerts(JOBS), 'complet').vert).toBe(true)
    expect(rendreVerdict(tousVerts(JOBS), 'app2-seul').vert).toBe(true)
  })

  it('les sauts voulus du périmètre app2-seul sont acceptés', () => {
    const besoins = tousVerts(JOBS)
    for (const n of SAUTABLES_SI_APP2_SEUL) besoins[n] = { result: 'skipped' }
    expect(rendreVerdict(besoins, 'app2-seul')).toEqual({ vert: true, problemes: [] })
  })

  it('⚠️ les mêmes sauts sont REFUSÉS en périmètre complet', () => {
    const besoins = tousVerts(JOBS)
    besoins.playwright = { result: 'skipped' }
    const r = rendreVerdict(besoins, 'complet')
    expect(r.vert).toBe(false)
    expect(r.problemes.join()).toContain('playwright')
  })

  it('⚠️ un périmètre inconnu (changements en échec) vaut complet : aucun saut accepté', () => {
    const besoins = tousVerts(JOBS)
    besoins.changements = { result: 'failure' }
    besoins.typecheck = { result: 'skipped' }
    for (const p of [undefined, '', 'nimporte']) {
      const r = rendreVerdict(besoins, p)
      expect(r.vert).toBe(false)
      expect(r.problemes.some((x: string) => x.startsWith('typecheck'))).toBe(true)
    }
  })

  it('⚠️ setup, lint et test-unit ne sont JAMAIS sautables', () => {
    for (const n of ['setup', 'lint', 'test-unit', 'changements']) {
      const besoins = tousVerts(JOBS)
      besoins[n] = { result: 'skipped' }
      expect(rendreVerdict(besoins, 'app2-seul').vert, n).toBe(false)
    }
  })

  it('⚠️ un échec ou une annulation refuse, même sur un job sautable', () => {
    for (const result of ['failure', 'cancelled']) {
      const besoins = tousVerts(JOBS)
      besoins.playwright = { result }
      expect(rendreVerdict(besoins, 'app2-seul').vert, result).toBe(false)
    }
  })

  it('⚠️ un job ajouté plus tard est requis par défaut', () => {
    const besoins = { ...tousVerts(JOBS), 'nouveau-job': { result: 'skipped' } }
    expect(rendreVerdict(besoins, 'app2-seul').vert).toBe(false)
  })

  it('aucun job surveillé → refus (un verdict sur rien n’est pas un vert)', () => {
    expect(rendreVerdict({}, 'complet').vert).toBe(false)
  })
})

/**
 * Le script et le YAML disent la même chose de deux façons : le script, quels jobs ont le droit
 * d'être sautés ; le workflow, quels jobs portent la condition qui les saute. S'ils divergent :
 *  - une condition sans entrée dans le script → `ci-verte` refuse toutes les PR d'app2 ;
 *  - une entrée sans condition → un job censé être sauté tourne pour rien (moins grave, mais
 *    c'est le signe qu'on a modifié l'un sans l'autre).
 */
describe('le workflow et le script sont d’accord', () => {
  const src = readFileSync(WORKFLOW, 'utf8')
  const debutJobs = src.indexOf('\njobs:\n')

  /** Chaque job de premier niveau et son bloc de texte. */
  const blocs = new Map<string, string>()
  const entetes = [...src.slice(debutJobs).matchAll(/^ {2}([a-z][a-z0-9-]*):$/gm)]
  for (const [i, m] of entetes.entries()) {
    const fin = entetes[i + 1]?.index ?? src.length
    blocs.set(m[1]!, src.slice(debutJobs).slice(m.index!, fin))
  }

  const CONDITION = "if: needs.changements.outputs.perimetre == 'complet'"
  const conditionnes = [...blocs]
    .filter(([, b]) => b.includes(`\n    ${CONDITION}`))
    .map(([n]) => n)

  it('le balayage trouve bien les jobs', () => {
    expect(blocs.size).toBeGreaterThan(8)
    expect(blocs.has('ci-verte')).toBe(true)
  })

  it('⚠️ les jobs conditionnés au périmètre sont exactement ceux que le verdict laisse sauter', () => {
    expect([...conditionnes].sort()).toEqual([...SAUTABLES_SI_APP2_SEUL].sort())
  })

  it('⚠️ ci-verte surveille tous les jobs du workflow, sauf l’audit (non bloquant, délibéré)', () => {
    const besoins = blocs
      .get('ci-verte')!
      .match(/needs:\s*\[([^\]]+)\]/)![1]!
      .split(',')
      .map((s) => s.trim())
    const attendus = [...blocs.keys()].filter((n) => n !== 'ci-verte' && n !== 'audit')
    expect([...besoins].sort()).toEqual(attendus.sort())
  })

  it('⚠️ chaque job conditionné dépend de `changements`, sans quoi sa condition lit du vide', () => {
    for (const n of conditionnes) {
      expect(blocs.get(n)!, n).toMatch(/needs:\s*\[[^\]]*\bchangements\b[^\]]*\]/)
    }
  })
})
