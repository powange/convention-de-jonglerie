import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * `publier-image.yml` ne republie pas l'image d'app1 pour un commit qui ne touche que
 * `apps/app2/` : `:main` reste sur le dernier commit hors app2. Le skill `/deploy` prouve une
 * bascule en lisant ce commit dans `/_nuxt-<sha>/` ; il doit donc chercher LE MÊME commit.
 *
 * Si l'un change sans l'autre :
 *  - filtre retiré, skill inchangé → rien ne casse, l'image est juste republiée pour rien ;
 *  - filtre élargi (ex. `docs/**`), skill inchangé → `/deploy` attend une image qui ne sera jamais
 *    construite, et conclut à tort que la bascule a échoué ;
 *  - skill revenu à `origin/main`, filtre gardé → même faux échec après chaque merge Flowvent.
 *
 * Et l'image ne doit rien contenir d'app2, sans quoi le filtre servirait une image périmée.
 */
const DEPOT = resolve(process.cwd(), '..', '..')
const lire = (chemin: string) => readFileSync(join(DEPOT, chemin), 'utf8')

describe('image d’app1 : les commits Flowvent seuls ne la reconstruisent pas', () => {
  const workflow = lire('.github/workflows/publier-image.yml')
  const skill = lire('.claude/skills/deploy/SKILL.md')

  it('⚠️ le workflow ignore exactement apps/app2/**', () => {
    const bloc = workflow.match(/^ {4}paths-ignore:\n((?: {6}- .*\n)+)/m)?.[1] ?? ''
    const motifs = [...bloc.matchAll(/- '([^']+)'/g)].map((m) => m[1])
    expect(motifs).toEqual(['apps/app2/**'])
    expect(workflow, 'un filtre `paths:` ajouté changerait la règle').not.toMatch(/^ {4}paths:$/m)
  })

  it('⚠️ /deploy cherche le dernier commit hors app2, à chaque endroit où il désigne le commit', () => {
    const expression = "git log -1 --format=%H origin/main -- . ':!apps/app2'"
    expect(skill.split(expression).length - 1).toBeGreaterThanOrEqual(3)
    expect(skill, 'une comparaison à origin/main nu a été réintroduite').not.toContain(
      'git rev-parse origin/main'
    )
  })

  it('⚠️ le Dockerfile d’app1 ne copie rien d’app2', () => {
    const copies = [...lire('apps/app1/Dockerfile').matchAll(/^COPY (?!--from)(\S+)/gm)].map(
      (m) => m[1]
    )
    expect(copies.length).toBeGreaterThan(3)
    expect(copies.filter((c) => c!.startsWith('apps/app2'))).toEqual([])
  })
})
