import fs from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

/**
 * Plus aucune copie locale de l'en-tête triable.
 *
 * La fonction existait en CINQ copies identiques au nom de leurs variables près. Elles sont
 * fondues dans `app/utils/en-tete-triable.ts`. Ce test empêche la sixième de naître — et c'est
 * bien ainsi qu'elles sont apparues : l'ajouter à un tableau imposait de la recopier, donc on la
 * recopiait.
 *
 * 📍 C'est aussi la raison pour laquelle la moitié des tableaux de gestion n'avaient PAS de tri :
 * personne ne recopie une sixième fois une fonction de quinze lignes pour gagner un clic.
 */
const RACINE = path.resolve(__dirname, '../../../../..')

function fichiersVue(dossier: string): string[] {
  const complet = path.join(RACINE, dossier)
  if (!fs.existsSync(complet)) return []
  const trouves: string[] = []
  const parcours = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const c = path.join(d, e.name)
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.nuxt') continue
        parcours(c)
      } else if (e.name.endsWith('.vue') || e.name.endsWith('.ts')) trouves.push(c)
    }
  }
  parcours(complet)
  return trouves
}

const SOURCES = [...fichiersVue('apps/app1/app'), ...fichiersVue('layers')]

describe('en-tête triable — une seule définition', () => {
  it('trouve bien les sources du dépôt', () => {
    // La garde de la garde : un parcours vide rendrait les assertions suivantes creuses.
    expect(SOURCES.length).toBeGreaterThan(300)
  })

  it('aucun fichier ne redéfinit la fonction', () => {
    const copies = SOURCES.filter((f) => {
      if (f.endsWith(path.join('utils', 'en-tete-triable.ts'))) return false
      const src = fs.readFileSync(f, 'utf8')
      return /function\s+(enTeteTriable|getSortableHeader)\s*\(/.test(src)
    }).map((f) => path.relative(RACINE, f))

    expect(copies, 'employer `enTeteTriable` de `~/utils/en-tete-triable`').toEqual([])
  })

  it('les cinq écrans qui triaient trient toujours', () => {
    /*
     * Sans ce cas, le test précédent passerait au vert si la fusion avait simplement SUPPRIMÉ le
     * tri des cinq écrans au lieu de le partager — ce qui est exactement l'erreur qu'un
     * remaniement mécanique peut commettre.
     */
    const ATTENDUS = [
      'apps/app1/app/pages/editions/[id]/gestion/treasury/index.vue',
      'layers/stock/app/pages/editions/[id]/gestion/stock/missing.vue',
      'layers/stock/app/pages/editions/[id]/gestion/stock/[groupId].vue',
      'layers/artists/app/pages/editions/[id]/gestion/artists/index.vue',
      'layers/volunteers/app/components/edition/volunteer/Table.vue',
    ]
    for (const relatif of ATTENDUS) {
      const src = fs.readFileSync(path.join(RACINE, relatif), 'utf8')
      expect(src, `${relatif} n'appelle plus enTeteTriable`).toMatch(/\benTeteTriable\(/)
    }
  })
})
