import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import FlagIcon from '../../../app/components/FlagIcon.vue'

describe('FlagIcon', () => {
  it('affiche le drapeau pour un code pays valide', async () => {
    const component = await mountSuspended(FlagIcon, {
      props: {
        code: 'FR',
      },
    })

    const flag = component.find('.flag-icon')
    expect(flag.exists()).toBe(true)
    expect(flag.classes()).toContain('fi')
    expect(flag.classes()).toContain('fi-fr')
  })

  it('normalise le code pays en minuscules', async () => {
    const component = await mountSuspended(FlagIcon, {
      props: {
        code: 'GB',
      },
    })

    const flag = component.find('.flag-icon')
    expect(flag.classes()).toContain('fi-gb')
  })

  it('gère les codes pays en minuscules', async () => {
    const component = await mountSuspended(FlagIcon, {
      props: {
        code: 'de',
      },
    })

    const flag = component.find('.flag-icon')
    expect(flag.classes()).toContain('fi-de')
  })

  it('affiche seulement la classe de base pour un code vide', async () => {
    const component = await mountSuspended(FlagIcon, {
      props: {
        code: '',
      },
    })

    const flag = component.find('.flag-icon')
    expect(flag.exists()).toBe(true)
    expect(flag.classes()).toContain('fi')
  })

  it('affiche le code pays en attribut title', async () => {
    const component = await mountSuspended(FlagIcon, {
      props: {
        code: 'ES',
      },
    })

    const flag = component.find('.flag-icon')
    expect(flag.attributes('title')).toBe('es')
  })

  it('gère les codes null ou undefined', async () => {
    const component = await mountSuspended(FlagIcon, {
      props: {
        code: null,
      },
    })

    const flag = component.find('.flag-icon')
    expect(flag.exists()).toBe(true)
    expect(flag.classes()).toContain('fi')
  })

  it('tronque les codes pays à 2 caractères', async () => {
    const component = await mountSuspended(FlagIcon, {
      props: {
        code: 'FRA',
      },
    })

    const flag = component.find('.flag-icon')
    expect(flag.classes()).toContain('fi-fr')
  })
})
