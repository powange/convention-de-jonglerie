import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Le catalogue des modules et des droits de Flowvent (`apps/app2/shared/modules-evenement.ts`)
 * nomme des colonnes Prisma sous forme de chaînes : l'API les lit (`select`, `update`) par ce
 * catalogue. Une colonne mal orthographiée ou oubliée dans le schéma ne casse pas la compilation
 * — elle fait répondre 500 à la gestion de CHAQUE événement. Ce test la ferme.
 *
 * ⚠️ Lu COMME DU TEXTE, pas importé : un fichier TypeScript d'app2 ne se transforme qu'avec
 * `apps/app2/.nuxt/tsconfig.json`, que la CI ne génère pas (cf. flowvent-taches-planifiees.test.ts).
 */
const DEPOT = resolve(process.cwd(), '..', '..')
const lire = (chemin: string) => readFileSync(join(DEPOT, chemin), 'utf8')

const catalogue = lire('apps/app2/shared/modules-evenement.ts')
const schema = lire('apps/app2/prisma/schema.prisma')

function champsDuModele(modele: string): string[] {
  const corps = schema.match(new RegExp(`^model ${modele} \\{([\\s\\S]*?)^\\}`, 'm'))?.[1] ?? ''
  return [...corps.matchAll(/^\s+(\w+)\s+Boolean\b/gm)].map((m) => m[1]!)
}

const colonnes = [...catalogue.matchAll(/colonne: '(\w+)'/g)].map((m) => m[1]!)

describe('Flowvent — catalogue des modules et des droits', () => {
  it('chaque interrupteur de module est une colonne booléenne de `Event`', () => {
    const modules = colonnes.filter((c) => c.endsWith('Enabled'))
    expect(modules.length).toBeGreaterThanOrEqual(7)
    const champs = champsDuModele('Event')
    expect(modules.filter((c) => !champs.includes(c))).toEqual([])
  })

  it('chaque droit par domaine est une colonne booléenne de `EditionOrganizer`', () => {
    const droits = colonnes.filter((c) => c.startsWith('can'))
    expect(droits.length).toBeGreaterThanOrEqual(8)
    const champs = champsDuModele('EditionOrganizer')
    expect(droits.filter((c) => !champs.includes(c))).toEqual([])
  })

  it('chaque module désigne une clé de droit qui existe', () => {
    const clesDroits = new Set(
      [
        ...catalogue
          .slice(catalogue.indexOf('DROITS_PAR_DOMAINE: readonly'))
          .matchAll(/cle: '(\w+)'/g),
      ].map((m) => m[1]!)
    )
    const droitsDesModules = [...catalogue.matchAll(/droit: '(\w+)'/g)].map((m) => m[1]!)
    expect(droitsDesModules.length).toBeGreaterThanOrEqual(7)
    expect(droitsDesModules.filter((d) => !clesDroits.has(d))).toEqual([])
  })
})
