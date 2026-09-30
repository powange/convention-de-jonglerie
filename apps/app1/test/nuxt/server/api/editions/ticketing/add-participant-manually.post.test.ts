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

/**
 * Le montant personnalisé d'une ligne, et les options d'une AUTRE édition.
 *
 * ⚠️ DEUX DÉFAUTS D'ARGENT, dans le même fichier, tous deux silencieux.
 *
 * 1. `customAmount` était `z.number()` nu, appliqué à TOUT tarif : un négatif retirait de l'argent
 *    du total, un décimal était tronqué par la base, et un montant envoyé sur un tarif à PRIX FIXE
 *    écrasait le prix affiché à la personne au guichet. On encaissait 20 € et on enregistrait ce
 *    que le client avait envoyé.
 *
 * 2. Les options n'étaient chargées QUE par identifiant, sans borne d'édition. Un `optionId`
 *    appartenant à une autre édition était accepté : son prix entrait dans le total, son
 *    association était écrite sur le billet, et un repas d'une autre convention se retrouvait dû.
 *    Rien ne le signalait — l'option existe, elle a un prix, elle a des repas ; elle n'est
 *    simplement pas de cette édition.
 *
 * 🔬 Les tests portent sur ce qui est ÉCRIT (`order.amount`, `orderItem.amount`) et sur la FORME
 * de la requête d'options. Le mock de Prisma ignore le `where` : un test de refus seul resterait
 * vert même si la borne d'édition disparaissait, puisqu'il repose sur un `findMany` rendu vide.
 */
