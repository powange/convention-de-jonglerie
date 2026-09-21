import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('#server/utils/api-helpers', () => ({
  wrapApiHandler: (handler: any) => handler,
  createSuccessResponse: (data: any) => ({ success: true, data }),
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: (event: any) => event.context.user,
}))

vi.mock('#server/utils/validation-helpers', () => ({
  validateEditionId: (event: any) => parseInt(event?.context?.params?.id, 10),
}))

const mockPeutGerer = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: mockPeutGerer,
}))

const mockExigerActifs = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/ticketing/handout-items-actifs', () => ({
  exigerArticlesARemettreActifs: mockExigerActifs,
}))

import handler from '../../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/handout-items/volumes.get'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '22' }, user: { id: 7 } } }

/**
 * Les volumes d'articles à remettre : ce qu'il faut avoir, ce qui est sorti, ce qui reste.
 *
 * Ce qui se joue ici n'est pas le rendu mais l'EXACTITUDE d'un chiffre que personne ne pourra
 * recouper. Un organisateur commande sur ce nombre six semaines avant ; s'il est faux, rien ne
 * le signale — ni l'écran, ni les journaux. Les deux façons de se tromper sont éprouvées
 * séparément : compter deux fois un article non cumulable, et perdre les exemplaires d'un
 * article cumulable.
 *
 * La règle de calcul elle-même est éprouvée à part, dans `volumes-des-articles.test.ts`. Ces
 * tests-ci assurent que le point d'API la NOURRIT correctement : les bonnes personnes, les
 * bonnes associations, et les billets annulés écartés.
 */

const article = (id: number, name: string, cumulative = false) => ({ id, name, cumulative })
const assoc = (id: number, name: string, cumulative = false, quantity = 1) => ({
  handoutItem: article(id, name, cumulative),
  quantity,
})

/** Aucune population, sauf celles qu'un test peuple explicitement. */
const videPartout = () => {
  prismaMock.ticketingHandoutItem.findMany.mockResolvedValue([])
  prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])
  prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([])
  prismaMock.editionArtist.findMany.mockResolvedValue([])
  prismaMock.editionOrganizer.findMany.mockResolvedValue([])
  prismaMock.editionVolunteerHandoutItem.findMany.mockResolvedValue([])
  prismaMock.editionArtistHandoutItem.findMany.mockResolvedValue([])
  prismaMock.editionOrganizerHandoutItem.findMany.mockResolvedValue([])
  prismaMock.volunteerMealSelection.findMany.mockResolvedValue([])
  prismaMock.artistMealSelection.findMany.mockResolvedValue([])
  prismaMock.organizerMealSelection.findMany.mockResolvedValue([])
}

const volumesDe = async () => (await handler(evenement as any)).data.volumes

