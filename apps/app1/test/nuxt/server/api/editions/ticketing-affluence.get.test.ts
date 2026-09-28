import { describe, it, expect, beforeEach, vi } from 'vitest'

/*
 * Les globales que Nitro pose à l'exécution, et qu'il faut poser AVANT l'import du handler : celui-ci
 * appelle `wrapApiHandler` au moment où son module est évalué, pas à l'appel. Sans ce préambule, le
 * fichier échoue sur « wrapApiHandler is not defined » et aucun test ne s'exécute.
 */
vi.hoisted(() => {
  const g = globalThis as any
  if (!g.wrapApiHandler) g.wrapApiHandler = (handler: any) => handler
  if (!g.validateEditionId) g.validateEditionId = (e: any) => parseInt(e?.context?.params?.id, 10)
  if (!g.createSuccessResponse)
    g.createSuccessResponse = (data: unknown) => ({ success: true, data })
})

import { global } from '../../../globales-nitro'

const canManageTicketingByIdMock = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: canManageTicketingByIdMock,
}))
vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: (event: any) => {
    if (!event.context.user) {
      const erreur = new Error('Non authentifié')
      ;(erreur as any).statusCode = 401
      throw erreur
    }
    return event.context.user
  },
}))

const handler = (
  await import('../../../../../server/api/editions/[id]/ticketing/stats/affluence.get')
).default

const prismaMock = (globalThis as any).prisma

/**
 * L'affluence : combien de PERSONNES sont sur place à un instant donné.
 *
 * Ce que ce point d'API a de particulier, et qui justifie chaque cas ci-dessous :
 *
 * - **une personne compte une fois.** Un bénévole qui a aussi acheté un billet est un seul corps.
 *   Compter les entrées surévalue l'affluence de 43 % sur l'édition 1 de la base de développement ;
 * - **la courbe redescend**, ce que le graphique voisin ne peut pas faire. Aucune sortie n'est
 *   enregistrée : la fin vient d'une fenêtre déclarée, et c'est tout le dispositif ;
 * - **une entrée annulée ne compte pas.** `INVALIDATED` est une correction de saisie, pas un départ.
 */
