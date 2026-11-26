import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Chaque libellé que le layer bénévoles demande doit exister dans Flowvent (app2).
 *
 * ## Le défaut que ce garde-fou ferme
 *
 * Une clé absente ne fait rien échouer : vue-i18n affiche la clé elle-même
 * (« volunteers.closed_message »), sans erreur, sans 500, sans test rouge. C'est ainsi que les
 * pages du layer, une fois montées dans Flowvent, sortaient entièrement en clés brutes.
 *
 * Flowvent n'a qu'une langue et agrège, pour elle, les fichiers listés dans `apps/app2/nuxt.config.ts`
 * (`i18n.locales[0].files`) : ceux du layer, `benevoles.json` (les clés empruntées aux fichiers
 * communs d'app1), puis `fr.json`. Une clé que le layer se met à employer sans qu'elle figure dans
 * l'un d'eux — ajoutée à `common.json` d'app1, par exemple, que Flowvent ne lit pas — ferait
 * réapparaître une clé brute. Ce test la nomme.
 */
const DEPOT = resolve(process.cwd(), '..', '..')
const APP2 = join(DEPOT, 'apps/app2')
const SOURCES = [
  'layers/volunteers/app',
  'layers/map/app',
  'layers/stock/app',
  'layers/artists/app',
  'layers/ticketing/app',
  'layers/meals/app',
  'layers/treasury/app',
  'layers/backup/app',
  'layers/ui/app',
]

/** Les clés construites à l'exécution : seul leur préfixe est connu, il doit avoir des entrées. */
const PREFIXES_DYNAMIQUES = ['pages.volunteers.dietary.', 'edition.volunteers.time_slots_options.']

function fichiers(dossier: string): string[] {
  if (!existsSync(dossier)) return []
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(dossier, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : fichiers(chemin)
    return /\.(ts|vue)$/.test(e.name) ? [chemin] : []
  })
}

function aplatir(objet: Record<string, unknown>, prefixe = ''): string[] {
  return Object.entries(objet).flatMap(([cle, valeur]) =>
    valeur && typeof valeur === 'object'
      ? aplatir(valeur as Record<string, unknown>, `${prefixe}${cle}.`)
      : [`${prefixe}${cle}`]
  )
}

/** Les fichiers de la locale de Flowvent, lus dans sa configuration — pas recopiés ici. */
function fichiersDeFlowvent(): string[] {
  const config = readFileSync(join(APP2, 'nuxt.config.ts'), 'utf8')
  const bloc = config.match(/files:\s*\[([\s\S]*?)\]/)
  if (!bloc) return []
  return [...bloc[1]!.matchAll(/'([^']+\.json)'/g)].map((m) => join(APP2, 'i18n/locales', m[1]!))
}

describe('Flowvent — libellés du layer bénévoles', () => {
  const listes = fichiersDeFlowvent()
  const disponibles = new Set(
    listes.flatMap((f) => (existsSync(f) ? aplatir(JSON.parse(readFileSync(f, 'utf8'))) : []))
  )

  it('lit les fichiers de sa configuration, et tous existent', () => {
    // Garde de la garde : sans fichiers lus, toutes les assertions suivantes seraient creuses.
    expect(listes.length).toBeGreaterThanOrEqual(3)
    expect(listes.filter((f) => !existsSync(f)).map((f) => f.slice(DEPOT.length + 1))).toEqual([])
  })

  it('chaque clé statique employée par le layer se résout', () => {
    const employees = new Set<string>()
    for (const racine of SOURCES) {
      for (const chemin of fichiers(join(DEPOT, racine))) {
        const source = readFileSync(chemin, 'utf8')
        for (const m of source.matchAll(
          /\b(?:\$t|t|te)\(\s*['"`]([a-z_]+(?:\.[a-zA-Z_0-9]+)+)['"`]/g
        )) {
          employees.add(m[1]!)
        }
      }
    }
    expect(employees.size).toBeGreaterThan(500)
    expect([...employees].filter((cle) => !disponibles.has(cle)).sort()).toEqual([])
  })

  it('chaque préfixe de clé dynamique a des entrées', () => {
    const vides = PREFIXES_DYNAMIQUES.filter(
      (prefixe) => ![...disponibles].some((cle) => cle.startsWith(prefixe))
    )
    expect(vides).toEqual([])
  })
})
