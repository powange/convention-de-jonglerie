import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PushNotificationToggle from '~/components/notifications/PushNotificationToggle.vue'

describe('PushNotificationToggle', () => {
  beforeEach(() => {
    // Mock Notification API
    global.Notification = {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    } as any
  })

  it('affiche le toggle de notifications', async () => {
    const component = await mountSuspended(PushNotificationToggle, {
      props: {
        modelValue: false,
      },
    })

    const toggle = component.find('[role="switch"]')
    expect(toggle.exists()).toBe(true)
  })

  it("demande la permission lors de l'activation", async () => {
    const component = await mountSuspended(PushNotificationToggle, {
      props: {
        modelValue: false,
      },
    })

    const toggle = component.find('[role="switch"]')
    await toggle.trigger('click')

    expect(global.Notification.requestPermission).toHaveBeenCalled()
  })

  it('émet update:modelValue lors du changement', async () => {
    global.Notification.permission = 'granted'

    const component = await mountSuspended(PushNotificationToggle, {
      props: {
        modelValue: false,
      },
    })

    const toggle = component.find('[role="switch"]')
    await toggle.trigger('click')

    expect(component.emitted('update:modelValue')).toBeTruthy()
    expect(component.emitted('update:modelValue')?.[0]).toEqual([true])
  })

  it('affiche un message si les notifications sont bloquées', async () => {
    global.Notification.permission = 'denied'

    const component = await mountSuspended(PushNotificationToggle, {
      props: {
        modelValue: false,
      },
    })

    expect(component.text()).toContain('bloquées')
  })

  it('désactive le toggle si disabled est true', async () => {
    const component = await mountSuspended(PushNotificationToggle, {
      props: {
        modelValue: false,
        disabled: true,
      },
    })

    const toggle = component.find('[role="switch"]')
    expect(toggle.attributes('disabled')).toBeDefined()
  })

  it('affiche le label personnalisé si fourni', async () => {
    const component = await mountSuspended(PushNotificationToggle, {
      props: {
        modelValue: false,
        label: 'Activer les alertes',
      },
    })

    expect(component.text()).toContain('Activer les alertes')
  })

  it("gère l'erreur si la permission est refusée", async () => {
    global.Notification.requestPermission = vi.fn().mockResolvedValue('denied')

    const component = await mountSuspended(PushNotificationToggle, {
      props: {
        modelValue: false,
      },
    })

    const toggle = component.find('[role="switch"]')
    await toggle.trigger('click')

    expect(component.emitted('permission-denied')).toBeTruthy()
  })
})
