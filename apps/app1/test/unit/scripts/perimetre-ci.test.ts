import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

import {
  calculerJobs,
  calculerPerimetre,
  JOBS_CONDITIONNES,
  JOBS_PAR_PERIMETRE,
  layersEtendusParApp2,
  listePourConditions,
  rendreVerdict,
  touchePourFlowvent,
  // @ts-expect-error — module .mjs sans déclarations, importé pour son comportement
} from '../../../scripts/perimetre-ci.mjs'

/**
 * `ci-verte` est le seul check que la règle de `main` exige : ce que ce script accepte décide de
 * ce qui peut être mergé. Deux défauts sont à craindre, dans des directions opposées :
 *
 *  - accepter trop : un job requis sauté (par un échec en amont) passerait pour un saut voulu, et
 *    une PR rouge serait mergée ;
 *  - accepter trop peu : un job sauté à dessein ferait échouer `ci-verte`, et toutes les PR
 *    d'app2 resteraient bloquées.
 *
 * Le second se voit tout de suite. Le premier ne se voit jamais, d'où le détail des cas.
 */

const WORKFLOW = join(process.cwd(), '..', '..', '.github', 'workflows', 'tests.yml')
const LAYERS_APP2 = ['ui', 'core', 'auth', 'volunteers']

type Besoins = Record<string, { result: string }>

/** Des listes de jobs représentatives : chaque périmètre, avec et sans l'image Flowvent. */
const SCENARIOS: Record<string, string[]> = {
  'complet sans Flowvent': calculerJobs('pull_request', ['apps/app1/a.ts'], LAYERS_APP2).jobs,
  'complet avec Flowvent': calculerJobs('pull_request', ['layers/auth/a.ts'], LAYERS_APP2).jobs,
  'app2-seul': calculerJobs('pull_request', ['apps/app2/a.ts'], LAYERS_APP2).jobs,
  amorcage: calculerJobs('push', [], LAYERS_APP2).jobs,
  planifié: calculerJobs('schedule', [], LAYERS_APP2).jobs,
}

/** Les résultats que GitHub donnerait à `needs` pour un run sans accroc lançant ces jobs. */
const runNominal = (lances: string[]): Besoins => {
  const besoins: Besoins = { changements: { result: 'success' }, setup: { result: 'success' } }
  for (const n of JOBS_CONDITIONNES as string[]) {
    if (n === 'audit') continue // hors de `needs` de ci-verte, délibérément
    besoins[n] = { result: lances.includes(n) ? 'success' : 'skipped' }
  }
  return besoins
}

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
    expect(calculerJobs('pull_request', [], LAYERS_APP2).jobs).toContain('image-flowvent')
  })

  it('un push sur main n’écrit que les caches', () => {
    expect(calculerJobs('push', ['apps/app2/a.ts'], LAYERS_APP2)).toMatchObject({
      perimetre: 'amorcage',
      jobs: ['base-de-test', 'navigateurs'],
    })
  })

  it('⚠️ le run planifié et le déclenchement manuel font la suite COMPLÈTE, images comprises', () => {
    // Le run planifié est ce qui remplace la suite complète de chaque merge : s'il tombait en
    // `amorcage`, plus rien ne rejouerait la suite sur `main`, sans qu'aucun job ne rougisse.
    for (const evt of ['schedule', 'workflow_dispatch']) {
      const { perimetre, jobs } = calculerJobs(evt, [], LAYERS_APP2)
      expect(perimetre, evt).toBe('complet')
      expect(jobs, evt).toEqual([...JOBS_PAR_PERIMETRE.complet, 'image-flowvent'])
    }
  })

  it('les périmètres lancent ce qu’ils promettent', () => {
    expect(JOBS_PAR_PERIMETRE['app2-seul']).toEqual(['lint', 'test-unit'])
    expect(JOBS_PAR_PERIMETRE.amorcage).toEqual(['base-de-test', 'navigateurs'])
    // `navigateurs` n'a rien à faire ailleurs : `playwright` remplit le cache lui-même sur une PR.
    expect(JOBS_PAR_PERIMETRE.complet).not.toContain('navigateurs')
    for (const n of ['typecheck', 'build', 'test', 'playwright', 'lint', 'test-unit']) {
      expect(JOBS_PAR_PERIMETRE.complet, n).toContain(n)
    }
  })

  it('⚠️ la liste publiée se lit sans ambiguïté : `test` ne se reconnaît pas dans `test-unit`', () => {
    const liste = listePourConditions(JOBS_PAR_PERIMETRE['app2-seul'])
    expect(liste).toContain(' test-unit ')
    expect(liste).not.toContain(' test ')
    expect(listePourConditions(JOBS_PAR_PERIMETRE.complet)).toContain(' test ')
  })
})

