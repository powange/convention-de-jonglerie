import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi, afterEach } from 'vitest'

import { TicketingHandoutItemsModal } from '#components'

/**
 * La coquille commune des modales « articles à remettre ».
 *
 * Sept écrans n'en sont plus que des enveloppes. Ils n'avaient aucun test : une régression ici
 * les casse tous les sept d'un coup, et rien à l'écran ne le dirait avant qu'un organisateur
 * n'enregistre dans le vide.
 *
 * Deux pièges de cet environnement, tous deux déjà payés ailleurs dans ce dépôt :
 *
 * - Le composant est **importé** depuis `#components`, jamais résolu par son nom :
 *   `resolveComponent` échoue silencieusement ici, et le test passerait sans rien monter.
 * - Le corps d'une `UModal` est **téléporté dans `document.body`**. Il n'est donc pas dans le
 *   HTML du composant monté, et il faut démonter entre deux tests, sans quoi le contenu de l'un
 *   s'ajoute à celui du suivant.
 */
const ARTICLES = [
  { id: 5, name: 'Bracelet' },
  { id: 6, name: 'Tee-shirt' },
]

// La forme réelle de `GET ticketing/handout-items` : enveloppée dans `data`.
registerEndpoint('/api/editions/22/ticketing/handout-items', () => ({
  success: true,
  data: { handoutItems: ARTICLES },
}))

let monte: { unmount: () => void } | null = null

afterEach(() => {
  monte?.unmount()
  monte = null
  document.body.innerHTML = ''
})

const monter = async (props: Record<string, unknown> = {}) => {
  const composant = await mountSuspended(TicketingHandoutItemsModal, {
    props: {
      open: true,
      editionId: 22,
      title: 'Articles du tarif',
      fieldLabel: 'Articles remis',
      initialSelection: [{ handoutItemId: 5, quantity: 3 }],
      saveUrl: '/api/editions/22/ticketing/tiers/1/handout-items',
      saveBody: (selection: unknown) => ({ handoutItemIds: selection }),
      ...props,
    },
  })
  monte = composant
  return composant
}

describe('TicketingHandoutItemsModal', () => {
  it('monte et rend le titre que l’écran lui donne', async () => {
    await monter()

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Articles du tarif')
    })
  })

  it('rend la sélection initiale reçue en propriété', async () => {
    await monter()

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Bracelet')
    })
  })

  /*
   * La quantité facultative vaut UN exemplaire, comme côté serveur. Les écrans transmettent des
   * objets Prisma où elle peut manquer ; la laisser à `undefined` la ferait remonter telle quelle
   * dans le corps du PUT.
   */
  it('ramène une quantité absente à un exemplaire', async () => {
    const composant = await monter({ initialSelection: [{ handoutItemId: 6 }] })

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Tee-shirt')
    })
    expect((composant.vm as any).selection).toEqual([{ handoutItemId: 6, quantity: 1 }])
  })

  /*
   * Le filtre des articles proposés n'est employé que par les organisateurs — donc par un seul
   * des sept écrans, ce qui en fait le point le plus facile à casser sans s'en apercevoir.
   */
  it('restreint les articles proposés quand un filtre est fourni', async () => {
    const filtre = vi.fn((articles: typeof ARTICLES) => articles.filter((a) => a.id !== 6))

    await monter({ filterItems: filtre })

    await vi.waitFor(() => {
      expect(filtre).toHaveBeenCalled()
    })
    expect(filtre.mock.calls.at(-1)?.[0]).toHaveLength(2)
    await vi.waitFor(() => {
      expect(document.body.textContent).not.toContain('Tee-shirt')
    })
  })

  // Les organisateurs et « tous les artistes » n'ont pas d'objet affiché qui porte la sélection :
  // ils la font chercher. Les deux formes doivent marcher.
  it('accepte une sélection initiale à aller chercher', async () => {
    const aller = vi.fn(async () => [{ handoutItemId: 5, quantity: 2 }])

    await monter({ initialSelection: aller })

    await vi.waitFor(() => {
      expect(aller).toHaveBeenCalled()
      expect(document.body.textContent).toContain('Bracelet')
    })
  })
})
