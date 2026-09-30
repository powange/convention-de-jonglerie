import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn(() => ({ id: 1, email: 'orga@test.com' })),
}))

const droitAccorde = vi.hoisted(() => vi.fn(async () => true))
vi.mock('../../../../../../server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: droitAccorde,
}))

import handler from '../../../../../../server/api/editions/[id]/ticketing/stats/purchases.get'
import { global } from '../../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Le graphique des achats dans le temps.
 *
 * ⚠️ DEUX DÉFAUTS, et le graphique s'affichait sans rien dire dans les deux cas.
 *
 * 1. LES LIGNES N'ÉTAIENT PAS TRIÉES. Seul `order.status` était filtré : un billet ANNULÉ au sein
 *    d'une commande vivante comptait pour un achat. Exactement le défaut corrigé dans le graphique
 *    de PROVENANCE, sur le même écran, et laissé entier dans celui-ci.
 *
 * 2. LES BILLETS SANS TARIF DISPARAISSAIENT DES DEUX GROUPES. `countAsParticipant` vit sur le
 *    tarif, et `tierId` est nullable : tester `true` puis `false` ne laisse aucune place aux 47
 *    lignes sans tarif relevées en production. Elles n'étaient donc dans aucune des quatre
 *    courbes, tout en étant validées au guichet.
 *
 * ⚠️ POURQUOI C'ÉTAIT DEVENU VISIBLE. Les deux graphiques sont côte à côte, tirés de la même base.
 * Avant la correction de la provenance ils étaient faux TOUS LES DEUX et se recoupaient ; depuis,
 * ils ne se recoupaient plus, et rien ne disait lequel croire. Une correction partielle rend une
 * incohérence visible — c'est un argument pour finir, pas pour regretter.
 *
 * 🔬 LES TESTS PORTENT SUR LA FORME DES REQUÊTES, et c'est le seul niveau possible : le mock de
 * Prisma IGNORE le `where`. Un test qui compterait des points de courbe mesurerait ce qu'on a
 * demandé au mock de rendre, pas ce que la base rendrait. Ce qui se vérifie ici, c'est ce qu'on
 * DEMANDE.
 */

const EDITION = 42
const evenement = { context: { params: { id: String(EDITION) }, user: { id: 1 } } } as any

