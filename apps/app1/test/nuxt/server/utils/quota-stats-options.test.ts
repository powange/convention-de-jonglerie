import { describe, expect, it, beforeEach, vi } from 'vitest'

import { getQuotaStats } from '../../../../server/utils/editions/ticketing/quota-stats'

const prismaMock = (globalThis as any).prisma

/**
 * Le décompte d'un quota posé sur une OPTION.
 *
 * Il ne comptait rien. Jamais, sur aucun chemin d'écriture, depuis toujours : le calcul cherchait
 * les options dans l'instantané JSON du billet (`customFields`), alors que les deux chemins
 * d'écriture les en excluent explicitement et les rangent dans `TicketingOrderItemOption`.
 *
 * - L'import externe le commente deux fois : « customFields contient UNIQUEMENT les vrais champs
 *   personnalisés, les options sont gérées dans TicketingOrderItemOption ».
 * - L'ajout manuel sépare `optionFields` de `realCustomFields` et n'écrit que les seconds.
 *
 * Mesuré en base de développement avant correction : 149 options vendues, zéro billet trouvé.
 *
 * Le rapprochement se fait désormais par `optionId` — un vrai lien relationnel, insensible au
 * renommage de l'option, contrairement à la comparaison de noms qu'il remplace.
 */
describe('quotas — les options', () => {
  const quotaDeBase = {
    id: 1,
    title: 'Repas du samedi',
    description: null,
    quantity: 100,
    position: 0,
    tiers: [],
    options: [],
    customFields: [],
    organizers: [],
    volunteers: [],
    artists: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])
    prismaMock.ticketingOrderItemOption.findMany.mockResolvedValue([])
    prismaMock.editionOrganizer.findMany.mockResolvedValue([])
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([])
    prismaMock.editionArtist.findMany.mockResolvedValue([])
  })

  const statsAvec = async (quota: Record<string, unknown>) => {
    prismaMock.ticketingQuota.findMany.mockResolvedValue([{ ...quotaDeBase, ...quota }])
    const [stats] = await getQuotaStats(22)
    return stats!
  }

  const selection = (orderItemId: number, optionId: number, entryValidated = false) => ({
    orderItemId,
    optionId,
    orderItem: { id: orderItemId, entryValidated },
  })

  it('compte le billet qui a pris l’option', async () => {
    prismaMock.ticketingOrderItemOption.findMany.mockResolvedValue([selection(7, 3)])

    const stats = await statsAvec({ options: [{ optionId: 3 }] })

    expect(stats.currentCount).toBe(1)
  })

  it('ignore une option que le quota ne vise pas', async () => {
    prismaMock.ticketingOrderItemOption.findMany.mockResolvedValue([selection(7, 99)])

    const stats = await statsAvec({ options: [{ optionId: 3 }] })

    expect(stats.currentCount).toBe(0)
  })

  it('ne compte qu’une place pour un billet portant deux options du même quota', async () => {
    prismaMock.ticketingOrderItemOption.findMany.mockResolvedValue([
      selection(7, 3),
      selection(7, 4),
    ])

    const stats = await statsAvec({ options: [{ optionId: 3 }, { optionId: 4 }] })

    expect(stats.currentCount).toBe(1)
  })

  it('fait entrer le billet dans les validés quand son entrée l’est', async () => {
    prismaMock.ticketingOrderItemOption.findMany.mockResolvedValue([selection(7, 3, true)])

    const stats = await statsAvec({ options: [{ optionId: 3 }] })

    expect(stats.currentCount).toBe(1)
    expect(stats.validatedCount).toBe(1)
  })

  it('n’interroge que les billets payés ou en attente de cette édition', async () => {
    // Le reste du calcul ne retient que `Processed` et `Pending` : une option prise sur un billet
    // annulé ne doit pas occuper de place.
    await statsAvec({ options: [{ optionId: 3 }] })

    expect(prismaMock.ticketingOrderItemOption.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orderItem: expect.objectContaining({
            state: { in: ['Processed', 'Pending'] },
            order: { editionId: 22 },
          }),
        }),
      })
    )
  })

  it('ne dédouble pas un billet compté à la fois par son tarif et par son option', async () => {
    prismaMock.ticketingOrderItemOption.findMany.mockResolvedValue([selection(7, 3)])

    const stats = await statsAvec({
      options: [{ optionId: 3 }],
      tiers: [{ tier: { orderItems: [{ id: 7, entryValidated: false }] } }],
    })

    // Un billet est UNE place, quel que soit le nombre de raisons de le compter.
    expect(stats.currentCount).toBe(1)
  })
})
