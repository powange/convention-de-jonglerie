import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import CarteRepliable from '../../../../../../layers/volunteers/app/components/edition/volunteer/CarteRepliable.vue'

/**
 * `useMediaQuery` interroge le navigateur, qui n'existe pas ici : on décide donc de la largeur
 * en simulant la réponse de la media query, exactement ce que fait le CSS.
 */
const simulerLargeur = (bureau: boolean) => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: bureau,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}

const monter = (props: Record<string, unknown> = {}) =>
  mountSuspended(CarteRepliable, {
    props: { titre: 'Mes Créneaux', icone: 'i-heroicons-clock', ...props },
    slots: { default: () => 'contenu de la carte' },
  })

describe('CarteRepliable', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  describe('sur grand écran', () => {
    beforeEach(() => simulerLargeur(true))

    it('laisse la carte entière, même quand le repli est proposé', async () => {
      const carte = await monter({ repliableSurMobile: true })

      // Le titre reste un titre : rien à cliquer, rien à déplier.
      expect(carte.find('h3').exists()).toBe(true)
      expect(carte.find('button').exists()).toBe(false)
      expect(carte.text()).toContain('contenu de la carte')
    })
  })

  describe('sur petit écran', () => {
    beforeEach(() => simulerLargeur(false))

    it('ne replie rien tant que la carte ne le propose pas', async () => {
      const carte = await monter()

      expect(carte.find('button').exists()).toBe(false)
      expect(carte.text()).toContain('contenu de la carte')
    })

    it('replie la carte par défaut quand elle le propose', async () => {
      const carte = await monter({ repliableSurMobile: true })

      expect(carte.find('button').exists()).toBe(true)
      expect(carte.find('button').attributes('aria-expanded')).toBe('false')
    })

    it('ouvre d’emblée celle qui le demande', async () => {
      const carte = await monter({ repliableSurMobile: true, deplieParDefaut: true })

      expect(carte.find('button').attributes('aria-expanded')).toBe('true')
    })

    it('déplie et replie au clic sur l’en-tête', async () => {
      const carte = await monter({ repliableSurMobile: true })

      await carte.find('button').trigger('click')
      expect(carte.find('button').attributes('aria-expanded')).toBe('true')

      await carte.find('button').trigger('click')
      expect(carte.find('button').attributes('aria-expanded')).toBe('false')
    })

    it('garde le contenu monté une fois replié', async () => {
      // Les cartes chargent leurs données au montage : les démonter ferait tout redemander
      // à chaque dépliage.
      const carte = await monter({ repliableSurMobile: true })

      expect(carte.html()).toContain('contenu de la carte')
    })
  })
})
