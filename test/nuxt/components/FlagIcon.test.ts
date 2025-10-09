import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import FlagIcon from '../../../app/components/FlagIcon.vue'

describe('FlagIcon', () => {
  it('affiche le drapeau pour un code pays valide', async () => {
    const component = await mountSuspended(FlagIcon, {
      props: {
        country: 'FR',
      },
    })

    const flag = component.find('.flag-icon')
    expect(flag.exists()).toBe(true)
    expect(flag.classes()).toContain('flag-icon-fr')
  })

  it('applique la taille spécifiée', async () => {
    const component = await mountSuspended(FlagIcon, {
      props: {
        country: 'GB',
        size: 'lg',
      },
    })

    const flag = component.find('.flag-icon')
    expect(flag.classes()).toContain('flag-icon-lg')
  })

  it('gère les codes pays en minuscules', async () => {
    const component = await mountSuspended(FlagIcon, {
      props: {
        country: 'de',
      },
    })

    const flag = component.find('.flag-icon')
    expect(flag.classes()).toContain('flag-icon-de')
  })

  it('affiche un placeholder pour un code pays invalide', async () => {
    const component = await mountSuspended(FlagIcon, {
      props: {
        country: 'XX',
      },
    })

    const placeholder = component.find('.flag-placeholder')
    expect(placeholder.exists()).toBe(true)
  })

  it('affiche le nom du pays en tooltip si showTooltip est true', async () => {
    const component = await mountSuspended(FlagIcon, {
      props: {
        country: 'ES',
        showTooltip: true,
      },
    })

    const wrapper = component.find('[title]')
    expect(wrapper.attributes('title')).toBe('Espagne')
  })

  it('applique les classes CSS supplémentaires', async () => {
    const component = await mountSuspended(FlagIcon, {
      props: {
        country: 'IT',
        class: 'custom-class',
      },
    })

    const flag = component.find('.flag-icon')
    expect(flag.classes()).toContain('custom-class')
  })

  it('utilise le format carré si square est true', async () => {
    const component = await mountSuspended(FlagIcon, {
      props: {
        country: 'NL',
        square: true,
      },
    })

    const flag = component.find('.flag-icon')
    expect(flag.classes()).toContain('flag-icon-squared')
  })
})
