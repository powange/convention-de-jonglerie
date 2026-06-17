import { readdirSync, existsSync } from 'fs'
import { resolve } from 'path'

import { createApp, defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

// Tentative simplifiée: importer dynamiquement le composant page depuis app/pages (cœur ou layers)
// NOTE: Nuxt normally injects layouts, plugins, etc. Ici c'est un rendu très partiel (smoke)

/**
 * Construit les chemins de fichier candidats pour une route, dans le cœur (`app/pages`) et chaque
 * layer (`layers/<x>/app/pages`). Couvre les deux formes Nuxt — `route.vue` et `route/index.vue` —
 * ainsi que la substitution dynamique `/editions/:id/...` → `/editions/[id]/...`.
 */
function pageFileCandidates(routePath: string, rootDir: string): string[] {
  const relVariants = new Set<string>()
  const addRoute = (rp: string) => {
    const rel = rp === '/' ? 'index' : rp.replace(/^\//, '')
    relVariants.add(`${rel}.vue`)
    relVariants.add(`${rel}/index.vue`)
  }
  addRoute(routePath)
  const dyn = routePath.replace(/^(\/editions)\/[^/]+\//, '$1/[id]/')
  if (dyn !== routePath) addRoute(dyn)

  const baseDirs = [resolve(rootDir, 'app/pages')]
  const layersDir = resolve(rootDir, 'layers')
  if (existsSync(layersDir)) {
    for (const entry of readdirSync(layersDir, { withFileTypes: true })) {
      if (entry.isDirectory()) baseDirs.push(resolve(layersDir, entry.name, 'app/pages'))
    }
  }

  const files: string[] = []
  for (const base of baseDirs) for (const rel of relVariants) files.push(resolve(base, rel))
  return files
}

export async function renderRawPage(routePath: string) {
  // Utilise process.cwd() (racine projet lors de test:nuxt) pour éviter l'erreur "The URL must be of scheme file"
  const rootDir = process.cwd()
  let mod: any
  let importError: any = null
  for (const candidate of pageFileCandidates(routePath, rootDir)) {
    try {
      mod = await import(candidate)
      importError = null
      break
    } catch (e) {
      importError = e
    }
  }
  if (!mod) {
    const msg = `<error>Page import failed: ${String(importError)}</error>`
    return { html: () => msg, unmount: () => {} }
  }
  const Comp = mod.default || defineComponent({ render: () => h('div', 'Empty') })
  const el = document.createElement('div')
  const app = createApp(Comp, {})
  // i18n minimal pour supporter $t sans crash
  const i18n = createI18n({
    legacy: false,
    locale: 'fr',
    fallbackLocale: 'fr',
    messages: { fr: {}, en: {} },
    missingWarn: false,
    fallbackWarn: false,
  })
  app.use(i18n)
  // Pinia pour pages accédant aux stores
  const pinia = createPinia()
  app.use(pinia)

  // Router minimal pour supporter useRoute() et params
  const routes = [
    // Routes dynamiques principales (définies avant toute route spécifique pour capter les params)
    { path: '/editions/:id/gestion', component: Comp },
    { path: '/editions/:id/edit', component: Comp },
    { path: '/editions/:id/lost-found', component: Comp },
    { path: '/editions/:id/commentaires', component: Comp },
    { path: '/editions/:id/carpool', component: Comp },
    // Route demandée en dernier (si non couverte par dynamique) afin de ne pas masquer les params
    { path: routePath, component: Comp },
  ]
  const router = createRouter({ history: createMemoryHistory(), routes })
  app.use(router)

  // Stub global $fetch pour éviter erreurs réseau
  const originalFetch = (globalThis as any).$fetch
  ;(globalThis as any).$fetch = async (input: any, opts?: any) => {
    try {
      const url = typeof input === 'string' ? input : input?.toString?.() || ''
      const editionMatch = url.match(/\/api\/editions\/(\d+)$/)
      if (editionMatch) {
        const id = parseInt(editionMatch[1])
        return {
          id,
          name: `Edition ${id}`,
          conventionId: 1,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000).toISOString(),
          services: {},
          favoritedBy: [],
          convention: {
            id: 1,
            name: `Convention ${id}`,
          },
        }
      }
      // Mock pour /api/conventions/my-conventions
      if (url === '/api/conventions/my-conventions') {
        return [
          {
            id: 1,
            name: 'Test Convention 1',
          },
          {
            id: 2,
            name: 'Test Convention 2',
          },
        ]
      }
      // Retour vide générique (array vide pour éviter .map errors)
      return []
    } catch (e) {
      return []
    }
  }

  // Stub useFetch pour les pages SSR
  ;(globalThis as any).useFetch = async (url: any) => {
    const data = await (globalThis as any).$fetch(url)
    return {
      data: { value: data },
      pending: { value: false },
      error: { value: null },
      refresh: () => Promise.resolve(),
    }
  }
  // Stub fetch global si absent
  if (!(globalThis as any).fetch) {
    ;(globalThis as any).fetch = async () => ({ ok: true, json: async () => ({}) })
  }

  await router.push(routePath)
  await router.isReady()
  app.mount(el)
  return {
    html: () => el.innerHTML,
    unmount: () => app.unmount(),
  }
}
