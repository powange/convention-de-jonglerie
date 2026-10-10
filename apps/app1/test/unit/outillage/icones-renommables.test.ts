import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

const RACINE = process.cwd()
const RACINES = [join(RACINE, 'app'), join(RACINE, 'server'), join(RACINE, '..', '..', 'layers')]
const CATALOGUE_HEROICONS = join(RACINE, 'node_modules/@iconify-json/heroicons/icons.json')

/**
 * Une icône `i-lucide-<nom>` dont heroicons porte le MÊME nom n'a pas de raison d'être.
 *
 * ## Le contexte, et ce que ce test ne décide pas
 *
 * Deux familles coexistent : `i-heroicons` (3 347 usages) et `i-lucide` (229). **Le choix entre
 * elles est écarté** — décision de l'utilisateur, 10/10/2026 : le mélange reste assumé. Ce test ne
 * le rouvre pas.
 *
 * Ce qu'il garde est l'étape sans arbitrage : **27 icônes, 71 usages** dont le nom existe à
 * l'identique dans heroicons (`map`, `link`, `check`, `sparkles`, `map-pin`, `minus`, `wrench`,
 * `plus`, `chevron-down`…). Les renommer ne demande aucun choix de dessin, et cela retire un tiers
 * de l'écart entre les deux familles. Les **63 icônes restantes (155 usages)** demandent une
 * correspondance de nom, et trois n'ont aucun équivalent (`toggle-right`, `pentagon`, `square`) :
 * elles sortent de ce périmètre et ce test ne les signale pas.
 *
 * ## ⚠️⚠️ POURQUOI LE CATALOGUE EST LU, ET NON UNE LISTE ÉCRITE ICI
 *
 * Une liste recopiée se périmerait à la première montée de version d'heroicons, dans les deux
 * sens : une icône nouvellement disponible resterait en lucide sans que rien ne le dise, et une
 * icône retirée du catalogue ferait échouer le test sans qu'on sache pourquoi. Le test interroge
 * donc `@iconify-json/heroicons` et en dérive la liste.
 *
 * C'est aussi ce qui a évité une erreur au moment du lot : une première passe proposait
 * `toggle-on`, `pentagon` et `square`, **qui n'existent pas dans heroicons**. Posées, elles se
 * seraient affichées vides — un carré blanc à la place du bouton, sans aucune erreur.
 */
async function nomsDeHeroicons(): Promise<Set<string>> {
  const catalogue = JSON.parse(await readFile(CATALOGUE_HEROICONS, 'utf8'))
  return new Set([...Object.keys(catalogue.icons), ...Object.keys(catalogue.aliases ?? {})])
}

async function fichiersSources(): Promise<string[]> {
  const sortie: string[] = []
  const parcourir = async (chemin: string) => {
    let entrees
    try {
      entrees = await readdir(chemin, { withFileTypes: true })
    } catch {
      return
    }
    for (const entree of entrees) {
      if (entree.name === 'node_modules' || entree.name.startsWith('.')) continue
      const complet = join(chemin, entree.name)
      if (entree.isDirectory()) await parcourir(complet)
      else if (/\.(vue|ts)$/.test(entree.name)) sortie.push(complet)
    }
  }
  for (const racine of RACINES) await parcourir(racine)
  return sortie
}

/** Les icônes lucide employées, avec leur nombre d'usages. */
async function lucideEmployees(): Promise<Map<string, number>> {
  const usages = new Map<string, number>()
  for (const fichier of await fichiersSources()) {
    const src = await readFile(fichier, 'utf8')
    for (const m of src.matchAll(/i-lucide-([a-z0-9-]+)/g)) {
      usages.set(m[1]!, (usages.get(m[1]!) ?? 0) + 1)
    }
  }
  return usages
}

describe('icônes lucide renommables sans arbitrage', () => {
  it('⚠️ AUCUNE ICÔNE LUCIDE NE PORTE UN NOM QUE HEROICONS A DÉJÀ', async () => {
    const heroicons = await nomsDeHeroicons()
    const employees = await lucideEmployees()

    const renommables = [...employees]
      .filter(([nom]) => heroicons.has(nom))
      .map(([nom, n]) => `i-lucide-${nom} (${n} usage${n > 1 ? 's' : ''}) → i-heroicons-${nom}`)

    expect(
      renommables,
      `Ces icônes existent à l'identique dans heroicons : les renommer ne demande aucun choix de ` +
        `dessin.\n${renommables.join('\n')}`
    ).toEqual([])
  })

  it('le catalogue et le balayage répondent — le test ne passe pas à vide', async () => {
    /*
     * LA GARDE DE LA GARDE, et ici elle est indispensable : le cas ci-dessus est l'intersection de
     * deux ensembles. Si le catalogue ne se chargeait pas, ou si le balayage ne lisait aucun
     * fichier, l'intersection serait vide et le test vert — en n'ayant rien vérifié.
     *
     * ⚠️ Les deux planchers sont larges à dessein : une montée de version d'heroicons change le
     * nombre d'icônes, et la conversion des 63 restantes fera baisser le nombre d'usages lucide.
     * Une garde calée sur les comptes exacts tomberait pour des raisons étrangères à son objet.
     */
    const heroicons = await nomsDeHeroicons()
    expect(heroicons.size).toBeGreaterThan(300)

    const employees = await lucideEmployees()
    expect(
      employees.size,
      'plus aucune icône lucide : ce fichier peut être supprimé'
    ).toBeGreaterThan(20)
  })
})
