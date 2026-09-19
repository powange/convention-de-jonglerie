import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
  if (!(globalThis as any).validateEditionId) {
    ;(globalThis as any).validateEditionId = (event: any) =>
      parseInt(event?.context?.params?.id, 10)
  }
})

const mockCanAccessEditionData = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canAccessEditionDataOrAccessControl: mockCanAccessEditionData,
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../../server/api/editions/[id]/ticketing/recent-validations.get'

const prismaMock = (globalThis as any).prisma

/**
 * Le fil des derniers mouvements, lu dans le JOURNAL et non dans l'état courant.
 *
 * L'ancienne version balayait les quatre tables sur `entryValidatedAt`. Elle ne pouvait donc
 * montrer que ce qui était encore vrai : une entrée validée puis annulée en disparaissait, et une
 * annulation n'y figurait jamais. Ces deux cas sont ce que ces tests couvrent — ils sont la raison
 * d'être du remplacement, et ce qui se casserait en premier si quelqu'un revenait à l'état.
 */
describe('GET /api/editions/[id]/ticketing/recent-validations', () => {
  const evenement = { context: { params: { id: '42' }, user: { id: 1 } } }

  const mouvement = (attrs: Record<string, unknown>) => ({
    id: 1,
    editionId: 42,
    participantKind: 'TICKET',
    participantId: 300,
    movement: 'VALIDATED',
    actorId: null,
    createdAt: new Date('2026-09-19T12:00:00Z'),
    ...attrs,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAccessEditionData.mockResolvedValue(true)
    prismaMock.entryValidationLog.findMany.mockResolvedValue([])
  })

  it("refuse l'accès sans droits, et n'interroge pas le journal", async () => {
    mockCanAccessEditionData.mockResolvedValue(false)

    await expect(handler(evenement as any)).rejects.toThrow(/Droits insuffisants/)
    expect(prismaMock.entryValidationLog.findMany).not.toHaveBeenCalled()
  })

  it('lit le journal de CETTE édition, les dix derniers, du plus récent au plus ancien', async () => {
    await handler(evenement as any)

    expect(prismaMock.entryValidationLog.findMany).toHaveBeenCalledWith({
      where: { editionId: 42 },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
  })

  it("n'interroge aucune autre table quand le journal est vide", async () => {
    const resultat = await handler(evenement as any)

    // Le cas de toutes les éditions antérieures au 19/09/2026 : le journal ne les couvre pas.
    // Rien ne doit être balayé pour autant.
    expect(resultat.data.validations).toEqual([])
    expect(prismaMock.ticketingOrderItem.findMany).not.toHaveBeenCalled()
    expect(prismaMock.user.findMany).not.toHaveBeenCalled()
  })

  it('rend une ANNULATION, que l’ancienne version ne pouvait pas montrer', async () => {
    prismaMock.entryValidationLog.findMany.mockResolvedValue([
      mouvement({ id: 2, movement: 'INVALIDATED', actorId: 77 }),
      mouvement({ id: 1, movement: 'VALIDATED', actorId: 77 }),
    ])
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
      { id: 300, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@x.fr', name: 'Pass' },
    ])
    prismaMock.user.findMany.mockResolvedValue([
      { id: 77, pseudo: 'grace', prenom: 'Grace', nom: 'Hopper', email: 'g@x.fr', emailHash: 'h' },
    ])

    const resultat = await handler(evenement as any)

    // Les DEUX mouvements de la même personne figurent au fil : validée, puis annulée. C'est
    // exactement la séquence qui disparaissait quand on lisait l'état courant.
    expect(resultat.data.validations.map((v: any) => v.movement)).toEqual([
      'INVALIDATED',
      'VALIDATED',
    ])
    // L'identifiant est celui de la LIGNE DE JOURNAL : sur l'identifiant du participant, les deux
    // lignes se seraient écrasées dans le `v-for`.
    expect(resultat.data.validations.map((v: any) => v.id)).toEqual([2, 1])
    expect(resultat.data.validations[0].participantId).toBe(300)
  })

  it('affiche un mouvement dont la personne a été supprimée, sans nom', async () => {
    prismaMock.entryValidationLog.findMany.mockResolvedValue([mouvement({})])
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])

    const resultat = await handler(evenement as any)

    // Le journal ne porte que (genre, identifiant) : un compte supprimé ne peut plus être nommé.
    // La ligne reste néanmoins affichée — la masquer ferait disparaître du fil ce que le journal
    // existe précisément pour conserver.
    expect(resultat.data.validations).toHaveLength(1)
    expect(resultat.data.validations[0].firstName).toBeNull()
  })

  it('ne nomme PAS la population en français côté serveur', async () => {
    prismaMock.entryValidationLog.findMany.mockResolvedValue([
      mouvement({ participantKind: 'VOLUNTEER', participantId: 9 }),
    ])
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
      { id: 9, user: { prenom: 'Ada', nom: 'Lovelace', email: 'ada@x.fr' } },
    ])

    const resultat = await handler(evenement as any)

    // L'ancienne version écrivait « Bénévole », « Artiste », « Organisateur » dans la réponse.
    // Seul le client connaît la langue de qui tient le guichet (constat B4).
    expect(resultat.data.validations[0].name).toBeNull()
    expect(resultat.data.validations[0].type).toBe('volunteer')
  })

  it("lit le titre de l'organisateur à travers sa relation, et non sur EditionOrganizer", async () => {
    prismaMock.entryValidationLog.findMany.mockResolvedValue([
      mouvement({ participantKind: 'ORGANIZER', participantId: 3 }),
    ])
    prismaMock.editionOrganizer.findMany.mockResolvedValue([
      {
        id: 3,
        organizer: { title: 'Régie', user: { prenom: 'Ada', nom: 'Lovelace', email: 'a@x.fr' } },
      },
    ])

    const resultat = await handler(evenement as any)

    // `title` vit sur ConventionOrganizer. L'aplatir d'un niveau faisait rejeter TOUTE la requête
    // par Prisma — un 500 que ni le typage ni un test à mock ne voient, et que seul le
    // rapprochement avec le schéma attrape. Ce test verrouille la FORME de la requête.
    const selection = prismaMock.editionOrganizer.findMany.mock.calls[0][0].select
    expect(selection.title).toBeUndefined()
    expect(selection.organizer.select.title).toBe(true)
    expect(resultat.data.validations[0].name).toBe('Régie')
  })

  it("n'interroge que les populations présentes dans le fil", async () => {
    prismaMock.entryValidationLog.findMany.mockResolvedValue([
      mouvement({ participantKind: 'ARTIST', participantId: 5 }),
    ])
    prismaMock.editionArtist.findMany.mockResolvedValue([
      { id: 5, user: { prenom: 'Ada', nom: 'Lovelace', email: 'ada@x.fr' } },
    ])

    await handler(evenement as any)

    // Quatre requêtes systématiques, c'était le défaut de l'ancienne version. Un fil de dix
    // mouvements ne contient presque jamais plus d'une ou deux populations.
    expect(prismaMock.editionArtist.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.ticketingOrderItem.findMany).not.toHaveBeenCalled()
    expect(prismaMock.editionVolunteerApplication.findMany).not.toHaveBeenCalled()
    expect(prismaMock.editionOrganizer.findMany).not.toHaveBeenCalled()
  })
})
