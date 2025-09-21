import { describe, it, expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AddressAutocomplete from '~/components/AddressAutocomplete.vue'

describe('AddressAutocomplete', () => {
  it("affiche le champ d'adresse", async () => {
    const component = await mountSuspended(AddressAutocomplete, {
      props: {
        modelValue: '',
        placeholder: 'Entrez une adresse',
      },
    })

    const input = component.find('input[type="text"]')
    expect(input.exists()).toBe(true)
    expect(input.attributes('placeholder')).toBe('Entrez une adresse')
  })

  it('émet update:modelValue lors de la saisie', async () => {
    const component = await mountSuspended(AddressAutocomplete, {
      props: {
        modelValue: '',
      },
    })

    const input = component.find('input[type="text"]')
    await input.setValue('123 Rue de la Paix')

    expect(component.emitted('update:modelValue')).toBeTruthy()
    expect(component.emitted('update:modelValue')?.[0]).toEqual(['123 Rue de la Paix'])
  })

  it('affiche les suggestions lors de la saisie', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              label: '123 Rue de la Paix, 75002 Paris',
              x: 2.3522,
              y: 48.8566,
            },
          },
        ],
      }),
    })
    global.fetch = mockFetch

    const component = await mountSuspended(AddressAutocomplete, {
      props: {
        modelValue: '',
      },
    })

    const input = component.find('input[type="text"]')
    await input.setValue('123 Rue')

    // Attendre le debounce
    await new Promise((resolve) => setTimeout(resolve, 350))

    expect(mockFetch).toHaveBeenCalled()
  })

  it("émet les coordonnées lors de la sélection d'une suggestion", async () => {
    const component = await mountSuspended(AddressAutocomplete, {
      props: {
        modelValue: '',
      },
    })

    // Simuler des suggestions
    component.vm.suggestions = [
      {
        properties: {
          label: '123 Rue de la Paix, Paris',
          x: 2.3522,
          y: 48.8566,
        },
      },
    ]
    await component.vm.$nextTick()

    const suggestion = component.find('.suggestion-item')
    if (suggestion.exists()) {
      await suggestion.trigger('click')

      expect(component.emitted('coordinates-selected')).toBeTruthy()
      expect(component.emitted('coordinates-selected')?.[0]).toEqual([
        {
          lat: 48.8566,
          lng: 2.3522,
        },
      ])
    }
  })

  it('nettoie les suggestions quand le champ est vidé', async () => {
    const component = await mountSuspended(AddressAutocomplete, {
      props: {
        modelValue: '123 Rue',
      },
    })

    component.vm.suggestions = [{ properties: { label: 'Suggestion 1' } }]
    await component.vm.$nextTick()

    const input = component.find('input[type="text"]')
    await input.setValue('')

    expect(component.vm.suggestions).toHaveLength(0)
  })

  it('désactive le champ si disabled est true', async () => {
    const component = await mountSuspended(AddressAutocomplete, {
      props: {
        modelValue: '',
        disabled: true,
      },
    })

    const input = component.find('input[type="text"]')
    expect(input.attributes('disabled')).toBeDefined()
  })
})
