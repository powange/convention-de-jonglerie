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
      timezone: 'Europe/Paris',
    })
    prismaMock.ticketingOrder.findFirst.mockResolvedValue({
      orderDate: new Date('2026-06-01T00:00:00Z'),
    })
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])
  })

  /**
   * Un achat, rendu pour la SEULE courbe des participants au guichet.
   *
   * ⚠️ On répond d'après ce qui est DEMANDÉ, et non d'après l'ordre des appels : le handler lance
   * ses quatre requêtes dans un `Promise.all`, et un test qui compterait les appels casserait au
   * premier remaniement. Rendre le même achat aux quatre le compterait quatre fois, ce qui rendrait
   * illisible la seule chose qu'on mesure ici — la TRANCHE où il tombe.
   */
  const achatAu = (...instants: string[]) => {
    prismaMock.ticketingOrderItem.findMany.mockImplementation((args: any) =>
      Promise.resolve(
        args?.where?.order?.externalTicketingId === null &&
          args?.where?.tier?.countAsParticipant === true
          ? instants.map((i) => ({ order: { orderDate: new Date(i) } }))
          : []
      )
    )
  }

  /** La tranche où un achat a été compté : la seule dont la courbe n'est pas à zéro. */
  const trancheComptee = (reponse: any) =>
    reponse.timestamps[reponse.participantsManual.findIndex((n: number) => n > 0)]

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
    // Non-régression de la forme de la réponse : l'écran lit ces tableaux par leur nom.
    const reponse: any = await handler(evenement)

    expect(reponse.timestamps.length).toBeGreaterThan(0)
    expect(reponse.participantsManual).toHaveLength(reponse.timestamps.length)
    expect(reponse.totals).toEqual({
      participantsManual: 0,
      participantsExternal: 0,
      othersManual: 0,
      othersExternal: 0,
    })
  })

  /**
   * Le découpage dans le temps — constat B11.
   *
   * ## ⚠️ LE DÉFAUT
   *
   * Les tranches étaient découpées sur l'horloge de la MACHINE (`setHours(0, 0, 0, 0)`, puis
   * `DateTime.fromJSDate` sans zone) et les étiquettes composées par le serveur en
   * `setLocale('fr')`. Le conteneur tourne en UTC : un achat passé à 0 h 30 heure de Paris tombait
   * donc dans la journée de la VEILLE, et l'axe s'affichait en français quelle que soit la langue
   * de l'écran. Le graphique des validations, juste à côté sur le même écran, avait déjà été
   * corrigé : les deux courbes se lisaient côte à côte sans parler du même temps.
   *
   * ## ⚠️⚠️ CE QUI REND CES CAS NON CREUX
   *
   * Le mock de Prisma ignore le `where` — c'est dit plus haut, et c'est pourquoi les cas
   * précédents portent sur la forme des requêtes. Ici la mesure est différente : le DÉCOUPAGE est
   * du calcul pur, fait dans le handler sur ce que la base a rendu. On choisit donc l'instant d'un
   * achat et l'on vérifie dans quelle tranche il est compté. Le mock n'y décide de rien.
   *
   * Le témoin est le cas `UTC` : sans lui, un découpage qui resterait sur la pendule du serveur
   * passerait au vert dès que cette pendule est à l'heure de Paris — ce qui est le cas sur un poste
   * de développement, et jamais en production.
   */
  describe('le découpage dans le temps', () => {
    it('⚠️ RANGE UN ACHAT DE 23 H 30 UTC DANS LE LENDEMAIN, à l’heure du lieu', async () => {
      // 23 h 30 UTC le 14/06 = 1 h 30 du matin le 15/06 à Paris. C'est le 15 qui doit le compter :
      // l'organisateur qui lit ce graphique est sur place, pas à Greenwich.
      achatAu('2026-06-14T23:30:00Z')

      const reponse: any = await handler(evenement)

      expect(trancheComptee(reponse)).toBe('2026-06-15T00:00:00.000+02:00')
    })

    it('le compte bien la VEILLE quand l’édition est en UTC', async () => {
      /*
       * LE TÉMOIN. Le même instant, une autre édition : si le découpage ignorait le fuseau reçu,
       * les deux cas rendraient la même tranche et le premier ne prouverait rien.
       */
      prismaMock.edition.findUnique.mockResolvedValue({
        id: EDITION,
        startDate: new Date('2026-07-01T00:00:00Z'),
        endDate: new Date('2026-07-05T00:00:00Z'),
        timezone: 'UTC',
      })
      achatAu('2026-06-14T23:30:00Z')

      const reponse: any = await handler(evenement)

      expect(trancheComptee(reponse)).toBe('2026-06-14T00:00:00.000Z')
    })

    it('fait commencer « 1 semaine » un LUNDI, et non un jeudi', async () => {
      /*
       * L'ancien arrondi divisait le timestamp par 10 080 minutes depuis l'époque Unix — le
       * 1ᵉʳ janvier 1970 était un JEUDI. Les tranches commençaient donc un jeudi sous une étiquette
       * « Semaine du … », ce que personne ne pouvait deviner depuis l'écran.
       */
      global.getQuery = vi.fn(() => ({ granularity: '10080' })) as any
      // Le mercredi 17/06 appartient à la semaine du lundi 15/06.
      achatAu('2026-06-17T10:00:00Z')

      const reponse: any = await handler(evenement)

      expect(trancheComptee(reponse)).toBe('2026-06-15T00:00:00.000+02:00')
    })

    it('fait commencer « 1 mois » le PREMIER du mois', async () => {
      /*
       * L'ancien arrondi découpait par blocs de trente jours depuis l'époque, sous une étiquette
       * « Juin 2026 » : un bloc pouvait chevaucher deux mois, et l'étiquette en nommait un seul.
       */
      global.getQuery = vi.fn(() => ({ granularity: '43200' })) as any
      achatAu('2026-06-17T10:00:00Z')

      const reponse: any = await handler(evenement)

      expect(trancheComptee(reponse)).toBe('2026-06-01T00:00:00.000+02:00')
    })

    it('ne compose plus les libellés, et dit dans quel fuseau il a découpé', async () => {
      /*
       * La langue de l'axe revient au lecteur. Sans ce cas, le serveur pourrait recommencer à
       * composer « Lun 15/06 » en français et le client, qui formate désormais lui-même, afficherait
       * les deux formes selon les écrans sans que rien ne tombe.
       */
      const reponse: any = await handler(evenement)

      expect(reponse.labels).toBeUndefined()
      expect(reponse.timezone).toBe('Europe/Paris')
    })
  })
})
