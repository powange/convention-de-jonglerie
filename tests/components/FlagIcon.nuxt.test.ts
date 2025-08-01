import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import FlagIcon from '~/components/FlagIcon.vue'

describe('FlagIcon', () => {
  it('devrait afficher le drapeau avec le bon code pays', async () => {
    const wrapper = await mountSuspended(FlagIcon, {
      props: {
        code: 'fr'
      }
    })

    expect(wrapper.find('span').classes()).toContain('fi')
    expect(wrapper.find('span').classes()).toContain('fi-fr')
    expect(wrapper.find('span').classes()).toContain('flag-icon')
  })

  it('devrait appliquer les styles corrects', async () => {
    const wrapper = await mountSuspended(FlagIcon, {
      props: {
        code: 'us'
      }
    })

    const flagElement = wrapper.find('span')
    expect(flagElement.exists()).toBe(true)
    expect(flagElement.classes()).toContain('fi-us')
  })

  it('devrait changer de drapeau quand le code change', async () => {
    const wrapper = await mountSuspended(FlagIcon, {
      props: {
        code: 'fr'
      }
    })

    expect(wrapper.find('span').classes()).toContain('fi-fr')

    await wrapper.setProps({ code: 'gb' })
    
    expect(wrapper.find('span').classes()).toContain('fi-gb')
    expect(wrapper.find('span').classes()).not.toContain('fi-fr')
  })
})