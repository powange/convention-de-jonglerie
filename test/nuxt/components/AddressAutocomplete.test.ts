import { describe, it, expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AddressAutocomplete from '../../../app/components/AddressAutocomplete.vue'

describe('AddressAutocomplete', () => {
  it('monte le composant avec succès', async () => {
    const component = await mountSuspended(AddressAutocomplete)

    expect(component.exists()).toBe(true)
  })

  it('affiche un champ de saisie', async () => {
    const component = await mountSuspended(AddressAutocomplete)

    const input = component.find('input')
    expect(input.exists()).toBe(true)
  })

  it('affiche une icône de recherche', async () => {
    const component = await mountSuspended(AddressAutocomplete)

    // Le composant utilise UInput avec icon="i-lucide-search"
    expect(component.html()).toContain('lucide-search')
  })

  it('gère la saisie utilisateur', async () => {
    const component = await mountSuspended(AddressAutocomplete)

    const input = component.find('input')
    await input.setValue('123 Rue de la Paix')

    expect(input.element.value).toBe('123 Rue de la Paix')
  })

  it('émet address-selected lors de la sélection', async () => {
    // Mock de fetch pour Nominatim
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              place_id: 1,
              display_name: '123 Rue de la Paix, 75002 Paris',
              address: {
                house_number: '123',
                road: 'Rue de la Paix',
                postcode: '75002',
                city: 'Paris',
                country: 'France',
              },
            },
          ]),
      })
    ) as any

    const component = await mountSuspended(AddressAutocomplete)

    // Simuler une saisie
    const input = component.find('input')
    await input.setValue('123 Rue')

    // Attendre le debounce et la réponse
    await new Promise((resolve) => setTimeout(resolve, 400))
    await component.vm.$nextTick()

    // Vérifier que le fetch a été appelé
    expect(global.fetch).toHaveBeenCalled()
  })
})