describe('image de Flowvent', () => {
  it('les layers d’app2 sont lus dans `extends`, sur une ou plusieurs lignes', () => {
    expect(layersEtendusParApp2(`extends: ['../../layers/ui', '../../layers/core'],`)).toEqual([
      'ui',
      'core',
    ])
    expect(
      layersEtendusParApp2(`extends: [\n    '../../layers/auth',\n    '../../layers/map',\n  ],`)
    ).toEqual(['auth', 'map'])
  })

  it('le vrai fichier se lit — sinon la garde construirait au moindre changement de layers/', () => {
    const config = readFileSync(join(process.cwd(), '..', 'app2', 'nuxt.config.ts'), 'utf8')
    expect(layersEtendusParApp2(config)).toEqual(expect.arrayContaining(['auth', 'core']))
  })

  it('construite quand la PR touche app2, un layer étendu, ou le workflow lui-même', () => {
    expect(touchePourFlowvent(['apps/app2/x.vue'], LAYERS_APP2)).toBe(true)
    expect(touchePourFlowvent(['layers/volunteers/x.ts'], LAYERS_APP2)).toBe(true)
    expect(touchePourFlowvent(['.github/workflows/tests.yml'], LAYERS_APP2)).toBe(true)
  })

  it('⚠️ pas construite pour un layer qu’app2 n’étend pas, ni pour app1', () => {
    expect(touchePourFlowvent(['layers/ticketing/x.ts'], LAYERS_APP2)).toBe(false)
    expect(touchePourFlowvent(['layers/uix/x.ts'], LAYERS_APP2)).toBe(false)
    expect(touchePourFlowvent(['apps/app1/x.ts'], LAYERS_APP2)).toBe(false)
  })

  it('⚠️ liste des layers illisible : tout changement de layers/ compte', () => {
    expect(touchePourFlowvent(['layers/ticketing/x.ts'], [])).toBe(true)
    expect(touchePourFlowvent(['apps/app1/x.ts'], [])).toBe(false)
  })

  it('une PR d’app2 seule construit l’image en plus de lint et test-unit', () => {
    expect(calculerJobs('pull_request', ['apps/app2/a.ts'], LAYERS_APP2).jobs).toEqual([
      'lint',
      'test-unit',
      'image-flowvent',
    ])
  })
})

describe('verdict de ci-verte', () => {
  it('un run nominal est vert dans chaque scénario', () => {
    for (const [nom, jobs] of Object.entries(SCENARIOS)) {
      expect(rendreVerdict(runNominal(jobs), listePourConditions(jobs)), nom).toEqual({
        vert: true,
        problemes: [],
      })
    }
  })

  it('⚠️ un job lancé ne peut pas être sauté', () => {
    for (const [nom, jobs] of Object.entries(SCENARIOS)) {
      for (const n of jobs) {
        if (n === 'audit') continue
        const besoins = runNominal(jobs)
        besoins[n] = { result: 'skipped' }
        const r = rendreVerdict(besoins, listePourConditions(jobs))
        expect(r.vert, `${nom} / ${n}`).toBe(false)
        expect(r.problemes.join(), `${nom} / ${n}`).toContain(n)
      }
    }
  })

  it('⚠️ une liste absente (changements en échec) vaut « tout était requis »', () => {
    const besoins = runNominal(SCENARIOS['app2-seul']!)
    besoins.changements = { result: 'failure' }
    for (const liste of [undefined, '', '   ']) {
      const r = rendreVerdict(besoins, liste)
      expect(r.vert).toBe(false)
      expect(r.problemes.some((x: string) => x.startsWith('typecheck'))).toBe(true)
    }
  })

  it('⚠️ setup et changements ne sont JAMAIS sautables', () => {
    for (const [nom, jobs] of Object.entries(SCENARIOS)) {
      for (const n of ['setup', 'changements']) {
        const besoins = runNominal(jobs)
        besoins[n] = { result: 'skipped' }
        expect(rendreVerdict(besoins, listePourConditions(jobs)).vert, `${nom} / ${n}`).toBe(false)
      }
    }
  })

  it('⚠️ un échec ou une annulation refuse, même sur un job non lancé', () => {
    const jobs = SCENARIOS['app2-seul']!
    for (const result of ['failure', 'cancelled']) {
      const besoins = runNominal(jobs)
      besoins.playwright = { result }
      expect(rendreVerdict(besoins, listePourConditions(jobs)).vert, result).toBe(false)
    }
  })

  it('⚠️ un job ajouté plus tard est requis par défaut', () => {
    const jobs = SCENARIOS['app2-seul']!
    const besoins = { ...runNominal(jobs), 'nouveau-job': { result: 'skipped' } }
    expect(rendreVerdict(besoins, listePourConditions(jobs)).vert).toBe(false)
  })

  it('aucun job surveillé → refus (un verdict sur rien n’est pas un vert)', () => {
    expect(rendreVerdict({}, ' lint ').vert).toBe(false)
  })
})