describe('POST add-participant-manually — montant personnalisé et options', () => {
  const evenement = { context: { params: { id: '42' }, user: { id: 1 } } } as any

  /** Un tarif à PRIX FIXE : ni minimum ni maximum. */
  const TARIF_FIXE = {
    id: 5,
    name: 'Entrée week-end',
    price: 2000,
    minAmount: null,
    maxAmount: null,
    quotas: [],
    handoutItems: [],
  }

  /** Un tarif à PRIX LIBRE, minimum 5 €. */
  const TARIF_LIBRE = {
    id: 6,
    name: 'Soutien',
    price: 0,
    minAmount: 500,
    maxAmount: 10000,
    quotas: [],
    handoutItems: [],
  }

  const corps = (item: Record<string, unknown>) => ({
    payerFirstName: 'Camille',
    payerLastName: 'Martin',
    payerEmail: 'camille@example.com',
    paymentMethod: 'cash' as const,
    items: [item],
  })

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.edition.findUnique.mockResolvedValue({
      id: 42,
      name: 'Édition test',
      convention: { name: 'Convention test' },
    })
    prismaMock.ticketingOption.findMany.mockResolvedValue([])
    prismaMock.ticketingOrder.create.mockResolvedValue({ id: 100 })
    prismaMock.ticketingOrderItem.create.mockResolvedValue({ id: 200 })
    prismaMock.ticketingOrderItemOption.create.mockResolvedValue({ id: 300 })
    prismaMock.ticketingOrderItemMeal.create.mockResolvedValue({ id: 400 })
  })

  describe('tarif à PRIX FIXE', () => {
    beforeEach(() => {
      prismaMock.ticketingTier.findMany.mockResolvedValue([TARIF_FIXE])
    })

    it('IGNORE le montant personnalisé et retient le prix du tarif', async () => {
      /*
       * Le cas que l'énoncé demande : tarif fixe + `customAmount: 1` → le montant doit être le
       * prix du tarif. Avant, on enregistrait 1 centime pour une entrée encaissée 20 €.
       *
       * On ignore SANS erreur, délibérément : l'écran peut envoyer le champ par habitude, et
       * refuser la commande pour cela bloquerait un guichet sans raison.
       */
      global.readBody = vi
        .fn()
        .mockResolvedValue(corps({ tierId: 5, quantity: 1, customAmount: 1 }))

      await handler(evenement)

      expect(prismaMock.ticketingOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amount: 2000 }) })
      )
      expect(prismaMock.ticketingOrderItem.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amount: 2000 }) })
      )
    })

    it('le TOTAL et la LIGNE s’accordent', async () => {
      /*
       * L'invariant qui compte, et le défaut qui s'est déjà produit dans ce fichier : les deux
       * calculs vivaient à deux endroits, écrits à l'identique. Appliquer la règle à un seul
       * ferait diverger le total de la commande et le prix de ses lignes — un écart qui ne lève
       * aucune erreur, et que seul un rapprochement comptable révèle.
       */
      global.readBody = vi
        .fn()
        .mockResolvedValue(corps({ tierId: 5, quantity: 2, customAmount: 1 }))

      await handler(evenement)

      const commande = prismaMock.ticketingOrder.create.mock.calls[0][0].data.amount
      const ligne = prismaMock.ticketingOrderItem.create.mock.calls[0][0].data.amount
      expect(commande).toBe(ligne * 2)
    })
  })

  describe('tarif à PRIX LIBRE', () => {
    beforeEach(() => {
      prismaMock.ticketingTier.findMany.mockResolvedValue([TARIF_LIBRE])
    })

    it('retient le montant personnalisé dans les bornes', async () => {
      global.readBody = vi
        .fn()
        .mockResolvedValue(corps({ tierId: 6, quantity: 1, customAmount: 2500 }))

      await handler(evenement)

      expect(prismaMock.ticketingOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amount: 2500 }) })
      )
    })

    it('REFUSE un montant sous le minimum', async () => {
      /*
       * Le second cas de l'énoncé : minimum 5 €, montant 1 € → 400. Accepter créerait un billet
       * valide à un prix que la billetterie n'autorise pas, et que rien ne rattraperait.
       */
      global.readBody = vi
        .fn()
        .mockResolvedValue(corps({ tierId: 6, quantity: 1, customAmount: 100 }))

      await expect(handler(evenement)).rejects.toMatchObject({ statusCode: 400 })
      expect(prismaMock.ticketingOrder.create).not.toHaveBeenCalled()
    })

    it('REFUSE un montant au-dessus du maximum', async () => {
      global.readBody = vi
        .fn()
        .mockResolvedValue(corps({ tierId: 6, quantity: 1, customAmount: 999999 }))

      await expect(handler(evenement)).rejects.toMatchObject({ statusCode: 400 })
    })

    it('le message d’erreur est LISIBLE à l’écran', async () => {
      /*
       * `AddParticipantModal.vue` affiche ce message tel quel dans `errorMessages.default`. Un
       * « Données invalides » y serait inutile : le caissier a quelqu'un devant lui et doit savoir
       * quel montant saisir.
       */
      global.readBody = vi
        .fn()
        .mockResolvedValue(corps({ tierId: 6, quantity: 1, customAmount: 100 }))

      await expect(handler(evenement)).rejects.toThrow(/Soutien/)
      await expect(handler(evenement)).rejects.toThrow(/5\.00 €/)
    })

    it('accepte zéro quand aucun minimum n’est posé', async () => {
      // Un tarif à prix libre peut être offert : `min(0)` au schéma, et pas `min(1)`.
      prismaMock.ticketingTier.findMany.mockResolvedValue([
        { ...TARIF_LIBRE, minAmount: null, maxAmount: 10000 },
      ])
      global.readBody = vi
        .fn()
        .mockResolvedValue(corps({ tierId: 6, quantity: 1, customAmount: 0 }))

      await handler(evenement)

      expect(prismaMock.ticketingOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amount: 0 }) })
      )
    })

    it('charge les BORNES du tarif dans le select', async () => {
      /*
       * Sans `minAmount`/`maxAmount` au `select`, Prisma rend `undefined` — que le code lit comme
       * « pas de borne », donc comme un tarif à prix FIXE. Le montant personnalisé serait alors
       * ignoré sur un tarif à prix libre : l'inverse du défaut, et tout aussi silencieux.
       *
       * Le mock ignorant le `select`, seule une assertion sur la forme de la requête le voit.
       */
      global.readBody = vi
        .fn()
        .mockResolvedValue(corps({ tierId: 6, quantity: 1, customAmount: 2500 }))

      await handler(evenement)

      const select = prismaMock.ticketingTier.findMany.mock.calls[0][0].select
      expect(select.minAmount).toBe(true)
      expect(select.maxAmount).toBe(true)
    })
  })

  describe('options d’une autre édition', () => {
    beforeEach(() => {
      prismaMock.ticketingTier.findMany.mockResolvedValue([TARIF_FIXE])
    })

    const corpsAvecOption = corps({
      tierId: 5,
      quantity: 1,
      customParticipants: [
        {
          firstName: 'Camille',
          lastName: 'Martin',
          email: 'camille@example.com',
          customFields: [{ optionId: 77, name: 'Tee-shirt', answer: 'M' }],
        },
      ],
    })

    it('REFUSE en 400, et n’écrit RIEN', async () => {
      /*
       * Le troisième cas de l'énoncé. La requête bornée à l'édition ne trouve pas l'option 77 ;
       * on refuse plutôt que d'ignorer — ignorer donnerait une commande au total plus faible que
       * ce que le guichet a affiché, alors que l'encaissement a bien eu lieu.
       */
      global.readBody = vi.fn().mockResolvedValue(corpsAvecOption)
      prismaMock.ticketingOption.findMany.mockResolvedValue([])

      await expect(handler(evenement)).rejects.toMatchObject({ statusCode: 400 })
      expect(prismaMock.ticketingOrder.create).not.toHaveBeenCalled()
      expect(prismaMock.ticketingOrderItem.create).not.toHaveBeenCalled()
    })

    it('borne la requête d’options à l’ÉDITION', async () => {
      /*
       * ⚠️ LE TEST QUI COMPTE. Le mock de Prisma IGNORE le `where` : le refus ci-dessus repose sur
       * un `findMany` rendu vide, et resterait vert si la borne `editionId` disparaissait. Seule
       * une assertion sur la forme de la requête voit ce défaut.
       */
      global.readBody = vi.fn().mockResolvedValue(corpsAvecOption)
      prismaMock.ticketingOption.findMany.mockResolvedValue([
        { id: 77, name: 'Tee-shirt', price: 1500, meals: [] },
      ])

      await handler(evenement)

      const where = prismaMock.ticketingOption.findMany.mock.calls[0][0].where
      expect(where.editionId).toBe(42)
      expect(where.id).toEqual({ in: [77] })
    })

    it('ne charge AUCUNE option quand aucune n’est cochée', async () => {
      // Le cas courant ne doit pas payer une requête pour rien.
      global.readBody = vi.fn().mockResolvedValue(corps({ tierId: 5, quantity: 1 }))

      await handler(evenement)

      expect(prismaMock.ticketingOption.findMany).not.toHaveBeenCalled()
    })
  })
})
