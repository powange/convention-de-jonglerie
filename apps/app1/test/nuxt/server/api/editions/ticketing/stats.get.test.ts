import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
  if (!(globalThis as any).validateEditionId) {
    ;(globalThis as any).validateEditionId = (event: any) =>
      parseInt(event?.context?.params?.id, 10)
  }
})

const mockCanAccess = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canAccessEditionDataOrAccessControl: mockCanAccess,
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../../server/api/editions/[id]/ticketing/stats.get'

const prismaMock = (globalThis as any).prisma

/**
 * Les compteurs du contrôle d'accès.
 *
 * La tuile « Participants » comptait des LIGNES DE COMMANDE : une personne venue avec un billet
 * vendredi et un billet samedi y comptait deux fois, au numérateur comme au dénominateur. Le point
 * d'API rend désormais les deux lectures — par billet et par personne — pour que l'écran bascule
 * d'un clic, sans nouvelle requête.
 */
describe('GET /api/editions/[id]/ticketing/stats', () => {
  const evenement = { context: { params: { id: '42' }, user: { id: 1 } } } as any

  /** Deux billets au même nom, un seul validé, plus une autre personne non validée. */
  const billets = [
    {
      firstName: 'Alice',
      lastName: 'Martin',
      entryValidated: true,
      entryValidatedAt: new Date(),
    },
    { firstName: 'alice', lastName: 'MARTIN', entryValidated: false, entryValidatedAt: null },
    { firstName: 'Bob', lastName: 'Durand', entryValidated: false, entryValidatedAt: null },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAccess.mockResolvedValue(true)
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue(billets)
    prismaMock.edition.findUnique.mockResolvedValue({ timezone: 'Europe/Paris' })
    // Aucune autre population : on isole la part des billets.
    prismaMock.editionVolunteerApplication.count.mockResolvedValue(0)
    prismaMock.editionArtist.count.mockResolvedValue(0)
    prismaMock.editionOrganizer.count.mockResolvedValue(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rend les deux lectures : trois billets, deux personnes', async () => {
    const reponse = (await handler(evenement)) as any
    const stats = reponse.data.stats

    expect(stats.totalTickets).toBe(3)
    expect(stats.ticketsValidated).toBe(1)
    // Alice a deux billets : une seule personne, comptée entrée car un billet est validé.
    expect(stats.totalPersonnes).toBe(2)
    expect(stats.personnesValidated).toBe(1)
  })

  it('ne lit les billets qu’une fois, pour que les deux comptes ne se contredisent pas', async () => {
    /*
     * Trois `count()` tenaient ce rôle avant. Les deux lectures tirées de requêtes séparées
     * pourraient se contredire à l'écran parce qu'une validation est tombée entre les deux — un
     * total regroupé supérieur au total par billet se lirait comme un bug.
     */
    await handler(evenement)

    expect(prismaMock.ticketingOrderItem.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.ticketingOrderItem.count).not.toHaveBeenCalled()
  })

  it('demande les champs d’identité nécessaires au regroupement', async () => {
    // Sans `firstName`/`lastName` dans le `select`, le regroupement serait muet : toutes les clés
    // vaudraient `null` et chaque billet compterait pour une personne — un chiffre faux, sans erreur.
    await handler(evenement)

    expect(prismaMock.ticketingOrderItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          firstName: true,
          lastName: true,
          entryValidated: true,
          entryValidatedAt: true,
        }),
      })
    )
  })

  /**
   * « Validés aujourd'hui » — constat B12.
   *
   * ## ⚠️ LE DÉFAUT
   *
   * `today.setHours(0, 0, 0, 0)` s'appliquait à l'horloge du CONTENEUR, qui tourne en UTC. Pour une
   * convention en France en été, le décalage est de deux heures, et il produit DEUX erreurs
   * opposées selon l'heure qu'il est — ce que la fiche d'audit ne disait qu'à moitié :
   *
   * - **avant 2 h du matin sur place**, la borne est celle de la veille 2 h : le compteur
   *   « aujourd'hui » inclut presque toute la journée de la veille ;
   * - **après 2 h du matin sur place**, la borne saute à 2 h du jour : les entrées de la nuit, entre
   *   minuit et 2 h, disparaissent du compteur.
   *
   * Autrement dit, le chiffre est trop haut jusqu'à 2 h, puis trop bas — et les heures concernées
   * sont exactement celles de fin de gala, quand on le regarde.
   *
   * ## ⚠️⚠️ CE QU'IL FAUT FIGER POUR QUE LES CAS SOIENT DÉCIDABLES
   *
   * L'HEURE COURANTE. Sans horloge figée, « aujourd'hui » dépend du moment où la CI tourne : les
   * cas seraient verts la journée et rouges la nuit, c'est-à-dire inutilisables. Chaque scénario
   * ci-dessous pose donc son instant, choisi dans le créneau où les deux découpages divergent.
   *
   * Le `where` d'un `count` est ignoré par le mock de Prisma : les bénévoles, artistes et
   * organisateurs ne peuvent donc rien prouver par leur résultat. Ce qui se mesure pour eux, c'est
   * la borne DEMANDÉE ; pour les billets, c'est le compte réel, dont le découpage est du calcul pur
   * dans `compterLesParticipants`.
   */
  describe('le début de la journée', () => {
    /** Une validation de billet à l'instant donné, seule population de l'édition. */
    const validationA = (instant: string) => {
      prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
        {
          firstName: 'Alice',
          lastName: 'Martin',
          entryValidated: true,
          entryValidatedAt: new Date(instant),
        },
      ])
    }

    const aujourdhui = async () =>
      ((await handler(evenement)) as any).data.stats.ticketsValidatedToday

    describe('juste après minuit sur place — le chiffre était trop HAUT', () => {
      // 22 h 30 UTC le 14/06 = 00 h 30 le 15/06 à Paris. Ancienne borne : 14/06 00 h UTC, soit la
      // veille 2 h du matin. Nouvelle borne : 15/06 00 h à Paris.
      beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-06-14T22:30:00Z'))
      })

      it('⚠️ N’Y COMPTE PLUS UNE ENTRÉE DE LA VEILLE AU SOIR', async () => {
        // 21 h 30 UTC = 23 h 30 à Paris le 14 : hier. L'ancienne borne la comptait pourtant dans
        // « aujourd'hui », avec toute la journée du 14 depuis 2 h du matin.
        validationA('2026-06-14T21:30:00Z')

        expect(await aujourdhui()).toBe(0)
      })

      it('mais compte bien une entrée passée APRÈS minuit sur place', async () => {
        /*
         * LE TÉMOIN de ce scénario. Sans lui, une borne posée trop tard — ou « aujourd'hui » vidé —
         * satisferait le cas ci-dessus, et le compteur n'afficherait plus jamais rien.
         */
        validationA('2026-06-14T22:15:00Z') // 00 h 15 à Paris le 15

        expect(await aujourdhui()).toBe(1)
      })
    })

    describe('passé 2 h du matin sur place — le chiffre était trop BAS', () => {
      // 01 h UTC le 15/06 = 03 h à Paris. Ancienne borne : 15/06 00 h UTC, soit 2 h du matin à
      // Paris — les entrées de minuit à 2 h tombaient hors du compte.
      beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-06-15T01:00:00Z'))
      })

      it('⚠️ N’OUBLIE PLUS LES ENTRÉES DE LA NUIT, entre minuit et 2 h', async () => {
        validationA('2026-06-14T23:00:00Z') // 01 h du matin à Paris le 15

        expect(await aujourdhui()).toBe(1)
      })

      it('et ne reprend pas pour autant la veille', async () => {
        // Le second témoin : la borne doit se déplacer, pas disparaître.
        validationA('2026-06-14T21:30:00Z') // 23 h 30 à Paris le 14

        expect(await aujourdhui()).toBe(0)
      })
    })

    describe('la borne envoyée aux trois autres populations', () => {
      beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-06-14T22:30:00Z'))
      })

      it('est la même pour les quatre', async () => {
        /*
         * Sans cela, le total « validés aujourd'hui » additionnerait deux journées différentes : les
         * billets découpés sur place, les trois autres sur la pendule du conteneur. Un total faux
         * composé de quatre chiffres dont trois sont faux au même endroit se remarque encore moins.
         */
        const debutAttendu = new Date('2026-06-15T00:00:00+02:00')
        await handler(evenement)

        const bornes = [
          prismaMock.editionVolunteerApplication.count,
          prismaMock.editionArtist.count,
          prismaMock.editionOrganizer.count,
        ].flatMap((compteur: any) =>
          compteur.mock.calls
            .map(([args]: [any]) => args?.where?.entryValidatedAt?.gte)
            .filter((v: unknown) => v !== undefined)
        )

        expect(bornes).toHaveLength(3)
        for (const borne of bornes) expect(borne.getTime()).toBe(debutAttendu.getTime())
      })
    })

    it('retombe sur l’horloge de la machine quand l’édition n’a pas de fuseau', async () => {
      /*
       * Une édition sans fuseau est le cas des données anciennes. Le comportement doit rester celui
       * d'avant — l'horloge locale — et surtout pas une date invalide : `gte: Invalid Date` ferait
       * répondre la base n'importe quoi, sans erreur.
       */
      prismaMock.edition.findUnique.mockResolvedValue({ timezone: null })
      validationA(new Date().toISOString())

      const stats = ((await handler(evenement)) as any).data.stats

      expect(Number.isNaN(stats.ticketsValidatedToday)).toBe(false)
      const borne = prismaMock.editionArtist.count.mock.calls
        .map(([args]: [any]) => args?.where?.entryValidatedAt?.gte)
        .find((v: unknown) => v !== undefined)
      expect(Number.isNaN(borne.getTime())).toBe(false)
    })
  })
})