/**
 * Le script décide, le YAML applique : chaque job conditionné y cherche son nom dans la sortie
 * `jobs` de `changements`. S'ils divergent :
 *  - un job conditionné que le script ignore → jamais lancé, et `ci-verte` refuse son saut ;
 *  - une condition qui cherche un autre nom que le sien → le job suit le périmètre d'un autre.
 */
describe('le workflow et le script sont d’accord', () => {
  const src = readFileSync(WORKFLOW, 'utf8')
  const corps = src.slice(src.indexOf('\njobs:\n'))

  /** Chaque job de premier niveau et son bloc de texte. */
  const blocs = new Map<string, string>()
  const entetes = [...corps.matchAll(/^ {2}([a-z][a-z0-9-]*):$/gm)]
  for (const [i, m] of entetes.entries()) {
    blocs.set(m[1]!, corps.slice(m.index!, entetes[i + 1]?.index ?? corps.length))
  }

  const conditionDe = (bloc: string) =>
    bloc.match(/^ {4}if: contains\(needs\.changements\.outputs\.jobs, ' ([a-z0-9-]+) '\)$/m)?.[1]
  const conditionnes = [...blocs].filter(([, b]) => conditionDe(b)).map(([n]) => n)

  it('le balayage trouve bien les jobs', () => {
    expect(blocs.size).toBeGreaterThan(10)
    expect(blocs.has('ci-verte')).toBe(true)
  })

  it('⚠️ les jobs conditionnés au périmètre sont exactement ceux que le script connaît', () => {
    expect([...conditionnes].sort()).toEqual(JOBS_CONDITIONNES)
  })

  it('⚠️ chaque job cherche SON nom, et dépend de `changements` pour le lire', () => {
    for (const n of conditionnes) {
      const bloc = blocs.get(n)!
      expect(conditionDe(bloc), n).toBe(n)
      expect(bloc, n).toMatch(/needs:\s*\[[^\]]*\bchangements\b[^\]]*\]/)
    }
  })

  it('⚠️ `changements` publie bien la liste que les conditions lisent', () => {
    expect(blocs.get('changements')).toContain('jobs: ${{ steps.calcul.outputs.jobs }}')
  })

  it('⚠️ ci-verte surveille tous les jobs, sauf l’audit (non bloquant) et le signalement', () => {
    const besoins = blocs
      .get('ci-verte')!
      .match(/needs:\s*\[([^\]]+)\]/)![1]!
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean) // la virgule finale d’une liste multiligne
    const attendus = [...blocs.keys()].filter(
      (n) => !['ci-verte', 'audit', 'signaler-run-planifie'].includes(n)
    )
    expect([...besoins].sort()).toEqual(attendus.sort())
  })

  it('⚠️ `navigateurs` écrit sous la clé que `playwright` lit', () => {
    const cle = (bloc: string) => [
      ...bloc.matchAll(/key: (\$\{\{ runner\.os \}\}-playwright-.*)$/gm),
    ]
    const lue = cle(blocs.get('playwright')!).map((m) => m[1])
    const ecrites = cle(blocs.get('navigateurs')!).map((m) => m[1])
    expect(lue).toHaveLength(1)
    expect(ecrites.length).toBeGreaterThan(0)
    for (const c of ecrites) expect(c).toBe(lue[0])
  })

  it('⚠️ le run planifié existe, et seul le signalement peut écrire', () => {
    expect(src).toMatch(/^ {2}schedule:\n {4}- cron: '[^']+'$/m)
    const ecrivains = [...blocs].filter(([, b]) => /^ {6}[\w-]+: write$/m.test(b)).map(([n]) => n)
    expect(ecrivains).toEqual(['signaler-run-planifie'])
  })
})
