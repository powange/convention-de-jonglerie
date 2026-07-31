import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Garde-fou : un composant qui appelle `money()` doit l'avoir récupéré du composable.
 *
 * `TicketingTiersList.vue` appelait `money(...)` dans son template en ne déclarant que `symbol`.
 * Rien ne l'a signalé — ESLint ne résout pas les identifiants d'un template Vue, et le typecheck
 * ne descend pas dedans. L'erreur n'apparaissait qu'à l'exécution, sur les seuls tarifs à prix
 * libre : « n.money is not a function », et les tarifs concernés disparaissaient de la liste.
 *
 * Le même défaut dormait dans `external.vue`, sans avoir encore été remarqué. C'est ce qui
 * justifie un test plutôt qu'une correction ponctuelle.
 */

const MEMBERS = ['money', 'symbol', 'currency'] as const

const ROOTS = [
  path.resolve(__dirname, '../../../app'),
  path.resolve(__dirname, '../../../../../layers'),
]

function collectVueFiles(dir: string, found: string[] = []): string[] {
  if (!fs.existsSync(dir)) return found
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) collectVueFiles(full, found)
    else if (entry.name.endsWith('.vue')) found.push(full)
  }
  return found
}

/** Ce que le fichier récupère : `const { money, symbol } = useEditionCurrency()`. */
function declaredMembers(source: string): Set<string> {
  const declared = new Set<string>()
  for (const match of source.matchAll(/const\s*\{([^}]*)\}\s*=\s*useEditionCurrency\s*\(/g)) {
    for (const part of match[1]!.split(',')) {
      const name = part.split(':')[0]!.trim()
      if (name) declared.add(name)
    }
  }
  return declared
}

describe('useEditionCurrency : usages et déclarations', () => {
  const consumers = ROOTS.flatMap((root) => collectVueFiles(root)).filter((file) =>
    fs.readFileSync(file, 'utf8').includes('useEditionCurrency(')
  )

  it('trouve bien des consommateurs, sinon ce test ne vérifie rien', () => {
    expect(consumers.length).toBeGreaterThan(3)
  })

  it.each(MEMBERS)('« %s » est déclaré partout où il est appelé', (member) => {
    const faulty: string[] = []

    for (const file of consumers) {
      const source = fs.readFileSync(file, 'utf8')
      // `symbol` s'emploie sans parenthèses (c'est un computed) : on cherche donc aussi son
      // usage nu, mais seulement hors d'une déclaration.
      const called = new RegExp(`(?<![\\w.])${member}\\s*\\(`).test(source)
      if (!called) continue
      if (!declaredMembers(source).has(member)) {
        faulty.push(path.basename(file))
      }
    }

    expect(faulty, `${member}() appelé sans être récupéré du composable`).toEqual([])
  })
})