describe('GET /api/editions/[id]/ticketing/handout-items/volumes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPeutGerer.mockResolvedValue(true)
    mockExigerActifs.mockResolvedValue(undefined)
    videPartout()
  })

  it("refuse l'accès sans droits, et ne lit RIEN", async () => {
    mockPeutGerer.mockResolvedValue(false)

    await expect(handler(evenement as any)).rejects.toThrow(/Droits insuffisants/)
    expect(prismaMock.ticketingHandoutItem.findMany).not.toHaveBeenCalled()
    expect(prismaMock.ticketingOrderItem.findMany).not.toHaveBeenCalled()
  })

  it('vérifie les droits AVANT de dire si le module est actif', async () => {
    // Qui n'a pas le droit d'être là ne doit pas apprendre au passage le paramétrage de l'édition.
    mockPeutGerer.mockResolvedValue(false)

    await expect(handler(evenement as any)).rejects.toThrow()
    expect(mockExigerActifs).not.toHaveBeenCalled()
  })

  it('refuse quand le module est éteint, plutôt que de rendre un tableau vide', async () => {
    // Un tableau vide se lirait « rien à prévoir » — la pire des réponses sur cet écran.
    mockExigerActifs.mockRejectedValue(new Error('Les articles à remettre sont désactivés'))

    await expect(handler(evenement as any)).rejects.toThrow(/désactivés/)
    expect(prismaMock.ticketingOrderItem.findMany).not.toHaveBeenCalled()
  })

  it('écarte les billets annulés et les commandes remboursées', async () => {
    await handler(evenement as any)

    // La règle n'est pas récrite dans ce point d'API : il emploie le vocabulaire du guichet.
    // Si ce `where` s'appauvrissait, un billet annulé gonflerait la commande de tee-shirts.
    const where = prismaMock.ticketingOrderItem.findMany.mock.calls[0][0].where
    expect(where.state).toEqual({ in: ['Processed', 'Pending'] })
    expect(where.order).toMatchObject({ editionId: 22, status: { not: 'Refunded' } })
  })

  it('ne compte QUE les candidatures acceptées, toutes disponibilités confondues', async () => {
    await handler(evenement as any)

    const where = prismaMock.editionVolunteerApplication.findMany.mock.calls[0][0].where
    // ⚠️ `eventId`, pas `editionId` : la candidature n'est pas scopée comme le reste.
    expect(where).toEqual({ eventId: 22, status: 'ACCEPTED' })
    // Le guichet écarte les bénévoles de montage ; une prévision de volumes n'a pas cette raison.
    expect(where.eventAvailability).toBeUndefined()
  })

  it('N’ADDITIONNE PAS un article non cumulable venu du tarif ET d’une option', async () => {
    // Le défaut que le guichet a déjà commis, porté ici à l'échelle de l'édition : il ferait
    // commander le double.
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
      {
        id: 1,
        firstName: 'Alice',
        lastName: 'Martin',
        entryValidated: false,
        customFields: [],
        tier: { id: 1, name: 'Pass', handoutItems: [assoc(9, 'Bracelet')], customFields: [] },
        selectedOptions: [{ option: { handoutItems: [assoc(9, 'Bracelet')] } }],
      },
    ])

    const volumes = await volumesDe()
    expect(volumes).toHaveLength(1)
    expect(volumes[0]).toMatchObject({ id: 9, name: 'Bracelet', attendu: 1 })
  })

  it('additionne bien les exemplaires d’un article cumulable', async () => {
    prismaMock.editionArtist.findMany.mockResolvedValue([
      {
        id: 3,
        entryValidated: false,
        user: { prenom: 'Bob', nom: 'Durand' },
        handoutItems: [],
        shows: [
          { show: { handoutItems: [assoc(4, 'Ticket boisson', true, 3)] } },
          { show: { handoutItems: [assoc(4, 'Ticket boisson', true, 3)] } },
        ],
      },
    ])

    const volumes = await volumesDe()
    expect(volumes[0]).toMatchObject({ id: 4, name: 'Ticket boisson', attendu: 6 })
  })

  it('applique la surcharge d’équipe des bénévoles : l’équipe REMPLACE le global', async () => {
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
      {
        id: 11,
        entryValidated: false,
        user: { prenom: 'Chloé', nom: 'Petit' },
        teamAssignments: [{ team: { id: 'cuisine' } }],
      },
    ])
    prismaMock.editionVolunteerHandoutItem.findMany.mockResolvedValue([
      { teamId: null, ...assoc(1, 'Bracelet') },
      { teamId: 'cuisine', ...assoc(2, 'Tablier') },
    ])

    const volumes = await volumesDe()
    // Le bracelet global ne lui revient pas : son équipe porte un article.
    expect(volumes.map((v: any) => v.name)).toEqual(['Tablier'])
  })

  it('compte comme SORTI ce qui revient à une entrée validée, et nomme les autres', async () => {
    // La décision du 21/09/2026 : la validation d'entrée vaut remise.
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
      {
        id: 1,
        firstName: 'Alice',
        lastName: 'Martin',
        entryValidated: true,
        customFields: [],
        tier: { id: 1, name: 'Pass', handoutItems: [assoc(9, 'Sweat')], customFields: [] },
        selectedOptions: [],
      },
      {
        id: 2,
        firstName: 'Bob',
        lastName: 'Durand',
        entryValidated: false,
        customFields: [],
        tier: { id: 1, name: 'Pass', handoutItems: [assoc(9, 'Sweat')], customFields: [] },
        selectedOptions: [],
      },
    ])

    const volumes = await volumesDe()
    expect(volumes[0]).toMatchObject({ attendu: 2, sorti: 1, reste: 1 })
    expect(volumes[0].enAttente).toEqual([
      { cle: 'participants:2', id: 2, nom: 'Bob Durand', population: 'participants', quantity: 1 },
    ])
  })

  it('décompose par population', async () => {
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
      {
        id: 1,
        firstName: 'Alice',
        lastName: 'Martin',
        entryValidated: false,
        customFields: [],
        tier: { id: 1, name: 'Pass', handoutItems: [assoc(9, 'Sweat')], customFields: [] },
        selectedOptions: [],
      },
    ])
    prismaMock.editionOrganizer.findMany.mockResolvedValue([
      {
        id: 5,
        entryValidated: true,
        organizer: { user: { prenom: 'Zoé', nom: 'Blanc' } },
        handoutItems: [assoc(9, 'Sweat')],
      },
    ])

    const volumes = await volumesDe()
    expect(volumes[0].parPopulation).toEqual({
      participants: { attendu: 1, sorti: 0 },
      benevoles: { attendu: 0, sorti: 0 },
      artistes: { attendu: 0, sorti: 0 },
      organisateurs: { attendu: 1, sorti: 1 },
    })
  })

  it('ne cherche JAMAIS les articles globaux des organisateurs avec un `in` contenant null', async () => {
    // En SQL, une comparaison avec NULL n'est jamais vraie : les articles globaux
    // disparaîtraient sans la moindre erreur, et le volume serait silencieusement trop bas.
    prismaMock.editionOrganizer.findMany.mockResolvedValue([
      { id: 5, entryValidated: false, organizer: { user: {} }, handoutItems: [] },
    ])

    await handler(evenement as any)

    const where = prismaMock.editionOrganizerHandoutItem.findMany.mock.calls[0][0].where
    expect(where).toEqual({ editionId: 22, organizerId: null })
  })

  it('fait apparaître à zéro un article que personne ne reçoit', async () => {
    prismaMock.ticketingHandoutItem.findMany.mockResolvedValue([{ id: 9, name: 'Sweat' }])

    const volumes = await volumesDe()
    expect(volumes).toEqual([
      expect.objectContaining({ id: 9, name: 'Sweat', attendu: 0, sorti: 0, reste: 0 }),
    ])
  })

  it('rend le nombre de personnes vues par population, pour que le total se vérifie', async () => {
    prismaMock.editionArtist.findMany.mockResolvedValue([
      { id: 3, entryValidated: false, user: {}, handoutItems: [], shows: [] },
    ])

    const reponse = await handler(evenement as any)
    expect(reponse.data.personnes).toEqual({
      participants: 0,
      benevoles: 0,
      artistes: 1,
      organisateurs: 0,
    })
    expect(reponse.data.calculeLe).toEqual(expect.any(String))
  })

  it('n’interroge ni les repas ni les associations quand une population est vide', async () => {
    // Onze requêtes fixes suffiraient à être lentes sur un écran ouvert souvent ; celles qui ne
    // serviraient à rien ne partent pas.
    await handler(evenement as any)

    expect(prismaMock.editionVolunteerHandoutItem.findMany).not.toHaveBeenCalled()
    expect(prismaMock.artistMealSelection.findMany).not.toHaveBeenCalled()
    expect(prismaMock.organizerMealSelection.findMany).not.toHaveBeenCalled()
  })
})
