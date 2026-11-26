import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/*
 * ⚠️ Lu COMME DU TEXTE puis transpilé, et non importé : un fichier TypeScript d'app2 ne se
 * transforme qu'avec le tsconfig que Nuxt génère dans `apps/app2/.nuxt`, absent de la CI d'app1
 * (« Tsconfig not found »). Même raison que les gardes `flowvent-*` de test/unit/outillage.
 */
const source = readFileSync(
  resolve(__dirname, '../../../../app2/shared/utils/offline-cache.ts'),
  'utf8'
)
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
})
const module_: Record<string, any> = {}
new Function('exports', outputText)(module_)
const classifyRequest = module_.classifyRequest as (
  url: string,
  destination: string,
  origin: string
) => string | null
const serviceWorkerUrl = module_.serviceWorkerUrl as (buildId?: string) => string
const shouldPrecachePage = module_.shouldPrecachePage as (pathname: string) => boolean

/**
 * Le cache hors ligne de Flowvent (`apps/app2/shared/utils/offline-cache.ts`).
 *
 * Son classement est injecté dans le service worker par son SOURCE : il doit se suffire à
 * lui-même. Et il ne doit garder ni les données privées d'un événement ni ce que l'API rend de
 * périssable — seulement la carte du site, les fichiers de build, les traductions, les icônes,
 * les pages parcourues et les tuiles affichées.
 */
describe('Flowvent — cache hors ligne', () => {
  const O = 'https://flowvent.org'

  it('se suffit à lui-même (injectable dans le worker)', () => {
    const isolee = new Function(
      `return (${classifyRequest.toString()})`
    )() as typeof classifyRequest
    expect(isolee(`${O}/_nuxt-9f3a1c/abc.js`, 'script', O)).toBe('asset')
    expect(isolee(`${O}/`, 'document', O)).toBe('page')
  })

  it('garde les fichiers durables et les pages', () => {
    expect(classifyRequest(`${O}/_nuxt/abc.js`, 'script', O)).toBe('asset')
    expect(classifyRequest(`${O}/_i18n/fr/messages.json`, 'fetch', O)).toBe('asset')
    expect(classifyRequest(`${O}/api/_nuxt_icon/heroicons.json`, 'fetch', O)).toBe('asset')
    expect(classifyRequest(`${O}/events/abc/volunteers`, 'document', O)).toBe('page')
  })

  it('garde la carte du site et ses tuiles', () => {
    expect(classifyRequest(`${O}/api/editions/12/zones`, 'fetch', O)).toBe('map-data')
    expect(classifyRequest(`${O}/api/editions/12/markers`, 'fetch', O)).toBe('map-data')
    expect(classifyRequest('https://tile.openstreetmap.org/1/2/3.png', 'image', O)).toBe('tile')
  })

  it("ne garde rien d'autre de l'API, ni d'un autre site", () => {
    expect(classifyRequest(`${O}/api/editions/12`, 'fetch', O)).toBeNull()
    expect(classifyRequest(`${O}/api/events/abc/edition`, 'fetch', O)).toBeNull()
    expect(classifyRequest('https://exemple.org/x.js', 'script', O)).toBeNull()
  })

  it("ne met de côté d'office que l'accueil, page publique", () => {
    expect(shouldPrecachePage('/')).toBe(true)
    expect(shouldPrecachePage('/dashboard')).toBe(false)
  })

  it("change l'adresse du worker à chaque build", () => {
    expect(serviceWorkerUrl('a1b2')).toBe('/sw.js?build=a1b2')
    expect(serviceWorkerUrl(undefined)).toBe('/sw.js')
  })
})
