import { describe, it, expect, beforeEach, vi } from 'vitest'

import { getQuotaStats } from '../../../../server/utils/editions/ticketing/quota-stats'

/**
 * Les billets comptés par leur TARIF — constat O2.
 *
 * ## Ce que ce fichier répare, et pourquoi il manquait
 *
 * Le calcul chargeait les lignes de commande à travers un `include` imbriqué
 * `quota.tiers.tier.orderItems` : chaque association tarif↔quota tirait la liste complète des
 * billets de son tarif, et les mêmes lignes revenaient autant de fois qu'il y avait
 * d'associations. Elles sont désormais regroupées **une fois** par `tierId`, depuis la liste que
 * le calcul chargeait déjà.
 *
 * ## 📊 Chronométré sur la base de développement, trois passages de chaque côté
 *
 * | édition | associations tarif | avant (régime stable) | après |
 * | --- | --- | --- | --- |
 * | 1 | **26** | 53 → 95 ms, médiane **69** | 21 → 75 ms, médiane **28** |
 * | 22 | 9 | 22 → 32 ms, médiane 27 | 27 → 45 ms, médiane 29 |
 *
 * L'édition 22 a **deux fois plus de lignes** (506 contre 269) et restait deux fois plus rapide :
 * le coût suivait les **associations**, pas le volume de billets. Après le changement, les deux
 * éditions sont dans la même plage — la signature attendue.
 *
 * 📍 La fiche annonçait 245 ms et disait ne pas avoir pu le confirmer, « chronométrer supposant
 * de démarrer l'application ». Ce n'était pas nécessaire : la fonction n'a besoin que d'un
 * `globalThis.prisma`. Le 245 ms correspond au **premier appel** d'un processus (263 ms mesuré),
 * pas au régime stable.
 *
 * ## ⚠️⚠️ POURQUOI CE FICHIER EXISTE PLUTÔT QU'UN SEUL CAS AJOUTÉ AILLEURS
 *
 * Les trois fichiers de test existants employaient le chemin des tarifs, mais en posant les
 * lignes **dans le quota** (`tiers: [{ tier: { orderItems: […] } }]`). Après le changement, ils
 * ont continué de passer — **par coïncidence** : `tierId` valait `undefined` des deux côtés, donc
 * `billetsParTarif.get(undefined)` retrouvait le groupe `set(undefined)`. Trois cas ne prouvaient
 * plus rien et ne le disaient pas.
 *
 * Ils sont portés sur la nouvelle forme, et le calcul écarte désormais `undefined` autant que
 * `null`. Ce fichier-ci ajoute ce qu'aucun n'avait : la preuve que l'attribution est bien **par
 * tarif**, et non « tous les billets à tous les quotas ».
 */
const prismaMock = (globalThis as any).prisma

