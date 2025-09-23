import { createApp, defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { resolve } from 'path'

// Tentative simplifiée: importer dynamiquement le composant page depuis app/pages
// NOTE: Nuxt normally injects layouts, plugins, etc. Ici c'est un rendu très partiel (smoke)

export async function renderRawPage(routePath: string) {
  // Convertit /login -> login.vue, / -> index.vue, /editions/add -> editions/add.vue
  const pageRelative = routePath === '/' ? 'index.vue' : `${routePath.replace(/^\//, '')}.vue`
  // Utilise process.cwd() (racine projet lors de test:nuxt) pour éviter l'erreur "The URL must be of scheme file"
  const rootDir = process.cwd()
  const pageFile = resolve(rootDir, 'app/pages', pageRelative)
  let mod: any
  let importError: any = null
  try {
    mod = await import(pageFile)
  } catch (e) {
    importError = e
    // Fallback dynamique pour /editions/:id/... => /editions/[id]/...
    const editionsDyn = routePath.replace(/^(\/editions)\/[^/]+\//, '$1/[id]/')
    if (editionsDyn !== routePath) {
      const dynRelative =
        editionsDyn === '/' ? 'index.vue' : `${editionsDyn.replace(/^\//, '')}.vue`
      const dynFile = resolve(rootDir, 'app/pages', dynRelative)
      try {
        mod = await import(dynFile)
        importError = null
      } catch (e2) {
        importError = e2
      }
    }
    if (importError) {
      const msg = `<error>Page import failed: ${String(importError)}</error>`
      return { html: () => msg, unmount: () => {} }
    }
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
    { path: '/editions/:id/objets-trouves', component: Comp },
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
      // Retour vide générique
      return {}
    } catch (e) {
      return {}
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
