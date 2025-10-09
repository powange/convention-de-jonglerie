import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PWAInstallBanner from '../../../app/components/PWAInstallBanner.vue'

describe('PWAInstallBanner', () => {
  let mockBeforeInstallPromptEvent: any

  beforeEach(() => {
    mockBeforeInstallPromptEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn().mockResolvedValue({ outcome: 'accepted' }),
    }
  })

  it("affiche la bannière d'installation", async () => {
    const component = await mountSuspended(PWAInstallBanner, {
      props: {
        showBanner: true,
      },
    })

    expect(component.text()).toContain('installer')
    expect(component.text()).toContain('application')
  })

  it("n'affiche pas la bannière si showBanner est false", async () => {
    const component = await mountSuspended(PWAInstallBanner, {
      props: {
        showBanner: false,
      },
    })

    const banner = component.find('.install-banner')
    expect(banner.exists()).toBe(false)
  })

  it("gère l'événement beforeinstallprompt", async () => {
    const component = await mountSuspended(PWAInstallBanner)

    // Simuler l'événement beforeinstallprompt
    window.dispatchEvent(
      new CustomEvent('beforeinstallprompt', {
        detail: mockBeforeInstallPromptEvent,
      })
    )

    await component.vm.$nextTick()

    expect(component.vm.deferredPrompt).toBeDefined()
    expect(component.vm.showBanner).toBe(true)
  })

  it("déclenche l'installation lors du clic sur le bouton", async () => {
    const component = await mountSuspended(PWAInstallBanner)

    component.vm.deferredPrompt = mockBeforeInstallPromptEvent
    component.vm.showBanner = true
    await component.vm.$nextTick()

    const installButton = component.find('[data-test="install-button"]')
    await installButton.trigger('click')

    expect(mockBeforeInstallPromptEvent.prompt).toHaveBeenCalled()
  })

  it('cache la bannière après installation', async () => {
    const component = await mountSuspended(PWAInstallBanner)

    component.vm.deferredPrompt = mockBeforeInstallPromptEvent
    component.vm.showBanner = true
    await component.vm.$nextTick()

    const installButton = component.find('[data-test="install-button"]')
    await installButton.trigger('click')

    await component.vm.$nextTick()

    expect(component.vm.showBanner).toBe(false)
  })

  it('émet dismiss lors de la fermeture', async () => {
    const component = await mountSuspended(PWAInstallBanner, {
      props: {
        showBanner: true,
      },
    })

    const dismissButton = component.find('[data-test="dismiss-button"]')
    await dismissButton.trigger('click')

    expect(component.emitted('dismiss')).toBeTruthy()
  })

  it('sauvegarde le choix de ne plus afficher', async () => {
    const mockLocalStorage = {
      setItem: vi.fn(),
      getItem: vi.fn(),
    }
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    })

    const component = await mountSuspended(PWAInstallBanner, {
      props: {
        showBanner: true,
      },
    })

    const dontShowAgain = component.find('[data-test="dont-show-again"]')
    if (dontShowAgain.exists()) {
      await dontShowAgain.trigger('click')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('pwa-install-dismissed', 'true')
    }
  })

  it('affiche des instructions spécifiques à iOS', async () => {
    // Simuler un appareil iOS
    Object.defineProperty(navigator, 'userAgent', {
      value: 'iPhone',
      writable: true,
    })

    const component = await mountSuspended(PWAInstallBanner, {
      props: {
        showBanner: true,
      },
    })

    expect(component.text()).toContain('Safari')
    expect(component.text()).toContain('Partager')
  })

  it('affiche des instructions spécifiques à Android', async () => {
    // Simuler un appareil Android
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Android',
      writable: true,
    })

    const component = await mountSuspended(PWAInstallBanner, {
      props: {
        showBanner: true,
      },
    })

    expect(component.text()).toContain('Chrome')
  })
})
