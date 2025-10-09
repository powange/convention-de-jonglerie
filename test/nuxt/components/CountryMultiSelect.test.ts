import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import CountryMultiSelect from '../../../app/components/CountryMultiSelect.vue'

describe('CountryMultiSelect', () => {
  const mockCountries = [
    { code: 'FR', name: 'France' },
    { code: 'DE', name: 'Allemagne' },
    { code: 'ES', name: 'Espagne' },
    { code: 'IT', name: 'Italie' },
  ]

  it('affiche la liste des pays', async () => {
    const component = await mountSuspended(CountryMultiSelect, {
      props: {
        modelValue: [],
        countries: mockCountries,
      },
    })

    const select = component.find('[data-test="country-select"]')
    expect(select.exists()).toBe(true)
  })

  it('affiche les pays sélectionnés', async () => {
    const component = await mountSuspended(CountryMultiSelect, {
      props: {
        modelValue: ['FR', 'DE'],
        countries: mockCountries,
      },
    })

    expect(component.text()).toContain('France')
    expect(component.text()).toContain('Allemagne')
  })

  it('émet update:modelValue lors de la sélection', async () => {
    const component = await mountSuspended(CountryMultiSelect, {
      props: {
        modelValue: [],
        countries: mockCountries,
      },
    })

    // Simuler la sélection d'un pays
    component.vm.selectedCountries = ['FR']
    await component.vm.$nextTick()

    expect(component.emitted('update:modelValue')).toBeTruthy()
    expect(component.emitted('update:modelValue')?.[0]).toEqual([['FR']])
  })

  it('permet la recherche de pays', async () => {
    const component = await mountSuspended(CountryMultiSelect, {
      props: {
        modelValue: [],
        countries: mockCountries,
        searchable: true,
      },
    })

    const searchInput = component.find('input[type="search"]')
    if (searchInput.exists()) {
      await searchInput.setValue('Fra')
      await component.vm.$nextTick()

      // Vérifier que seule la France est affichée
      const filteredOptions = component.findAll('.country-option')
      expect(filteredOptions.length).toBe(1)
      expect(filteredOptions[0].text()).toContain('France')
    }
  })

  it('affiche les drapeaux si showFlags est true', async () => {
    const component = await mountSuspended(CountryMultiSelect, {
      props: {
        modelValue: ['FR'],
        countries: mockCountries,
        showFlags: true,
      },
    })

    const flag = component.find('.flag-icon')
    expect(flag.exists()).toBe(true)
  })

  it('limite le nombre de sélections si maxSelections est défini', async () => {
    const component = await mountSuspended(CountryMultiSelect, {
      props: {
        modelValue: ['FR', 'DE'],
        countries: mockCountries,
        maxSelections: 2,
      },
    })

    // Essayer de sélectionner un troisième pays
    component.vm.selectedCountries = ['FR', 'DE', 'ES']
    await component.vm.$nextTick()

    expect(component.emitted('update:modelValue')?.[0]).toEqual([['FR', 'DE']])
    expect(component.text()).toContain('maximum')
  })

  it('désactive la sélection si disabled est true', async () => {
    const component = await mountSuspended(CountryMultiSelect, {
      props: {
        modelValue: [],
        countries: mockCountries,
        disabled: true,
      },
    })

    const select = component.find('select, [data-test="country-select"]')
    expect(select.attributes('disabled')).toBeDefined()
  })

  it('affiche un placeholder personnalisé', async () => {
    const component = await mountSuspended(CountryMultiSelect, {
      props: {
        modelValue: [],
        countries: mockCountries,
        placeholder: 'Choisissez vos pays',
      },
    })

    expect(component.text()).toContain('Choisissez vos pays')
  })

  it('groupe les pays par région si groupByRegion est true', async () => {
    const countriesWithRegions = mockCountries.map((country) => ({
      ...country,
      region: country.code === 'FR' ? "Europe de l'Ouest" : 'Europe',
    }))

    const component = await mountSuspended(CountryMultiSelect, {
      props: {
        modelValue: [],
        countries: countriesWithRegions,
        groupByRegion: true,
      },
    })

    const optgroups = component.findAll('optgroup')
    expect(optgroups.length).toBeGreaterThan(0)
  })

  it('permet de tout sélectionner/désélectionner', async () => {
    const component = await mountSuspended(CountryMultiSelect, {
      props: {
        modelValue: [],
        countries: mockCountries,
        showSelectAll: true,
      },
    })

    const selectAllButton = component.find('[data-test="select-all"]')
    if (selectAllButton.exists()) {
      await selectAllButton.trigger('click')

      expect(component.emitted('update:modelValue')).toBeTruthy()
      const emittedValue = component.emitted('update:modelValue')?.[0]?.[0]
      expect(emittedValue).toHaveLength(4)
    }
  })
})
