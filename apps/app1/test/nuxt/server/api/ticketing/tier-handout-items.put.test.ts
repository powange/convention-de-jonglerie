import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanManage = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: mockCanManage,
}))

import handler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/tiers/[tierId]/handout-items.put'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

const evenement = {
  context: { params: { id: '22', tierId: '88' }, user: { id: 1, pseudo: 'orga' } },
}

/** Lignes transmises au createMany des associations */
const lignesEcrites = () =>
  prismaMock.ticketingTierHandoutItem.createMany.mock.calls[0]?.[0]?.data ?? []

describe('PUT /api/editions/[id]/ticketing/tiers/[tierId]/handout-items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.ticketingTier.findFirst.mockResolvedValue({ id: 88 })
    // Par défaut, tous les articles demandés appartiennent bien à l'édition
    prismaMock.ticketingHandoutItem.count.mockImplementation(
      async ({ where }: any) => where.id.in.length
    )
    prismaMock.ticketingTierHandoutItem.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.ticketingTierHandoutItem.createMany.mockResolvedValue({ count: 2 })
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))
  })

  const envoyer = (body: unknown) => {
    global.readBody = vi.fn().mockResolvedValue(body)
    return handler(evenement as any)
  }

  it('accepte la sélection envoyée par la modale, qui échouait en 400 en production', async () => {
    // Payload exact des logs du 24/08 : « handoutItemIds.0: expected number, received object »
    const result = await envoyer({
      handoutItemIds: [
        { handoutItemId: 5, quantity: 3 },
        { handoutItemId: 6, quantity: 1 },
      ],
    })

    expect(result.success).toBe(true)
    expect(lignesEcrites()).toEqual([
      { tierId: 88, handoutItemId: 5, quantity: 3 },
      { tierId: 88, handoutItemId: 6, quantity: 1 },
    ])
  })

  it('enregistre le nombre d’exemplaires, au lieu de le laisser au défaut', async () => {
    await envoyer({ handoutItemIds: [{ handoutItemId: 5, quantity: 7 }] })

    expect(lignesEcrites()[0].quantity).toBe(7)
  })

  it("accepte encore une liste d'identifiants nus", async () => {
    await envoyer({ handoutItemIds: [5, 6] })

    expect(lignesEcrites()).toEqual([
      { tierId: 88, handoutItemId: 5, quantity: 1 },
      { tierId: 88, handoutItemId: 6, quantity: 1 },
    ])
  })

  it('remplace les associations existantes', async () => {
    await envoyer({ handoutItemIds: [{ handoutItemId: 5 }] })

    expect(prismaMock.ticketingTierHandoutItem.deleteMany).toHaveBeenCalledWith({
      where: { tierId: 88 },
    })
  })

  it('vide les associations sans rien réécrire quand la sélection est vide', async () => {
    await envoyer({ handoutItemIds: [] })

    expect(prismaMock.ticketingTierHandoutItem.deleteMany).toHaveBeenCalled()
    expect(prismaMock.ticketingTierHandoutItem.createMany).not.toHaveBeenCalled()
  })

  it('refuse un article étranger à l’édition', async () => {
    prismaMock.ticketingHandoutItem.count.mockResolvedValue(1) // un seul des deux existe

    await expect(
      envoyer({ handoutItemIds: [{ handoutItemId: 5 }, { handoutItemId: 99 }] })
    ).rejects.toBeDefined()
  })

  it('refuse un contributeur sans droit sur la billetterie', async () => {
    mockCanManage.mockResolvedValue(false)

    await expect(envoyer({ handoutItemIds: [{ handoutItemId: 5 }] })).rejects.toBeDefined()
    expect(prismaMock.ticketingTierHandoutItem.createMany).not.toHaveBeenCalled()
  })
})
