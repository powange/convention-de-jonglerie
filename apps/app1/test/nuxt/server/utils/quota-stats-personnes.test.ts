import { describe, it, expect, beforeEach, vi } from 'vitest'

import { getQuotaStats } from '../../../../server/utils/editions/ticketing/quota-stats'

const prismaMock = (globalThis as any).prisma

/**
 * L'entrée des organisateurs dans le décompte d'un quota.
 *
 * Un organisateur est présent sur l'édition sans billet : rien ne le faisait compter, alors qu'il
 * occupe une place au même titre qu'un porteur de billet. Trois règles, arrêtées avec
 * l'utilisateur, et ce sont elles que ces tests tiennent :
 *
 * - un organisateur INSCRIT occupe sa place immédiatement, comme un billet compte dès la vente ;
 * - la validation de son entrée l'ajoute ENSUITE aux « validés », sans changer le total utilisé ;
 * - un organisateur qui aurait aussi un billet compte deux fois, faute de lien fiable entre les
 *   deux — le billet ne porte qu'une adresse de courriel.
 */
describe('quotas — la place qu’occupent les personnes sans billet', () => {
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

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])
    // Les options prises, désormais lues dans leur table de liaison (voir
    // quota-stats-options.test.ts) : sans ce défaut, le calcul n'a rien à parcourir.
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

  /**
   * Le test né d'un constat en production.
   *
   * La première version ne comptait que les entrées validées. Sur une édition de seize
   * organisateurs dont aucun n'était arrivé, la jauge affichait zéro — donc des places libres qui
   * ne l'étaient pas.
   */
  it('compte un organisateur inscrit avant même son arrivée', async () => {
    prismaMock.editionOrganizer.findMany.mockResolvedValue([
      { id: 7, entryValidated: false },
      { id: 8, entryValidated: false },
    ])

    const stats = await statsAvec({ organizers: [{ organizerId: null }] })

    expect(stats.currentCount).toBe(2)
    // Personne n'est encore passé à l'entrée.
    expect(stats.validatedCount).toBe(0)
  })

  it('interroge tous les organisateurs de l’édition, pas seulement les arrivés', async () => {
    await statsAvec({ organizers: [{ organizerId: null }] })

    expect(prismaMock.editionOrganizer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { editionId: 22 } })
    )
  })

  it('bascule dans les validés à la validation de l’entrée, sans changer le total', async () => {
    prismaMock.editionOrganizer.findMany.mockResolvedValue([
      { id: 7, entryValidated: true },
      { id: 8, entryValidated: false },
    ])

    const stats = await statsAvec({ organizers: [{ organizerId: null }] })

    expect(stats.currentCount).toBe(2)
    expect(stats.validatedCount).toBe(1)
  })

  it('ne compte qu’une fois l’organisateur visé globalement ET nommément', async () => {
    prismaMock.editionOrganizer.findMany.mockResolvedValue([{ id: 7, entryValidated: true }])

    const stats = await statsAvec({ organizers: [{ organizerId: null }, { organizerId: 7 }] })

    expect(stats.currentCount).toBe(1)
    // Et il ne vaut pas deux entrées validées non plus : le décompte porte sur l'ensemble
    // dédoublonné, pas sur les associations.
    expect(stats.validatedCount).toBe(1)
  })

  it('ignore une association vers un organisateur qui n’est plus inscrit', async () => {
    prismaMock.editionOrganizer.findMany.mockResolvedValue([{ id: 7, entryValidated: false }])

    const stats = await statsAvec({ organizers: [{ organizerId: 8 }] })

    expect(stats.currentCount).toBe(0)
  })

  /**
   * Le test qui justifie l'ensemble séparé.
   *
   * Le décompte des billets s'appuie sur un `Set` d'identifiants numériques bruts. Y verser les
   * identifiants d'organisateurs les ferait se confondre : l'organisateur nº 42 écraserait le
   * billet nº 42, et le total perdrait une unité sans que rien ne le signale.
   */
  it('ne confond pas un organisateur et un billet portant le même identifiant', async () => {
    prismaMock.editionOrganizer.findMany.mockResolvedValue([{ id: 42, entryValidated: true }])
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
      { id: 42, customFields: [], entryValidated: true },
    ])

    const stats = await statsAvec({
      organizers: [{ organizerId: 42 }],
      tiers: [{ tier: { orderItems: [{ id: 42, entryValidated: true }] } }],
    })

    // Une place pour le billet, une pour l'organisateur : deux, et non une.
    expect(stats.currentCount).toBe(2)
    expect(stats.validatedCount).toBe(2)
  })

  it('rapporte le pourcentage sur le total, organisateurs compris', async () => {
    prismaMock.editionOrganizer.findMany.mockResolvedValue([
      { id: 7, entryValidated: false },
      { id: 8, entryValidated: false },
    ])

    const stats = await statsAvec({ quantity: 8, organizers: [{ organizerId: null }] })

    expect(stats.currentCount).toBe(2)
    expect(stats.percentage).toBe(25)
  })

  describe('bénévoles', () => {
    const benevole = (id: number, teams: string[], entryValidated = false) => ({
      id,
      entryValidated,
      teamAssignments: teams.map((teamId) => ({ teamId })),
    })

    it('ne compte que les candidatures ACCEPTÉES', async () => {
      // Une candidature en attente n'est pas une venue décidée : le filtre est dans la requête,
      // pas dans le comptage.
      await statsAvec({ volunteers: [{ teamId: null }] })

      expect(prismaMock.editionVolunteerApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACCEPTED' }),
        })
      )
    })

    it('interroge les candidatures par eventId, pas par editionId', async () => {
      // Les candidatures sont rattachées à l'`Event`. Se tromper de colonne compterait les
      // bénévoles d'une autre édition, sans erreur.
      await statsAvec({ volunteers: [{ teamId: null }] })

      expect(prismaMock.editionVolunteerApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ eventId: 22 }) })
      )
    })

    it('compte tous les bénévoles acceptés sur une association globale', async () => {
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
        benevole(1, ['accueil']),
        benevole(2, []),
      ])

      const stats = await statsAvec({ volunteers: [{ teamId: null }] })

      // Y compris celui qui n'a pas d'équipe : il est présent sur l'édition.
      expect(stats.currentCount).toBe(2)
    })

    it('ne compte qu’une équipe désignée', async () => {
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
        benevole(1, ['accueil']),
        benevole(2, ['bar']),
      ])

      const stats = await statsAvec({ volunteers: [{ teamId: 'accueil' }] })

      expect(stats.currentCount).toBe(1)
    })

    /**
     * La divergence assumée avec les articles à remettre, où les articles d'une équipe
     * REMPLACENT les articles globaux. Un quota est une place : on l'occupe une fois.
     */
    it('n’occupe qu’une place quand le global et l’équipe visent le même bénévole', async () => {
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([benevole(1, ['accueil'])])

      const stats = await statsAvec({ volunteers: [{ teamId: null }, { teamId: 'accueil' }] })

      expect(stats.currentCount).toBe(1)
    })

    it('n’occupe qu’une place pour un bénévole de deux équipes associées', async () => {
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
        benevole(1, ['accueil', 'bar']),
      ])

      const stats = await statsAvec({ volunteers: [{ teamId: 'accueil' }, { teamId: 'bar' }] })

      expect(stats.currentCount).toBe(1)
    })

    it('bascule dans les validés à la validation de l’entrée', async () => {
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
        benevole(1, ['accueil'], true),
        benevole(2, ['accueil'], false),
      ])

      const stats = await statsAvec({ volunteers: [{ teamId: 'accueil' }] })

      expect(stats.currentCount).toBe(2)
      expect(stats.validatedCount).toBe(1)
    })
  })

  describe('artistes', () => {
    const artiste = (id: number, showIds: number[], entryValidated = false) => ({
      id,
      entryValidated,
      shows: showIds.map((showId) => ({ showId })),
    })

    it('compte tous les artistes sur une association globale', async () => {
      prismaMock.editionArtist.findMany.mockResolvedValue([artiste(1, [10]), artiste(2, [])])

      const stats = await statsAvec({ artists: [{ showId: null }] })

      expect(stats.currentCount).toBe(2)
    })

    it('ne compte que les artistes du spectacle désigné', async () => {
      prismaMock.editionArtist.findMany.mockResolvedValue([artiste(1, [10]), artiste(2, [11])])

      const stats = await statsAvec({ artists: [{ showId: 10 }] })

      expect(stats.currentCount).toBe(1)
    })

    /**
     * Le cas que le rattachement par spectacle rend possible, et qu'il faut tenir : un artiste
     * joue dans deux spectacles associés au même quota. Il n'y occupe qu'une place.
     */
    it('n’occupe qu’une place pour un artiste jouant dans deux spectacles associés', async () => {
      prismaMock.editionArtist.findMany.mockResolvedValue([artiste(1, [10, 11])])

      const stats = await statsAvec({ artists: [{ showId: 10 }, { showId: 11 }] })

      expect(stats.currentCount).toBe(1)
    })

    it('bascule dans les validés à la validation de l’entrée', async () => {
      prismaMock.editionArtist.findMany.mockResolvedValue([
        artiste(1, [10], true),
        artiste(2, [10], false),
      ])

      const stats = await statsAvec({ artists: [{ showId: 10 }] })

      expect(stats.currentCount).toBe(2)
      expect(stats.validatedCount).toBe(1)
    })
  })

  /**
   * Le test qui justifie un ensemble PAR FAMILLE.
   *
   * Les quatre familles portent des identifiants entiers issus de tables différentes. Un seul
   * ensemble partagé ferait que le bénévole nº 1 écrase l'organisateur nº 1 et l'artiste nº 1 :
   * quatre places deviendraient une, sans que rien ne le signale.
   */
  it('ne confond pas quatre personnes portant le même identifiant dans quatre familles', async () => {
    prismaMock.editionOrganizer.findMany.mockResolvedValue([{ id: 1, entryValidated: false }])
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
      { id: 1, entryValidated: false, teamAssignments: [] },
    ])
    prismaMock.editionArtist.findMany.mockResolvedValue([
      { id: 1, entryValidated: false, shows: [] },
    ])
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
      { id: 1, customFields: [], entryValidated: false },
    ])

    const stats = await statsAvec({
      organizers: [{ organizerId: null }],
      volunteers: [{ teamId: null }],
      artists: [{ showId: null }],
      tiers: [{ tier: { orderItems: [{ id: 1, entryValidated: false }] } }],
    })

    expect(stats.currentCount).toBe(4)
  })
})
