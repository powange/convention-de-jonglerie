import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import * as vueuse from '@vueuse/core'
import { describe, expect, it } from 'vitest'

/**
 * Les layers partagés n'emploient VueUse QUE par import explicite.
 *
 * App1 a `@vueuse/nuxt`, qui rend chaque fonction de VueUse auto-importée ; Flowvent (app2) ne l'a
 * pas. Une fonction appelée sans import marche donc dans app1 et vaut `undefined` dans Flowvent :
 * le `setup` s'interrompt, la page sort en 500 (« useNow is not defined » sur la page d'un groupe
 * du stock, « reading 'loading' » sur la liste des artistes, dont le `setup` avait cassé sur
 * `useResizeObserver`). Rien d'autre ne le voyait : app1 n'en souffre pas, et app2 n'a pas de lint.
 */
const LAYERS = resolve(process.cwd(), '..', '..', 'layers')

// Les composables de Nuxt et de ses modules portent parfois le même nom qu'une fonction de VueUse :
// eux sont bien auto-importés des deux côtés.
const FOURNIS_PAR_NUXT = new Set([
  'useColorMode',
  'useDateFormat',
  'useFetch',
  'useHead',
  'useId',
  'useI18n',
  'useRoute',
  'useRouter',
  'useSeoMeta',
  'useState',
  'useToast',
])

const NOMS = Object.keys(vueuse).filter(
  (n) =>
    /^(use|on[A-Z]|watch[A-Z]|until|ref[A-Z]|computed[A-Z]|template[A-Z]|create[A-Z])/.test(n) &&
    !FOURNIS_PAR_NUXT.has(n)
)

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    if (nom === 'node_modules') return []
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) return fichiers(chemin)
    return /\.(vue|ts)$/.test(nom) ? [chemin] : []
  })
}

describe('layers partagés — VueUse par import explicite', () => {
  const sources = readdirSync(LAYERS)
    .filter((l) => statSync(join(LAYERS, l)).isDirectory() && l !== 'node_modules')
    .flatMap((l) => {
      const app = join(LAYERS, l, 'app')
      try {
        return statSync(app).isDirectory() ? fichiers(app) : []
      } catch {
        return []
      }
    })

  it('le balayage lit bien des fichiers et connaît VueUse', () => {
    expect(sources.length).toBeGreaterThan(300)
    expect(NOMS).toContain('useResizeObserver')
  })

  it('aucune fonction de VueUse appelée sans import', () => {
    const fautifs: string[] = []
    for (const f of sources) {
      const texte = readFileSync(f, 'utf8')
      for (const nom of NOMS) {
        const appel = new RegExp(`(^|[^.\\w])${nom}\\(`)
        if (!appel.test(texte)) continue
        // Depuis `#imports`, ce n'est pas un import explicite : c'est l'auto-import sous un autre
        // nom, et Flowvent n'y trouve pas VueUse (`useDebounce` des repas, lot 7).
        const importe = [
          ...texte.matchAll(
            new RegExp(`import\\s*\\{[^}]*\\b${nom}\\b[^}]*\\}\\s*from\\s*'([^']+)'`, 'g')
          ),
        ].some((m) => m[1] !== '#imports')
        const local = new RegExp(`(function|const|let) ${nom}\\b`).test(texte)
        if (!importe && !local) fautifs.push(`${f.slice(LAYERS.length + 1)} : ${nom}`)
      }
    }
    expect(fautifs).toEqual([])
  })
})
