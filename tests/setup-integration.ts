import { vi } from 'vitest'

// Mocks Nuxt minimaux pour exécuter des tests Node avec Prisma sans charger Nuxt
vi.mock('#app', () => ({
  useRuntimeConfig: () => ({
    public: {},
    jwtSecret: 'test-secret',
    emailEnabled: 'false'
  }),
  navigateTo: vi.fn(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useRoute: () => ({ params: {}, query: {}, path: '/test' }),
  defineNuxtPlugin: (plugin: any) => plugin,
  useNuxtApp: () => ({
    $pinia: {},
    vueApp: {},
    // Certains modules appellent nuxtApp.runWithContext
    runWithContext: (fn: any) => fn(),
    hook: vi.fn()
  })
}))

vi.mock('#imports', () => ({
  createError: (options: any) => {
    const error: any = new Error(options.statusMessage || options.message)
    error.statusCode = options.statusCode
    error.data = options.data
    return error
  }
}))

// Eviter le chargement réel de @nuxtjs/i18n pendant ces tests
vi.mock('@nuxtjs/i18n', () => ({}))

// Mock global de $fetch pour les tests d'intégration
// On garde une implémentation neutre pour ne pas casser les tests qui l'invoquent
// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.$fetch = vi.fn(async (_req?: any, _options?: any) => ({ ok: true }))

// Mock des composables Nuxt courants utilisés dans le code côté serveur éventuellement importé
// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.useCookie = vi.fn(() => ({ value: null })) as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.useRoute = vi.fn(() => ({ path: '/test' })) as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.useRouter = vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })) as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.navigateTo = vi.fn() as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.useRuntimeConfig = vi.fn(() => ({
  public: {},
  jwtSecret: 'test-secret',
  emailEnabled: 'false'
})) as any

export {}