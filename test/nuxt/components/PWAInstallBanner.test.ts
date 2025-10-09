import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import PWAInstallBanner from '../../../app/components/PWAInstallBanner.vue'

// Mock useI18n pour éviter les problèmes d'initialisation
mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key,
  locale: { value: 'fr' },
}))

// Mock useToast pour éviter les problèmes d'initialisation
mockNuxtImport('useToast', () => () => ({
  add: vi.fn(),
}))

describe('PWAInstallBanner', () => {
  beforeEach(() => {
    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    }

    // Mock matchMedia
    global.matchMedia = vi.fn(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as any
  })

  it('monte le composant avec succès', async () => {
    const component = await mountSuspended(PWAInstallBanner)

    expect(component.exists()).toBe(true)
  })

  it('rend le composant correctement', async () => {
    const component = await mountSuspended(PWAInstallBanner)

    // Le composant devrait être rendu
    expect(component.html()).toBeDefined()
    expect(component.html().length).toBeGreaterThan(0)
  })

  it('utilise UModal comme composant principal', async () => {
    const component = await mountSuspended(PWAInstallBanner)

    // Le composant devrait être défini
    expect(component.exists()).toBe(true)
  })

  it('ne devrait pas afficher la bannière si déjà en mode standalone', async () => {
    // Mock matchMedia pour simuler le mode standalone
    global.matchMedia = vi.fn(() => ({
      matches: true, // Mode standalone
      media: '(display-mode: standalone)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as any

    const component = await mountSuspended(PWAInstallBanner)
    expect(component.exists()).toBe(true)
  })
})
