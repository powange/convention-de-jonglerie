import { config } from '@vue/test-utils'

// Configuration globale pour les tests
config.global.stubs = {
  // Stub des composants Nuxt UI si nécessaire
}

// Mock des composables Nuxt
vi.mock('#app', () => ({
  useRuntimeConfig: () => ({
    public: {},
    jwtSecret: 'test-secret',
    emailEnabled: 'false'
  }),
  navigateTo: vi.fn(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn()
  }),
  useRoute: () => ({
    params: {},
    query: {}
  })
}))

// Mock de Pinia
vi.mock('pinia', () => ({
  defineStore: vi.fn(),
  createPinia: () => ({
    use: vi.fn()
  })
}))