import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
  if (!(globalThis as any).validateEditionId) {
    ;(globalThis as any).validateEditionId = (event: any) =>
      parseInt(event?.context?.params?.id, 10)
  }
})

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn(() => ({ id: 1, email: 'guichet@test.com' })),
}))

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canAccessEditionDataOrAccessControl: vi.fn().mockResolvedValue(true),
}))

vi.mock('#server/utils/editions/ticketing/tiers', () => ({
  applyCustomName: (tier: unknown) => tier,
}))

import handler from '../../../../../../server/api/editions/[id]/ticketing/add-participant-manually.post'
import { global } from '../../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * L'argent du guichet, quand le participant prend une option payante.
 *
 * L'écran d'ajout manuel affiche — et fait payer — un total qui inclut le prix des options cochées.
 * Le serveur, lui, ne totalisait que les tarifs et écrivait chaque ligne d'option à `amount: 0`.
 * Une entrée à 20 € avec un tee-shirt à 15 € était donc encaissée 35 € et enregistrée 20 €.
 *
 * Ce n'est pas un détail d'affichage : les totaux par moyen de paiement de l'écran des commandes
 * lisent `order.amount`, et `montantTotalDeLaLigne` additionne les montants des options. Le même
 * défaut avait été corrigé pour l'import HelloAsso — « 291 € de bouteilles encaissés sans
 * apparaître » — mais pas pour la saisie sur place.
 */
describe('POST /api/editions/[id]/ticketing/add-participant-manually — prix des options', () => {
  const evenement = { context: { params: { id: '42' }, user: { id: 1 } } } as any

  const TARIF = { id: 5, name: 'Entrée week-end', price: 2000, quotas: [], handoutItems: [] }
  const OPTION = { id: 9, name: 'Tee-shirt', price: 1500, meals: [] }

  /** Un billet au tarif 5, avec l'option 9 cochée sur son unique participant. */
  const corpsAvecOption = {
    payerFirstName: 'Camille',
    payerLastName: 'Martin',
    payerEmail: 'camille@example.com',
    paymentMethod: 'cash' as const,
    items: [
      {
        tierId: 5,
        quantity: 1,
        customParticipants: [
          {
            firstName: 'Camille',
            lastName: 'Martin',
            email: 'camille@example.com',
            customFields: [{ optionId: 9, name: 'Tee-shirt', answer: 'M' }],
          },
        ],
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn().mockResolvedValue(corpsAvecOption)
    prismaMock.edition.findUnique.mockResolvedValue({
      id: 42,
      name: 'Édition test',
      convention: { name: 'Convention test' },
    })
    prismaMock.ticketingTier.findMany.mockResolvedValue([TARIF])
    prismaMock.ticketingOption.findMany.mockResolvedValue([OPTION])
    prismaMock.ticketingOrder.create.mockResolvedValue({ id: 100 })
    prismaMock.ticketingOrderItem.create.mockResolvedValue({ id: 200 })
    prismaMock.ticketingOrderItemOption.create.mockResolvedValue({ id: 300 })
    prismaMock.ticketingOrderItemMeal.create.mockResolvedValue({ id: 400 })
  })

  it('encaisse le tarif ET l’option dans le montant de la commande', async () => {
    await handler(evenement)

    // 2000 (entrée) + 1500 (tee-shirt) : c'est ce que le caissier a réellement encaissé.
    expect(prismaMock.ticketingOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 3500 }) })
    )
  })

  it('enregistre le prix payé sur la ligne d’option, et non zéro', async () => {
    await handler(evenement)

    expect(prismaMock.ticketingOrderItemOption.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ optionId: 9, amount: 1500 }) })
    )
  })

  it('laisse le billet au prix du tarif seul', async () => {
    // Le contrat du client ne change pas : `customAmount` reste le tarif, et l'option vit sur sa
    // propre ligne. C'est ainsi que les commandes importées de HelloAsso sont déjà représentées, et
    // `montantTotalDeLaLigne` additionne les deux.
    await handler(evenement)

    expect(prismaMock.ticketingOrderItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 2000 }) })
    )
  })

  it('compte les options participant par participant, pas par quantité', async () => {
    /*
     * Le piège de ce calcul : les options sont portées par CHAQUE participant, pas par la ligne.
     * Deux billets d'un même tarif peuvent avoir des options différentes — multiplier le prix des
     * options par la quantité donnerait un total faux, et plausible.
     */
    global.readBody = vi.fn().mockResolvedValue({
      ...corpsAvecOption,
      items: [
        {
          tierId: 5,
          quantity: 2,
          customParticipants: [
            {
              firstName: 'Camille',
              lastName: 'Martin',
              email: 'camille@example.com',
              customFields: [{ optionId: 9, name: 'Tee-shirt', answer: 'M' }],
            },
            {
              firstName: 'Alex',
              lastName: 'Martin',
              email: 'alex@example.com',
              customFields: [],
            },
          ],
        },
      ],
    })

    await handler(evenement)

    // 2 × 2000 + UN seul tee-shirt : 5500, et non 7000.
    expect(prismaMock.ticketingOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 5500 }) })
    )
  })

  it('traite une option sans prix comme gratuite', async () => {
    // `price` est nullable en base : une option d'information ne coûte rien et ne doit rien ajouter.
    prismaMock.ticketingOption.findMany.mockResolvedValue([{ ...OPTION, price: null }])

    await handler(evenement)

    expect(prismaMock.ticketingOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 2000 }) })
    )
    expect(prismaMock.ticketingOrderItemOption.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 0 }) })
    )
  })

  it('ne lit les options qu’une fois, quel que soit le nombre de participants', async () => {
    // Elles étaient relues à l'intérieur de la double boucle de création : une requête par option et
    // par participant, pour un prix qui n'était même pas utilisé.
    await handler(evenement)

    expect(prismaMock.ticketingOption.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.ticketingOption.findUnique).not.toHaveBeenCalled()
  })
})
