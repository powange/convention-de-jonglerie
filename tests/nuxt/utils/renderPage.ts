import { createApp, defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'
import { createPinia } from 'pinia'
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
  try {
    mod = await import(pageFile)
  } catch (e) {
    const msg = `<error>Page import failed: ${String(e)}</error>`
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
  app.mount(el)
  return {
    html: () => el.innerHTML,
    unmount: () => app.unmount(),
  }
}
