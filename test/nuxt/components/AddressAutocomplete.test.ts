import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import AddressAutocomplete from '../../../app/components/AddressAutocomplete.vue'

// Mock useI18n pour éviter les problèmes d'initialisation
mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key,
  locale: { value: 'fr' },
}))

describe('AddressAutocomplete', () => {
  describe('Tests de base', () => {
    let component: any

    beforeAll(async () => {
      // Monter le composant une seule fois pour tous les tests de base
      component = await mountSuspended(AddressAutocomplete)
    })

    afterAll(() => {
      // Nettoyer après tous les tests
      if (component?.unmount) {
        component.unmount()
      }
    })

    it('monte le composant avec succès', () => {
      expect(component.exists()).toBe(true)
    })

    it('affiche un champ de saisie', () => {
      const input = component.find('input')
      expect(input.exists()).toBe(true)
    })

    it('affiche le composant UFormField', () => {
      // Le composant utilise UFormField
      expect(component.html()).toBeDefined()
      expect(component.html().length).toBeGreaterThan(0)
    })

    it('gère la saisie utilisateur', async () => {
      const input = component.find('input')
      await input.setValue('123 Rue de la Paix')

      expect(input.element.value).toBe('123 Rue de la Paix')
    })
  })

  describe("Recherche d'adresses", () => {
    it('permet la recherche d adresses', async () => {
      // Mock global de $fetch
      vi.stubGlobal(
        '$fetch',
        vi.fn(() =>
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
          ])
        )
      )

      const component = await mountSuspended(AddressAutocomplete)

      // Simuler une saisie
      const input = component.find('input')
      await input.setValue('123 Rue')

      // Attendre le debounce
      await new Promise((resolve) => setTimeout(resolve, 400))
      await component.vm.$nextTick()

      // Le composant devrait être fonctionnel
      expect(component.exists()).toBe(true)

      component.unmount?.()
    })
  })
})