const quotaDeBase = {
  id: 1,
  title: 'Gala — places total',
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

const statsAvec = async (quota: Record<string, unknown>) => {
  prismaMock.ticketingQuota.findMany.mockResolvedValue([{ ...quotaDeBase, ...quota }])
  const [stats] = await getQuotaStats(22)
  return stats!
}

/** Un billet tel que le calcul le lit : identifiant, tarif, champs, validation. */
const billet = (id: number, tierId: number | null, valide = false) => ({
  id,
  tierId,
  customFields: [],
  entryValidated: valide,
})

describe('quotas — les billets comptés par leur tarif', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])
    prismaMock.ticketingOrderItemOption.findMany.mockResolvedValue([])
    prismaMock.editionOrganizer.findMany.mockResolvedValue([])
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([])
    prismaMock.editionArtist.findMany.mockResolvedValue([])
  })

  it('compte les billets du tarif visé', async () => {
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
      billet(1, 9, true),
      billet(2, 9, false),
    ])

    const stats = await statsAvec({ tiers: [{ tierId: 9 }] })

    expect(stats.currentCount).toBe(2)
    expect(stats.validatedCount).toBe(1)
  })

  it('⚠️ NE COMPTE PAS LES BILLETS D’UN AUTRE TARIF — le cas qui manquait', async () => {
    /*
     * LE TÉMOIN DÉCISIF. Un regroupement cassé — ou une attribution « tous les billets à tous
     * les quotas » — satisferait le cas précédent et gonflerait tous les quotas de l'édition.
     * C'est précisément ce que l'ancienne forme de décor ne pouvait pas détecter.
     */
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
      billet(1, 9, true),
      billet(2, 77, true),
      billet(3, 77, false),
    ])

    const stats = await statsAvec({ tiers: [{ tierId: 9 }] })

    expect(stats.currentCount).toBe(1)
    expect(stats.validatedCount).toBe(1)
  })

  it('⚠️ UN BILLET SANS TARIF N’ENTRE DANS AUCUN QUOTA DE TARIF', async () => {
    /*
     * Un don HelloAsso arrive sans identifiant de tarif (`tierId: null`) — c'est le sujet du
     * constat O3, qui compte 35 dons sur l'édition 21. Il ne doit occuper aucune place.
     *
     * ⚠️ Et c'est ce cas qui interdit le retour de la coïncidence : si le calcul laissait les
     * lignes sans tarif former un groupe, une association sans `tierId` les ramasserait.
     */
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([billet(1, null, true)])

    const stats = await statsAvec({ tiers: [{ tierId: 9 }] })

    expect(stats.currentCount).toBe(0)
  })

  it('⚠️ UNE ASSOCIATION SANS TARIF NE RAMASSE PAS LES BILLETS SANS TARIF', async () => {
    /*
     * ⚠️⚠️ LE CAS QUI PROUVE LA GARDE, et il a fallu un sabotage pour s'apercevoir qu'il
     * manquait : retirer le `tierId == null → continue` du regroupement ne faisait tomber AUCUN
     * test. Les autres cas n'y touchent pas, parce qu'ils visent un tarif réel.
     *
     * Ce que la garde empêche : un billet sans tarif (un don) et une association sans tarif
     * tomberaient dans le MÊME groupe — `get(null)` retrouvant `set(null)` —, et le don
     * occuperait une place.
     *
     * 📍 Une association sans `tierId` ne peut pas exister en base (c'est une clé étrangère
     * obligatoire). Ce cas garde donc une garde **défensive**, et le dit : il éprouve le
     * regroupement, pas un scénario de production.
     */
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([billet(1, null, true)])

    const stats = await statsAvec({ tiers: [{ tierId: null }] })

    expect(stats.currentCount).toBe(0)
  })

  it('un billet retenu par deux associations ne compte qu’une place', async () => {
    // Deux quotas peuvent viser le même tarif ; à l'intérieur d'un quota, deux associations vers
    // le même tarif ne doivent pas doubler le billet. L'ensemble est un `Set` : ce cas le fige.
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([billet(1, 9, false)])

    const stats = await statsAvec({ tiers: [{ tierId: 9 }, { tierId: 9 }] })

    expect(stats.currentCount).toBe(1)
  })

  it('⚠️ NE DEMANDE PLUS LES LIGNES DANS L’INCLUDE DES QUOTAS', async () => {
    /*
     * La garde de branchement : le gain mesuré vient de la disparition de cet `include`
     * imbriqué. Un correctif qui regrouperait en mémoire **tout en gardant** l'ancienne lecture
     * ne coûterait pas moins cher, et les cas ci-dessus resteraient verts.
     */
    await statsAvec({ tiers: [{ tierId: 9 }] })

    const include = prismaMock.ticketingQuota.findMany.mock.calls[0][0].include
    expect(include.tiers.include, 'l’include imbriqué est de retour').toBeUndefined()
    expect(include.tiers.select).toEqual({ tierId: true })
  })
})
