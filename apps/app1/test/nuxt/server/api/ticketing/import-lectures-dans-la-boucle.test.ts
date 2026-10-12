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
  requireAuth: (event: any) => event.context.user,
}))

const mockCanManage = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: mockCanManage,
}))

const mockRecuperer = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/editions/ticketing/helloasso', () => ({
  fetchOrdersFromHelloAsso: mockRecuperer,
}))

vi.mock('#server/utils/encryption', () => ({ decrypt: () => 'secret-en-clair' }))

import handler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/helloasso/import.post'

/**
 * Ce que l'import lit, et combien de fois — constat O1.
 *
 * ## Le défaut
 *
 * `tx.ticketingOption.findMany({ where: { editionId }, include: { meals: true } })` était appelé
 * **dans la boucle des lignes de commande** : chaque billet portant au moins une option relançait
 * la même lecture sur toute l'édition, repas inclus. Les tarifs, eux, étaient déjà chargés une
 * fois avant la boucle — l'asymétrie n'avait aucune raison.
 *
 * ## 📊 Mesuré sur la base de développement avant correctif
 *
 * Sur les seules commandes **importées** (la boucle n'écrit que ce que HelloAsso rend) :
 *
 * | édition | lignes importées | lignes avec options |
 * | --- | --- | --- |
 * | 9 | 228 | **106** → 106 lectures, **105 évitables** |
 * | 1, 17, 21, 22 | 115 à 335 | **0** |
 *
 * ## ⚠️ POURQUOI CE TEST COMPTE LES APPELS ET NON LA DURÉE
 *
 * Une assertion sur le temps serait instable sur un runner partagé, et le mock Prisma ne coûte
 * rien : la durée ne mesurerait que la machine. Le nombre d'appels, lui, est exactement ce que le
 * correctif change — et il reste vrai quelle que soit la machine.
 */
const prismaMock = (globalThis as any).prisma
const evenement = { context: { params: { id: '22' }, user: { id: 5 } } } as never

/** Une commande importée dont chaque ligne porte une option. */
const commande = (id: number, lignes: number) => ({
  id: `ha-${id}`,
  date: '2026-06-01T10:00:00Z',
  payer: { firstName: 'Léa', lastName: 'Martin', email: 'lea@exemple.fr' },
  items: Array.from({ length: lignes }, (_, i) => ({
    id: `item-${id}-${i}`,
    name: 'Pass 3 jours',
    type: 'Registration',
    amount: 4500,
    state: 'Processed',
    options: [{ id: 77, name: 'Repas', amount: 900 }],
  })),
})

describe('import des commandes — les lectures hors de la boucle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.externalTicketing.findUnique.mockResolvedValue({
      id: 'ext-1',
      editionId: 22,
      helloAssoConfig: {
        clientId: 'cid',
        clientSecret: 'chiffre',
        organizationSlug: 'org',
        formType: 'Event',
        formSlug: 'form',
      },
    })
    prismaMock.$transaction.mockImplementation(async (travail: any) => travail(prismaMock))
    prismaMock.ticketingTier.findMany.mockResolvedValue([])
    prismaMock.ticketingOption.findMany.mockResolvedValue([])
    prismaMock.ticketingOrder.upsert.mockImplementation(async () => ({ id: 1 }))
    prismaMock.ticketingOrderItem.findFirst.mockResolvedValue(null)
    prismaMock.ticketingOrderItem.create.mockImplementation(async () => ({ id: 1 }))
    prismaMock.ticketingOrderItem.count.mockResolvedValue(0)
    prismaMock.ticketingOrder.count.mockResolvedValue(0)
    prismaMock.externalTicketing.update.mockResolvedValue({})
  })

  it('⚠️ LES OPTIONS SONT LUES UNE SEULE FOIS, quel que soit le nombre de billets', async () => {
    // Trois commandes de quatre lignes à option : douze lectures avant le correctif, une après.
    mockRecuperer.mockResolvedValue({
      data: [commande(1, 4), commande(2, 4), commande(3, 4)],
      pagination: { totalCount: 3 },
    })

    await handler(evenement)

    expect(
      prismaMock.ticketingOption.findMany,
      'une lecture par billet à option : la requête est restée dans la boucle'
    ).toHaveBeenCalledTimes(1)
  })

  it('les tarifs aussi — le témoin de ce qui était déjà juste', async () => {
    /*
     * Sans ce cas, un correctif qui aurait déplacé la lecture des options DANS la boucle des
     * tarifs — ou qui aurait cassé le chargement des tarifs — passerait inaperçu : les deux
     * lectures sont le même geste, et c'est l'asymétrie entre elles qui était le défaut.
     */
    mockRecuperer.mockResolvedValue({
      data: [commande(1, 4), commande(2, 4)],
      pagination: { totalCount: 2 },
    })

    await handler(evenement)

    expect(prismaMock.ticketingTier.findMany).toHaveBeenCalledTimes(1)
  })

  it('⚠️ LE PLAFOND DE LA TRANSACTION EST CHOISI, pas hérité', async () => {
    /*
     * `$transaction` était appelé sans second argument : il prenait le défaut de Prisma, 5 s, que
     * personne n'avait décidé — pour la transaction la plus lourde du module (≈ 847 requêtes
     * mesurées sur l'édition la plus fournie). Ce cas fige le fait qu'une valeur est passée ; il
     * ne prétend pas que 15 s soit la bonne, mais qu'elle est explicite.
     */
    mockRecuperer.mockResolvedValue({ data: [commande(1, 1)], pagination: { totalCount: 1 } })

    await handler(evenement)

    const options = prismaMock.$transaction.mock.calls[0][1]
    expect(options, 'aucun second argument : le plafond reste celui de Prisma').toBeTruthy()
    expect(options.timeout).toBeGreaterThanOrEqual(15_000)
  })
})
