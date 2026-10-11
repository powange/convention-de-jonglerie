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
 * Une commande de guichet s'écrit en TOUT OU RIEN — constat B3.
 *
 * ## Le défaut
 *
 * La commande, ses billets, leurs options et les accès repas s'écrivaient en une dizaine
 * d'opérations **sans transaction**, dans des boucles imbriquées. Une erreur au milieu — une
 * contrainte d'unicité `(orderItemId, optionId)` si la même option arrive deux fois, une connexion
 * perdue — laissait une commande avec une **partie** de ses billets et un code QR déjà attribué.
 * Le caissier voyait une erreur, ressaisissait, et la personne se retrouvait avec **deux
 * commandes**.
 *
 * ## ⚠️⚠️ POURQUOI LE BOUCHON PAR DÉFAUT NE PEUT PAS PROUVER CE LOT
 *
 * `test/__mocks__/prisma.ts` implémente `$transaction` en exécutant le rappel **avec `prismaMock`
 * lui-même** comme client transactionnel. Dans ce cas `tx.ticketingOrder.create` **EST**
 * `prisma.ticketingOrder.create` : affirmer « les écritures passent par `tx` » serait
 * **indémontrable**, et les dix-sept tests voisins de ce handler sont restés verts avant comme
 * après la correction — ce qui le prouve.
 *
 * Ce fichier fournit donc un client transactionnel **DISTINCT**, avec ses propres espions. La
 * seule assertion qui porte quelque chose est alors : les écritures ont atterri sur **lui**, et
 * **pas** sur `prisma`.
 *
 * ## 📍 CE QUE CES TESTS NE PROUVENT PAS, et il faut le dire
 *
 * L'**atomicité** elle-même — le fait qu'une erreur annule les écritures déjà faites — est une
 * garantie de Prisma et de MySQL, pas du code. Aucun bouchon ne peut l'éprouver. Ce qui est
 * vérifiable ici, et c'est tout ce qui nous appartient, c'est que **toutes** les écritures sont
 * bien confiées à la transaction.
 */
const TARIF = { id: 5, name: 'Entrée week-end', price: 2000, quotas: [], handoutItems: [] }
const OPTION = { id: 9, name: 'Tee-shirt', price: 1500, meals: [{ mealId: 3 }] }

const CORPS = {
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

const evenement = { context: { params: { id: '42' }, user: { id: 1 } } } as never

/** Un client transactionnel reconnaissable, pour distinguer `tx.` de `prisma.`. */
function clientTransactionnel() {
  return {
    ticketingOrder: { create: vi.fn().mockResolvedValue({ id: 100 }) },
    ticketingOrderItem: { create: vi.fn().mockResolvedValue({ id: 200 }) },
    ticketingOrderItemOption: { create: vi.fn().mockResolvedValue({ id: 300 }) },
    ticketingOrderItemMeal: { create: vi.fn().mockResolvedValue({ id: 400 }) },
  }
}

describe('ajout manuel — tout ou rien', () => {
  let tx: ReturnType<typeof clientTransactionnel>

  beforeEach(() => {
    vi.clearAllMocks()
    tx = clientTransactionnel()
    global.readBody = vi.fn().mockResolvedValue(CORPS)
    prismaMock.edition.findUnique.mockResolvedValue({
      id: 42,
      name: 'Édition test',
      convention: { name: 'Convention test' },
    })
    prismaMock.ticketingTier.findMany.mockResolvedValue([TARIF])
    prismaMock.ticketingOption.findMany.mockResolvedValue([OPTION])
    prismaMock.$transaction.mockImplementation(async (rappel: any) => rappel(tx))
  })

  it('⚠️ TOUTES LES ÉCRITURES PASSENT PAR LE CLIENT DE LA TRANSACTION', async () => {
    await handler(evenement)

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.ticketingOrder.create).toHaveBeenCalledTimes(1)
    expect(tx.ticketingOrderItem.create).toHaveBeenCalledTimes(1)
    expect(tx.ticketingOrderItemOption.create).toHaveBeenCalledTimes(1)
    expect(tx.ticketingOrderItemMeal.create).toHaveBeenCalledTimes(1)
  })

  it('⚠️ ET AUCUNE NE PASSE PAR LE CLIENT ORDINAIRE — l’assertion décisive', async () => {
    /*
     * Sans ce cas, le précédent serait satisfait par un `$transaction` posé autour d'un bloc qui
     * continuerait d'écrire par `prisma.` : les quatre espions de `tx` resteraient à zéro… sauf
     * que le bouchon PAR DÉFAUT passe `prismaMock` comme `tx`, donc ils compteraient quand même.
     * C'est ici, et seulement ici, que l'oubli d'un `prisma.` dans la transaction se voit.
     */
    await handler(evenement)

    expect(prismaMock.ticketingOrder.create).not.toHaveBeenCalled()
    expect(prismaMock.ticketingOrderItem.create).not.toHaveBeenCalled()
    expect(prismaMock.ticketingOrderItemOption.create).not.toHaveBeenCalled()
    expect(prismaMock.ticketingOrderItemMeal.create).not.toHaveBeenCalled()
  })

  it('les LECTURES restent dehors — la transaction ne dure pas plus que nécessaire', async () => {
    /*
     * La lecture des tarifs et des options ne touche rien : les garder dans la transaction
     * l'allongerait sans rien protéger, et le plafond de 5 s de Prisma se rapprocherait pour
     * aucune raison. Un test le fige, sans quoi un remaniement les y ferait entrer sans qu'on
     * s'en aperçoive.
     */
    await handler(evenement)

    expect(prismaMock.ticketingTier.findMany).toHaveBeenCalled()
    expect(prismaMock.ticketingOption.findMany).toHaveBeenCalled()
    expect(tx).not.toHaveProperty('ticketingTier')
  })

  it('une erreur au milieu remonte, et n’est pas avalée', async () => {
    /*
     * ⚠️ Ce cas ne prouve PAS l'annulation des écritures déjà faites : c'est la base qui s'en
     * charge, et aucun bouchon ne peut l'éprouver. Il prouve l'autre moitié, qui nous appartient :
     * le handler ne retient pas l'erreur. L'avaler laisserait le caissier croire la commande
     * enregistrée.
     */
    tx.ticketingOrderItem.create.mockRejectedValue(new Error('contrainte unique'))

    await expect(handler(evenement)).rejects.toThrow('contrainte unique')
  })
})
