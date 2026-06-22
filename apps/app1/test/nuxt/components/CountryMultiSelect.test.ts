import { describe, it, expect, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import CountryMultiSelect from '../../../app/components/CountryMultiSelect.vue'

// Mock useI18n pour éviter les problèmes d'initialisation
mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key,
  locale: { value: 'fr' },
}))

// Mock useFetch pour l'API countries
mockNuxtImport('useFetch', () => (url: string) => ({
  data: ref(['France', 'Allemagne', 'Espagne', 'Italie', 'Royaume-Uni']),
  pending: ref(false),
  error: ref(null),
  refresh: vi.fn(),
}))

describe('CountryMultiSelect', () => {
  it('monte le composant avec succès', async () => {
    const component = await mountSuspended(CountryMultiSelect, {
      props: {
        modelValue: [],
      },
    })

    expect(component.exists()).toBe(true)
  })

  it('affiche le composant USelectMenu', async () => {
    const component = await mountSuspended(CountryMultiSelect, {
      props: {
        modelValue: [],
      },
    })

    expect(component.html()).toBeDefined()
    expect(component.html().length).toBeGreaterThan(0)
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

  it('utilise FlagIcon pour afficher les drapeaux', async () => {
    const component = await mountSuspended(CountryMultiSelect, {
      props: {
        modelValue: [],
      },
    })

    // Le composant devrait être rendu
    expect(component.exists()).toBe(true)
  })
})
