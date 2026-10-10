import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

const RACINES = [
  join(process.cwd(), 'app'),
  join(process.cwd(), 'server'),
  join(process.cwd(), '..', '..', 'layers'),
]

/**
 * Un seul dessin pour « modifier » — sous-question du constat `gestion-coherence D2`.
 *
 * ## Ce qui a été mesuré, et ce qui a été décidé
 *
 * Trois dessins servaient à dire « modifier » : `i-heroicons-pencil-square` (42 usages),
 * `i-heroicons-pencil` (34) et `i-lucide-pencil` (3). ⚠️ **Les deux majoritaires appartenaient à la
 * MÊME famille** : l'écart n'était pas entre heroicons et lucide, mais à l'intérieur d'heroicons —
 * ce que la fiche d'origine, qui parlait de « trois dessins » de deux bibliothèques, ne disait pas.
 *
 * `pencil-square` est retenu, comme majoritaire. Les 37 autres usages y ont été convertis, après
 * avoir relevé le libellé de chacun : tous disaient « modifier » (`edit_offer`, `edit_workshop`,
 * `edit_zone`, `common.edit`, `cash_float_edit`…) ou ouvraient une modale d'édition. Deux usages
 * sont de simples `UIcon` illustratifs — l'en-tête de la page « Modifier la convention » et
 * l'encart des droits — et ils ont suivi : un même dessin pour une même idée, bouton ou non.
 *
 * ## ⚠️ Ce que cette décision NE tranche PAS
 *
 * Le choix entre les deux familles d'icônes reste **écarté** (`i-heroicons` 3 347 usages,
 * `i-lucide` 229) : l'utilisateur a décidé de ne rien uniformiser à ce niveau le 10/10/2026. Cette
 * garde ne porte donc QUE sur le verbe « modifier », et n'interdit pas `i-lucide-*` ailleurs.
 */
const INTERDITES = [
  // Le `(?!-)` est indispensable : sans lui, le motif attrape `pencil-square` lui-même.
  { motif: /i-heroicons-pencil(?!-)/g, nom: 'i-heroicons-pencil' },
  { motif: /i-lucide-pencil(?!-)/g, nom: 'i-lucide-pencil' },
]

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

describe('icône « modifier »', () => {
  it('⚠️ UN SEUL DESSIN POUR « MODIFIER » : `i-heroicons-pencil-square`', async () => {
    const fautifs: string[] = []
    for (const fichier of await fichiersSources()) {
      const src = await readFile(fichier, 'utf8')
      for (const { motif, nom } of INTERDITES) {
        for (const m of src.matchAll(motif)) {
          const ligne = src.slice(0, m.index).split('\n').length
          fautifs.push(`${fichier.replace(process.cwd(), 'apps/app1')}:${ligne} — ${nom}`)
        }
      }
    }

    expect(
      fautifs,
      `« Modifier » s'écrit « i-heroicons-pencil-square » dans tout le dépôt. Décidé le ` +
        `10/10/2026 sur la mesure des usages (42 contre 34 contre 3) :\n${fautifs.join('\n')}`
    ).toEqual([])
  })

  it('le dessin retenu est bien employé — le balayage ne porte pas sur rien', async () => {
    /*
     * LA GARDE DE LA GARDE. Le cas ci-dessus est une interdiction : il reste vert si le balayage ne
     * lit aucun fichier, ou si plus personne n'emploie d'icône « modifier » du tout. Ce cas-ci
     * vérifie que le dessin retenu est là, et en nombre.
     *
     * ⚠️ Le plancher est large et non le compte exact (79 au moment du lot) : un écran ajouté ou
     * retiré ne doit pas faire tomber une garde qui parle de cohérence graphique.
     */
    let employe = 0
    for (const fichier of await fichiersSources()) {
      const src = await readFile(fichier, 'utf8')
      employe += [...src.matchAll(/i-heroicons-pencil-square/g)].length
    }
    expect(employe).toBeGreaterThan(50)
  })
})
