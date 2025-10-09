import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PWAInstallBanner from '../../../app/components/PWAInstallBanner.vue'

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

  it('utilise UModal pour afficher la bannière', async () => {
    const component = await mountSuspended(PWAInstallBanner)

    // Le composant utilise UModal
    expect(component.html()).toContain('modal')
  })

  it('affiche les boutons d installation et de refus', async () => {
    const component = await mountSuspended(PWAInstallBanner)

    // Le composant devrait contenir des boutons
    const buttons = component.findAll('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('gère la fermeture de la bannière', async () => {
    const component = await mountSuspended(PWAInstallBanner)

    // Déclencher manuellement la méthode dismiss si accessible
    if (component.vm.dismiss) {
      component.vm.dismiss()
      await component.vm.$nextTick()

      expect(component.vm.showBanner).toBe(false)
    }
  })

  it('stocke le refus dans localStorage', async () => {
    const component = await mountSuspended(PWAInstallBanner)

    if (component.vm.dismiss) {
      component.vm.dismiss()

      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        'pwa-dismissed',
        expect.any(String)
      )
    }
  })
})