describe('GET /api/editions/[id]/ticketing/stats/affluence', () => {
  const VENDREDI = Date.UTC(2026, 6, 10)
  const JOUR = 86_400_000
  const H = 3_600_000

  const evenement = (granularity?: number) =>
    ({
      context: {
        params: { id: '21' },
        user: { id: 1, pseudo: 'orga' },
        query: granularity ? { granularity: String(granularity) } : {},
      },
    }) as any

  beforeEach(() => {
    vi.clearAllMocks()
    canManageTicketingByIdMock.mockResolvedValue(true)
    global.getQuery = vi.fn((e: any) => e?.context?.query ?? {})

    /*
     * Vendredi 0 h → dimanche 23 h. La fin de l'événement est le dimanche SOIR et non dimanche à
     * minuit : une première version de cette fixture s'arrêtait à `VENDREDI + 2 * JOUR`, donc à
     * l'instant où le dimanche commence — et les détenteurs de billets, dont la fenêtre par défaut
     * est celle de l'événement, disparaissaient du dimanche. Le code avait raison, la fixture
     * décrivait une édition qui n'existe pas.
     */
    prismaMock.event.findUnique.mockResolvedValue({
      startDate: new Date(VENDREDI),
      endDate: new Date(VENDREDI + 2 * JOUR + 23 * H),
      volunteerSettings: null,
    })
    prismaMock.edition.findUnique.mockResolvedValue({ timezone: 'UTC' })
    prismaMock.entryValidationLog.findMany.mockResolvedValue([])
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([])
    prismaMock.editionArtist.findMany.mockResolvedValue([])
    prismaMock.editionOrganizer.findMany.mockResolvedValue([])
  })

  const mouvement = (
    participantKind: string,
    participantId: number,
    createdAt: number,
    movement = 'VALIDATED'
  ) => ({ participantKind, participantId, movement, createdAt: new Date(createdAt) })

  describe('droits', () => {
    it('refuse un visiteur non connecté', async () => {
      await expect(handler({ context: { params: { id: '21' } } } as any)).rejects.toThrow(
        'Non authentifié'
      )
    })

    it('refuse quelqu’un sans droit sur la billetterie', async () => {
      canManageTicketingByIdMock.mockResolvedValue(false)

      await expect(handler(evenement())).rejects.toThrow(/Droits insuffisants/)
      // Le journal n'est même pas lu : le refus précède toute lecture de données.
      expect(prismaMock.entryValidationLog.findMany).not.toHaveBeenCalled()
    })
  })

  describe('granularité', () => {
    it('accepte les cinq granularités demandées', async () => {
      for (const minutes of [1440, 720, 360, 60, 20]) {
        const resultat = await handler(evenement(minutes))
        expect(resultat.data.granularity).toBe(minutes)
      }
    })

    it('retombe sur une heure devant une valeur non prévue', async () => {
      // Une granularité arbitraire découperait trois jours en dizaines de milliers de tranches.
      for (const mauvaise of [7, 0, -60, 99999]) {
        const resultat = await handler(evenement(mauvaise))
        expect(resultat.data.granularity).toBe(60)
      }
    })

    it('découpe trois jours en trois tranches à la journée', async () => {
      const resultat = await handler(evenement(1440))

      expect(resultat.data.timestamps).toHaveLength(3)
      expect(resultat.data.timestamps[0]).toBe(new Date(VENDREDI).toISOString())
    })

    it('découpe la même période en 216 tranches de vingt minutes', async () => {
      const resultat = await handler(evenement(20))

      expect(resultat.data.timestamps).toHaveLength(216)
    })
  })

  describe('dédoublonnage — le « personnes physiques » demandé', () => {
    it('ne compte qu’une fois un bénévole qui a aussi un billet, par son adresse', async () => {
      prismaMock.entryValidationLog.findMany.mockResolvedValue([
        mouvement('VOLUNTEER', 5, VENDREDI + 8 * H),
        mouvement('TICKET', 900, VENDREDI + 9 * H),
      ])
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
        {
          id: 5,
          user: { email: 'camille@exemple.test' },
          arrivalDateTime: null,
          departureDateTime: null,
        },
      ])
      prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
        { id: 900, email: 'camille@exemple.test', tier: null },
      ])

      const resultat = await handler(evenement(1440))

      expect(resultat.data.affluence).toEqual([1, 1, 1])
      expect(resultat.data.personnesDistinctes).toBe(1)
      // L'écart avec le nombre d'entrées est exactement ce que le dédoublonnage retire.
      expect(resultat.data.entreesRetenues).toBe(2)
    })

    it('compte deux personnes distinctes', async () => {
      // La contrepartie : sans elle, un dédoublonnage trop large passerait le test précédent en
      // ramenant tout le monde à une unité.
      prismaMock.entryValidationLog.findMany.mockResolvedValue([
        mouvement('VOLUNTEER', 5, VENDREDI + 8 * H),
        mouvement('TICKET', 900, VENDREDI + 9 * H),
      ])
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
        {
          id: 5,
          user: { email: 'camille@exemple.test' },
          arrivalDateTime: null,
          departureDateTime: null,
        },
      ])
      prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
        { id: 900, email: 'autre@exemple.test', tier: null },
      ])

      const resultat = await handler(evenement(1440))

      expect(resultat.data.personnesDistinctes).toBe(2)
    })

    it('rapproche deux billets par leur adresse, à la casse près', async () => {
      prismaMock.entryValidationLog.findMany.mockResolvedValue([
        mouvement('TICKET', 900, VENDREDI + 8 * H),
        mouvement('TICKET', 901, VENDREDI + 9 * H),
      ])
      prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
        { id: 900, email: 'Camille@Exemple.test', tier: null },
        { id: 901, email: 'camille@exemple.test ', tier: null },
      ])

      const resultat = await handler(evenement(1440))

      expect(resultat.data.personnesDistinctes).toBe(1)
    })

    it('ne rapproche PAS deux billets d’une même commande par l’adresse du payeur', async () => {
      /*
       * Décision de l'utilisateur, et elle est juste : l'adresse de la commande est celle de
       * l'ACHETEUR. S'en servir réduirait par construction les quatre billets d'une commande
       * familiale à une seule personne — alors que ce sont quatre corps sur le site.
       *
       * Un billet sans adresse propre compte donc pour lui-même.
       */
      prismaMock.entryValidationLog.findMany.mockResolvedValue([
        mouvement('TICKET', 900, VENDREDI + 8 * H),
        mouvement('TICKET', 901, VENDREDI + 8 * H),
      ])
      prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
        { id: 900, email: null, tier: null },
        { id: 901, email: null, tier: null },
      ])

      const resultat = await handler(evenement(1440))

      expect(resultat.data.personnesDistinctes).toBe(2)
    })

    it('ne demande même pas l’adresse de la commande', async () => {
      // La preuve porte sur la REQUÊTE : un mock rendrait `order` quoi qu'il arrive, donc seule la
      // sélection dit que cette donnée n'est plus consultée.
      prismaMock.entryValidationLog.findMany.mockResolvedValue([
        mouvement('TICKET', 900, VENDREDI + 8 * H),
      ])

      await handler(evenement(1440))

      const { select } = prismaMock.ticketingOrderItem.findMany.mock.calls[0][0]
      expect(select).not.toHaveProperty('order')
      expect(select).toHaveProperty('email', true)
    })

    it('ne confond pas le bénévole nº 42 et le billet nº 42, faute d’adresse', async () => {
      /*
       * Le piège relevé sur le comptage des quotas : des identifiants entiers bruts versés dans un
       * même ensemble se marchent dessus, et le total perd une unité sans rien signaler. Sans
       * adresse, chacun retombe sur sa clé technique — qui porte le nom de sa famille.
       */
      prismaMock.entryValidationLog.findMany.mockResolvedValue([
        mouvement('TICKET', 42, VENDREDI + 8 * H),
        mouvement('VOLUNTEER', 42, VENDREDI + 9 * H),
      ])
      prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
        { id: 42, email: null, tier: null },
      ])
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
        { id: 42, user: null, arrivalDateTime: null, departureDateTime: null },
      ])

      const resultat = await handler(evenement(1440))

      expect(resultat.data.personnesDistinctes).toBe(2)
    })
  })

  describe('la courbe redescend', () => {
    it('sort quelqu’un à la fin de la fenêtre de son tarif', async () => {
      /*
       * Tout le dispositif est là. Sans la fenêtre du tarif, aucune sortie n'étant enregistrée, la
       * courbe ne pourrait que monter — et le pic serait toujours le dernier jour.
       */
      prismaMock.entryValidationLog.findMany.mockResolvedValue([
        mouvement('TICKET', 900, VENDREDI + 8 * H),
      ])
      prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
        {
          id: 900,
          email: 'a@b.test',
          // Présent le vendredi seulement.
          tier: { presenceFrom: new Date(VENDREDI), presenceUntil: new Date(VENDREDI + JOUR) },
        },
      ])

      const resultat = await handler(evenement(1440))

      expect(resultat.data.affluence).toEqual([1, 0, 0])
    })

    it('garde quelqu’un jusqu’au bout sans dates de tarif', async () => {
      // Le repli choisi : toute la durée de l'édition. C'est le cas des 72 tarifs existants.
      prismaMock.entryValidationLog.findMany.mockResolvedValue([
        mouvement('TICKET', 900, VENDREDI + 8 * H),
      ])
      prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
        { id: 900, email: 'a@b.test', tier: null },
      ])

      const resultat = await handler(evenement(1440))

      expect(resultat.data.affluence).toEqual([1, 1, 1])
    })

    it('ne compte personne avant son entrée, même si son tarif l’annonce plus tôt', async () => {
      prismaMock.entryValidationLog.findMany.mockResolvedValue([
        // Entré le dimanche, alors que son tarif court depuis le vendredi.
        mouvement('TICKET', 900, VENDREDI + 2 * JOUR + 10 * H),
      ])
      prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
        {
          id: 900,
          email: 'a@b.test',
          tier: { presenceFrom: new Date(VENDREDI), presenceUntil: new Date(VENDREDI + 3 * JOUR) },
        },
      ])

      const resultat = await handler(evenement(1440))

      expect(resultat.data.affluence).toEqual([0, 0, 1])
    })
  })

  describe('les entrées annulées', () => {
    it('ne compte pas une entrée annulée ensuite', async () => {
      // `INVALIDATED` est une correction de saisie, pas un départ : la personne n'était pas là.
      prismaMock.entryValidationLog.findMany.mockResolvedValue([
        mouvement('TICKET', 900, VENDREDI + 8 * H),
        mouvement('TICKET', 900, VENDREDI + 9 * H, 'INVALIDATED'),
      ])
      /*
       * Le mock rend ce que la BASE rendrait pour `in: []`, c'est-à-dire rien.
       *
       * Une première version lui faisait rendre le billet quand même — un mock ignore le `where` —
       * et l'affluence sortait à 1 : le test accusait alors le code d'un défaut qui venait du mock.
       * L'assertion sur la requête, plus bas, est celle qui porte réellement la garde.
       */
      prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])

      const resultat = await handler(evenement(1440))

      expect(resultat.data.affluence).toEqual([0, 0, 0])
      expect(prismaMock.ticketingOrderItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [] } } })
      )
    })

    it('recompte une entrée annulée puis revalidée', async () => {
      prismaMock.entryValidationLog.findMany.mockResolvedValue([
        mouvement('TICKET', 900, VENDREDI + 8 * H),
        mouvement('TICKET', 900, VENDREDI + 9 * H, 'INVALIDATED'),
        mouvement('TICKET', 900, VENDREDI + JOUR + 10 * H),
      ])
      prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
        { id: 900, email: 'a@b.test', tier: null },
      ])

      const resultat = await handler(evenement(1440))

      // Et l'arrivée retenue est la SECONDE validation, pas la première : c'est celle qui tient.
      expect(resultat.data.affluence).toEqual([0, 1, 1])
    })
  })

  describe('le sommet', () => {
    it('dit combien au plus fort, et quand', async () => {
      prismaMock.entryValidationLog.findMany.mockResolvedValue([
        mouvement('TICKET', 900, VENDREDI + 8 * H),
        mouvement('TICKET', 901, VENDREDI + JOUR + 8 * H),
      ])
      prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
        {
          id: 900,
          email: 'a@b.test',
          // Repart le dimanche matin : il manque la dernière tranche.
          tier: { presenceFrom: null, presenceUntil: new Date(VENDREDI + 2 * JOUR) },
        },
        { id: 901, email: 'b@b.test', tier: null },
      ])

      const resultat = await handler(evenement(1440))

      expect(resultat.data.affluence).toEqual([1, 2, 1])
      expect(resultat.data.sommet).toEqual({
        valeur: 2,
        debut: new Date(VENDREDI + JOUR).toISOString(),
      })
    })

    it('rend un sommet à zéro sur une édition où personne n’est entré', async () => {
      const resultat = await handler(evenement(1440))

      expect(resultat.data.sommet).toEqual({ valeur: 0, debut: null })
      expect(resultat.data.affluence).toEqual([0, 0, 0])
    })
  })

  describe('les quatre populations', () => {
    it('réunit billets, bénévoles, artistes et organisateurs', async () => {
      prismaMock.entryValidationLog.findMany.mockResolvedValue([
        mouvement('TICKET', 900, VENDREDI + 8 * H),
        mouvement('VOLUNTEER', 5, VENDREDI + 8 * H),
        mouvement('ARTIST', 3, VENDREDI + 8 * H),
        mouvement('ORGANIZER', 2, VENDREDI + 8 * H),
      ])
      prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
        { id: 900, email: 'a@b.test', tier: null },
      ])
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
        {
          id: 5,
          user: { email: 'b@exemple.test' },
          arrivalDateTime: null,
          departureDateTime: null,
        },
      ])
      prismaMock.editionArtist.findMany.mockResolvedValue([
        {
          id: 3,
          user: { email: 'c@exemple.test' },
          arrivalDateTime: null,
          departureDateTime: null,
        },
      ])
      prismaMock.editionOrganizer.findMany.mockResolvedValue([
        {
          id: 2,
          arrivalDateTime: null,
          departureDateTime: null,
          organizer: { user: { email: 'd@exemple.test' } },
        },
      ])

      const resultat = await handler(evenement(1440))

      expect(resultat.data.personnesDistinctes).toBe(4)
    })

    it('lit les dates d’un organisateur au format des bénévoles', async () => {
      // Choix de l'utilisateur : « comme pour les bénévoles ». Le même util décode les deux.
      prismaMock.entryValidationLog.findMany.mockResolvedValue([
        mouvement('ORGANIZER', 2, VENDREDI + 6 * H),
      ])
      prismaMock.editionOrganizer.findMany.mockResolvedValue([
        {
          id: 2,
          arrivalDateTime: '2026-07-10_morning',
          departureDateTime: '2026-07-10_evening',
          organizer: { user: { email: 'd@exemple.test' } },
        },
      ])

      const resultat = await handler(evenement(1440))

      // Présent le vendredi seulement : ses dates le font sortir, comme un bénévole.
      expect(resultat.data.affluence).toEqual([1, 0, 0])
    })
  })

  describe('édition introuvable', () => {
    it('rend 404 plutôt qu’une courbe vide', async () => {
      prismaMock.event.findUnique.mockResolvedValue(null)

      await expect(handler(evenement())).rejects.toThrow('Edition not found')
    })
  })
})