describe('GET /api/editions/[id]/ticketing/stats/purchases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    droitAccorde.mockResolvedValue(true)
    global.validateEditionId = vi.fn(() => EDITION) as any
    global.getQuery = vi.fn(() => ({})) as any
    prismaMock.edition.findUnique.mockResolvedValue({
      id: EDITION,
      startDate: new Date('2026-07-01T00:00:00Z'),
      endDate: new Date('2026-07-05T00:00:00Z'),
    })
    prismaMock.ticketingOrder.findFirst.mockResolvedValue({
      orderDate: new Date('2026-06-01T00:00:00Z'),
    })
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])
  })

  /** Les quatre `where` de lignes demandés par le handler. */
  const whereDesLignes = () =>
    prismaMock.ticketingOrderItem.findMany.mock.calls.map((appel: any) => appel[0].where)

  it('écarte les LIGNES annulées', async () => {
    /*
     * 🔬 L'assertion centrale du premier défaut. `billetsQuiComptent` retient `Processed` et
     * `Pending` — la même règle que le guichet et que le graphique voisin. Sans elle, un billet
     * `Canceled` d'une commande vivante gonflait la courbe.
     */
    await handler(evenement)

    const où = whereDesLignes()
    expect(où).toHaveLength(4)
    for (const w of où) {
      expect(w.state).toEqual({ in: ['Processed', 'Pending'] })
    }
  })

  it('range les billets SANS TARIF dans « autres »', async () => {
    /*
     * 🔬 L'assertion centrale du second défaut, et la plus facile à rater. L'ancien code écrivait
     * `tier: { countAsParticipant: false }` : une ligne sans tarif ne satisfait NI ce test, NI son
     * contraire, et disparaissait des quatre courbes. La règle partagée dit « pas un participant,
     * OU pas de tarif du tout ».
     */
    await handler(evenement)

    const [, , autresManuel, autresExterne] = whereDesLignes()

    for (const w of [autresManuel, autresExterne]) {
      expect(w.AND).toEqual([{ OR: [{ tier: { countAsParticipant: false } }, { tierId: null }] }])
      // Et plus aucune trace de l'ancien test, qui les manquait.
      expect(w.tier).toBeUndefined()
    }
  })

  it('compose le fragment à `OR` sous un `AND`', async () => {
    /*
     * ⚠️ La règle écrite dans `billets-qui-comptent.ts` : un fragment porteur d'un `OR` s'ajoute
     * sous `AND`, jamais étalé dans le `where`. Étalé à côté d'un autre `OR` — celui d'une
     * recherche par nom, par exemple — l'un des deux écraserait l'autre en silence. Il n'y a pas
     * d'autre `OR` ici aujourd'hui : c'est précisément pourquoi la règle vaut d'être tenue
     * maintenant plutôt qu'au moment où l'on en ajoutera un.
     */
    await handler(evenement)

    const [, , autresManuel] = whereDesLignes()

    expect(autresManuel.OR).toBeUndefined()
    expect(Array.isArray(autresManuel.AND)).toBe(true)
  })

  it('garde les deux courbes de PARTICIPANTS sur le tarif', async () => {
    // Le pendant : un participant, lui, se reconnaît bien à son tarif. La correction ne doit pas
    // faire basculer des participants dans « autres ».
    await handler(evenement)

    const [participantsManuel, participantsExterne] = whereDesLignes()

    for (const w of [participantsManuel, participantsExterne]) {
      expect(w.tier).toEqual({ countAsParticipant: true })
      expect(w.AND).toBeUndefined()
    }
  })

  it('sépare guichet et billetterie externe sur `externalTicketingId`', async () => {
    // Non-régression : c'est ce qui distingue les quatre courbes entre elles.
    await handler(evenement)

    const où = whereDesLignes()
    const manuels = où.filter((w: any) => w.order.externalTicketingId === null)
    const externes = où.filter((w: any) => w.order.externalTicketingId?.not === null)

    expect(manuels).toHaveLength(2)
    expect(externes).toHaveLength(2)
  })

  it('restreint le statut de la COMMANDE aux mêmes valeurs que la provenance', async () => {
    /*
     * Les deux graphiques du même écran doivent compter pareil. La liste est POSITIVE plutôt qu'un
     * complément : un statut inventé demain par un fournisseur n'entrerait pas dans le compte sans
     * qu'on l'ait décidé.
     */
    await handler(evenement)

    for (const w of whereDesLignes()) {
      expect(w.order.status).toEqual({ in: ['Processed', 'Onsite'] })
      expect(w.order.editionId).toBe(EDITION)
    }
  })

  it('borne les quatre requêtes à la période affichée', async () => {
    // Perdre cette borne ferait compter des achats hors du graphique : le total ne
    // correspondrait plus à la somme des points affichés.
    await handler(evenement)

    for (const w of whereDesLignes()) {
      expect(w.order.orderDate.gte).toBeInstanceOf(Date)
      expect(w.order.orderDate.lte).toBeInstanceOf(Date)
    }
  })

  it('REFUSE sans le droit de gérer la billetterie', async () => {
    droitAccorde.mockResolvedValue(false)

    await expect(handler(evenement)).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.ticketingOrderItem.findMany).not.toHaveBeenCalled()
  })

  it('rend les quatre séries et leurs totaux', async () => {
    // Non-régression de la forme de la réponse : l'écran lit ces six tableaux par leur nom.
    const reponse: any = await handler(evenement)

    expect(reponse.labels.length).toBeGreaterThan(0)
    expect(reponse.timestamps).toHaveLength(reponse.labels.length)
    expect(reponse.totals).toEqual({
      participantsManual: 0,
      participantsExternal: 0,
      othersManual: 0,
      othersExternal: 0,
    })
  })
})
