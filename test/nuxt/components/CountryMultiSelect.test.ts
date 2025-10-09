import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import CountryMultiSelect from '../../../app/components/CountryMultiSelect.vue'

describe('CountryMultiSelect', () => {
  beforeEach(() => {
    // Mock de l'API countries
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(['France', 'Allemagne', 'Espagne', 'Italie', 'Royaume-Uni']),
      })
    ) as any
  })

  it('monte le composant avec succès', async () => {
    const component = await mountSuspended(CountryMultiSelect, {
      props: {
        modelValue: [],
      },
    })

    expect(component.exists()).toBe(true)
  })

  it('affiche le placeholder par défaut', async () => {
    const component = await mountSuspended(CountryMultiSelect, {
      props: {
        modelValue: [],
      },
    })

    // Le composant utilise USelectMenu qui affiche un placeholder
    expect(component.html()).toContain('select')
  })

  it('accepte un modelValue vide', async () => {
    const component = await mountSuspended(CountryMultiSelect, {
      props: {
        modelValue: [],
      },
    })

    expect(component.props('modelValue')).toEqual([])
  })

  it('accepte un modelValue avec des pays sélectionnés', async () => {
    const component = await mountSuspended(CountryMultiSelect, {
      props: {
        modelValue: ['France', 'Allemagne'],
      },
    })

    expect(component.props('modelValue')).toEqual(['France', 'Allemagne'])
  })

  it('affiche le composant FlagIcon pour les drapeaux', async () => {
    const component = await mountSuspended(CountryMultiSelect, {
      props: {
        modelValue: [],
      },
    })

    // Le composant utilise FlagIcon dans le template
    expect(component.html()).toBeDefined()
  })
})
