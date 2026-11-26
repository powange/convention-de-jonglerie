import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Flowvent (app2) n'a eu, pendant des mois, AUCUN contrôle de code en CI hors son build Docker :
 * `eslint.config.mjs` excluait `apps/app2/**`, et `format:check` ne lisait qu'app1 et les layers.
 * La CI affirmait pourtant le contraire — c'est même sur cette affirmation qu'avait été justifié
 * le maintien du job `lint` dans le périmètre `app2-seul`.
 *
 * Ces cas gardent la couverture : une exclusion d'app2 remise en entier, ou un `format:check` qui
 * la perdrait, ne ferait rien rougir d'autre.
 */
const DEPOT = resolve(process.cwd(), '..', '..')
const lire = (chemin: string) => readFileSync(join(DEPOT, chemin), 'utf8')

describe('app2 est vérifiée par le lint', () => {
  it('⚠️ ESLint n’exclut d’app2 que ses fichiers générés et ses dépendances', () => {
    const config = lire('eslint.config.mjs')
    // Le seul tableau `ignores` : un commentaire citant l'ancienne exclusion ne doit pas compter.
    const bloc = config.match(/ignores:\s*\[([^\]]*)\]/)?.[1] ?? ''
    expect(bloc, 'tableau ignores introuvable : la lecture est cassée').toContain(
      'playwright-report'
    )
    const exclusions = [...bloc.matchAll(/'(apps\/app2\/[^']*)'/g)].map((m) => m[1]!)
    expect(exclusions).not.toContain('apps/app2/**')
    for (const e of exclusions) {
      expect(e, e).toMatch(/^apps\/app2\/(node_modules|\.nuxt|\.output|server\/generated)\/\*\*$/)
    }
  })

  it('⚠️ format:check lit app2, en ignorant ce que son .gitignore ignore', () => {
    const scripts = JSON.parse(lire('apps/app1/package.json')).scripts as Record<string, string>
    for (const nom of ['format', 'format:check']) {
      expect(scripts[nom], nom).toContain('"../app2/**/*.{')
      expect(scripts[nom], nom).toContain('--ignore-path ../app2/.gitignore')
      // Sans le .gitignore d'app1 explicitement, --ignore-path remplace le défaut : app1 perdrait
      // le sien, et son .nuxt serait formaté.
      expect(scripts[nom], nom).toContain('--ignore-path .gitignore')
    }
  })
})
