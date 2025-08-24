import { createApp, defineComponent, h } from 'vue'
import { fileURLToPath } from 'url'
import { resolve } from 'path'

// Tentative simplifiée: importer dynamiquement le composant page depuis app/pages
// NOTE: Nuxt normally injects layouts, plugins, etc. Ici c'est un rendu très partiel (smoke)

export async function renderRawPage(routePath: string) {
  // Convertit /login -> login.vue, / -> index.vue, /editions/add -> editions/add.vue
  const pageRelative = routePath === '/' ? 'index.vue' : `${routePath.replace(/^\//, '')}.vue`
  const rootDir = fileURLToPath(new URL('../../..', import.meta.url)) // remonte vers racine projet
  const pageFile = resolve(rootDir, 'app/pages', pageRelative)
  let mod: any
  try {
    mod = await import(pageFile)
  } catch (e) {
    const msg = `<error>Page import failed: ${String(e)}</error>`
    return { html: () => msg, unmount: () => {} }
  }
  const Comp = mod.default || defineComponent({ render: () => h('div', 'Empty') })
  const el = document.createElement('div')
  const app = createApp(Comp, {})
  app.mount(el)
  return {
    html: () => el.innerHTML,
    unmount: () => app.unmount(),
  }
}
