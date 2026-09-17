import { describe, it, expect, vi, beforeEach } from 'vitest'

// wrapApiHandler et validateEditionId sont auto-importés (Nitro) dans le handler : on fournit des
// équivalents globaux avant le chargement du handler (vi.hoisted s'exécute avant les imports).
vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
  if (!(globalThis as any).validateEditionId) {
    ;(globalThis as any).validateEditionId = (event: any) =>
      parseInt(event?.context?.params?.id, 10)
  }
})

// Mock du contrôle d'accès. Le nom compte : la vérification d'un QR code s'appuie sur le helper
// qui admet AUSSI les bénévoles en créneau actif de contrôle d'accès.
const mockCanAccessEditionData = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canAccessEditionDataOrAccessControl: mockCanAccessEditionData,
}))

// Mock de requireAuth pour simuler un utilisateur authentifié
vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import verifyHandler from '../../../../../../server/api/editions/[id]/ticketing/verify.post'
import { global } from '../../../../globales-nitro'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

/** Le drapeau « articles à remettre » de l'édition, lu par le point d'API avant tout calcul. */
const articlesARemettre = (actifs: boolean) =>
  prismaMock.edition.findUnique.mockResolvedValue({ ticketingHandoutItemsEnabled: actifs })

describe('POST /api/editions/[id]/ticketing/verify (bénévole)', () => {
  const mockUser = { id: 1, email: 'user@example.com', pseudo: 'testuser' }

  const mockEvent = {
    context: {
      params: { id: '1' },
      user: mockUser,
    },
  }

  const mockApplication = {
    id: 5,
    userId: 42,
    entryValidated: false,
    entryValidatedAt: null,
    entryValidatedBy: null,
    userSnapshotPhone: null,
    user: { prenom: 'Marie', nom: 'Dupont', email: 'marie@example.com', phone: null },
    teamAssignments: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn().mockResolvedValue({ qrCode: 'volunteer-5-tok123' })
    mockCanAccessEditionData.mockResolvedValue(true)
    articlesARemettre(true)

    // Requêtes secondaires de la branche bénévole : vides par défaut
    prismaMock.volunteerAssignment.findMany.mockResolvedValue([])
    prismaMock.editionVolunteerHandoutItem.findMany.mockResolvedValue([])
    prismaMock.volunteerMealSelection.findMany.mockResolvedValue([])
  })

  it("devrait rejeter avec 403 si l'utilisateur n'a pas accès à l'édition", async () => {
    mockCanAccessEditionData.mockResolvedValue(false)

    await expect(verifyHandler(mockEvent as any)).rejects.toThrow(/Droits insuffisants/)
    expect(prismaMock.editionVolunteerApplication.findFirst).not.toHaveBeenCalled()
  })

  it('devrait retourner found:false pour un QR code bénévole invalide', async () => {
    global.readBody = vi.fn().mockResolvedValue({ qrCode: 'volunteer-abc' })

    const result = await verifyHandler(mockEvent as any)

    expect(result.data.found).toBe(false)
    expect(prismaMock.editionVolunteerApplication.findFirst).not.toHaveBeenCalled()
  })

  it('devrait trouver un bénévole accepté via son QR code', async () => {
    prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(mockApplication)

    const result = await verifyHandler(mockEvent as any)

    expect(result.data.found).toBe(true)
    expect(result.data.type).toBe('volunteer')
    expect(result.data.participant.volunteer.id).toBe(5)
    expect(result.data.participant.volunteer.user.firstName).toBe('Marie')
  })

  // Garde-fou de régression : depuis l'abstraction Event (étape 0), les candidatures bénévoles
  // sont rattachées à Event. La vérification DOIT filtrer sur `eventId`, jamais `editionId`.
  it('devrait filtrer la candidature sur eventId (et non editionId)', async () => {
    prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(mockApplication)

    await verifyHandler(mockEvent as any)

    expect(prismaMock.editionVolunteerApplication.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 5,
          eventId: 1,
          status: 'ACCEPTED',
        }),
      })
    )

    const whereArg = prismaMock.editionVolunteerApplication.findFirst.mock.calls[0][0].where
    expect(whereArg).not.toHaveProperty('editionId')
  })
})

describe('POST /api/editions/[id]/ticketing/verify (artiste)', () => {
  const mockEvent = {
    context: { params: { id: '1' }, user: { id: 1, pseudo: 'orga' } },
  }

  const artiste = {
    id: 9,
    userId: 42,
    entryValidated: false,
    entryValidatedAt: null,
    entryValidatedBy: null,
    user: { id: 42, prenom: 'Léa', nom: 'Martin', email: 'lea@example.com', phone: null },
    shows: [
      {
        show: {
          id: 3,
          title: 'Cabaret',
          performances: [],
          handoutItems: [
            { quantity: 1, handoutItem: { id: 20, name: 'Repas spectacle', cumulative: true } },
          ],
        },
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn().mockResolvedValue({ qrCode: 'artist-9-tok9' })
    mockCanAccessEditionData.mockResolvedValue(true)
    articlesARemettre(true)
    prismaMock.editionArtist.findFirst.mockResolvedValue(artiste)
    prismaMock.artistMealSelection.findMany.mockResolvedValue([])
    // Articles remis à TOUS les artistes de l'édition
    prismaMock.editionArtistHandoutItem.findMany.mockResolvedValue([
      { quantity: 1, handoutItem: { id: 10, name: 'Bracelet', cumulative: false } },
    ])
    // Articles demandés pour CET artiste en particulier
    prismaMock.artistHandoutItem.findMany.mockResolvedValue([
      { quantity: 2, handoutItem: { id: 30, name: 'Ticket boisson', cumulative: true } },
    ])
  })

  it('remet les articles des trois sources : tous les artistes, cet artiste, ses spectacles', async () => {
    const result = await verifyHandler(mockEvent as any)

    expect(result.data.found).toBe(true)
    expect(result.data.type).toBe('artist')
    const noms = result.data.participant.artist.handoutItems.map((i: any) => i.name).sort()
    expect(noms).toEqual(['Bracelet', 'Repas spectacle', 'Ticket boisson'])
  })

  it("remet le nombre d'exemplaires demandé pour cet artiste", async () => {
    const result = await verifyHandler(mockEvent as any)

    const ticket = result.data.participant.artist.handoutItems.find((i: any) => i.id === 30)
    expect(ticket.quantity).toBe(2)
  })

  it("n'interroge les articles de cet artiste que pour lui", async () => {
    await verifyHandler(mockEvent as any)

    expect(prismaMock.artistHandoutItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { artistId: 9 } })
    )
  })
})

/**
 * La branche organisateur.
 *
 * Elle était la seule à ne pas passer par l'agrégation commune : ses articles étaient rendus en
 * deux listes juxtaposées, `handoutItems` et `globalHandoutItems`, sans dédoublonnage ni
 * application du drapeau `cumulative`. Elle n'avait par ailleurs aucun test.
 */
describe('POST /api/editions/[id]/ticketing/verify (organisateur)', () => {
  const mockUser = { id: 1, email: 'user@example.com', pseudo: 'testuser' }
  const mockEvent = { context: { params: { id: '1' }, user: mockUser } }

  const organisateur = {
    id: 7,
    entryValidated: false,
    entryValidatedAt: null,
    entryValidatedBy: null,
    organizer: {
      title: 'Responsable accueil',
      user: { prenom: 'Claire', nom: 'Bernard', email: 'claire@example.com', phone: null },
    },
  }

  /**
   * Monte les deux lectures que fait le point d'API.
   *
   * Deux et non une : le modèle d'association ne porte pas de relation vers l'article, les
   * identifiants sont donc relus à part.
   */
  const articlesAssocies = (
    associations: Array<{ organizerId: number | null; handoutItemId: number; quantity: number }>,
    articles: Array<{ id: number; name: string; cumulative: boolean }>
  ) => {
    prismaMock.editionOrganizerHandoutItem.findMany.mockResolvedValue(associations)
    prismaMock.ticketingHandoutItem.findMany.mockResolvedValue(articles)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn().mockResolvedValue({ qrCode: 'organizer-7-tok7' })
    mockCanAccessEditionData.mockResolvedValue(true)
    articlesARemettre(true)
    prismaMock.editionOrganizer.findFirst.mockResolvedValue(organisateur)
    prismaMock.organizerMealSelection.findMany.mockResolvedValue([])
  })

  it('réunit les articles de TOUS les organisateurs et ceux de celui-ci', async () => {
    articlesAssocies(
      [
        { organizerId: null, handoutItemId: 10, quantity: 1 },
        { organizerId: 7, handoutItemId: 30, quantity: 2 },
      ],
      [
        { id: 10, name: 'Bracelet', cumulative: false },
        { id: 30, name: 'Talkie', cumulative: false },
      ]
    )

    const result = await verifyHandler(mockEvent as any)

    expect(result.data.type).toBe('organizer')
    const noms = result.data.participant.organizer.handoutItems.map((i: any) => i.name).sort()
    expect(noms).toEqual(['Bracelet', 'Talkie'])
  })

  it('demande les DEUX portées en une seule requête, sans `in` sur un NULL', async () => {
    // C'est la requête qu'il faut vérifier, pas la réponse du mock : un `in: [id, null]`
    // produirait `IN (…, NULL)`, et en SQL une comparaison avec NULL n'est jamais vraie — les
    // articles globaux disparaîtraient sans la moindre erreur.
    articlesAssocies([], [])

    await verifyHandler(mockEvent as any)

    expect(prismaMock.editionOrganizerHandoutItem.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.editionOrganizerHandoutItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ organizerId: 7 }, { organizerId: null }],
        }),
      })
    )
  })

  it("ne remet QU'UNE FOIS un article non cumulable donné globalement ET nommément", async () => {
    articlesAssocies(
      [
        { organizerId: null, handoutItemId: 10, quantity: 1 },
        { organizerId: 7, handoutItemId: 10, quantity: 1 },
      ],
      [{ id: 10, name: 'Bracelet', cumulative: false }]
    )

    const result = await verifyHandler(mockEvent as any)

    expect(result.data.participant.organizer.handoutItems).toHaveLength(1)
    expect(result.data.participant.organizer.handoutItems[0].quantity).toBe(1)
  })

  it('ADDITIONNE un article cumulable donné par les deux portées', async () => {
    articlesAssocies(
      [
        { organizerId: null, handoutItemId: 20, quantity: 2 },
        { organizerId: 7, handoutItemId: 20, quantity: 3 },
      ],
      [{ id: 20, name: 'Ticket', cumulative: true }]
    )

    const result = await verifyHandler(mockEvent as any)

    expect(result.data.participant.organizer.handoutItems[0].quantity).toBe(5)
  })

  it('ne rend plus de liste globale séparée', async () => {
    // Deux listes juxtaposées laissaient à l'écran le soin de les réunir — ce qu'il ne faisait
    // pas, et ce qui aurait fait apparaître deux fois un même article.
    articlesAssocies([], [])

    const result = await verifyHandler(mockEvent as any)

    expect(result.data.participant.organizer.globalHandoutItems).toBeUndefined()
  })
})

/**
 * Les repas d'un organisateur.
 *
 * Un ticket de cantine est un article comme un autre. Les bénévoles et les artistes le
 * recevaient ; les organisateurs non, alors qu'ils s'inscrivent aux mêmes repas — pour la seule
 * raison que cette branche ne lisait aucune sélection de repas.
 */
describe('POST /api/editions/[id]/ticketing/verify (repas des organisateurs)', () => {
  const mockUser = { id: 1, email: 'user@example.com', pseudo: 'testuser' }
  const mockEvent = { context: { params: { id: '1' }, user: mockUser } }

  const repas = (handoutItems: Array<{ quantity: number; handoutItem: any }>) => ({
    meal: {
      id: 4,
      date: new Date('2026-09-19'),
      mealType: 'DINNER',
      phases: ['EVENT'],
      handoutItems,
    },
  })

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn().mockResolvedValue({ qrCode: 'organizer-7-tok7' })
    mockCanAccessEditionData.mockResolvedValue(true)
    articlesARemettre(true)
    prismaMock.editionOrganizer.findFirst.mockResolvedValue({
      id: 7,
      entryValidated: false,
      entryValidatedAt: null,
      entryValidatedBy: null,
      organizer: {
        title: null,
        user: { prenom: 'Claire', nom: 'Bernard', email: 'claire@example.com', phone: null },
      },
    })
    prismaMock.editionOrganizerHandoutItem.findMany.mockResolvedValue([])
    prismaMock.ticketingHandoutItem.findMany.mockResolvedValue([])
  })

  it('remet les articles attachés à un repas auquel il est inscrit', async () => {
    prismaMock.organizerMealSelection.findMany.mockResolvedValue([
      repas([{ quantity: 1, handoutItem: { id: 40, name: 'Ticket cantine', cumulative: false } }]),
    ])

    const result = await verifyHandler(mockEvent as any)

    const noms = result.data.participant.organizer.handoutItems.map((i: any) => i.name)
    expect(noms).toEqual(['Ticket cantine'])
  })

  it('ne lit QUE les sélections acceptées, sur les repas actifs, de CET organisateur', async () => {
    // Assertion sur la requête : le mock rendrait de toute façon ce qu'on lui dit de rendre.
    prismaMock.organizerMealSelection.findMany.mockResolvedValue([])

    await verifyHandler(mockEvent as any)

    expect(prismaMock.organizerMealSelection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          editionOrganizerId: 7,
          accepted: true,
          meal: { enabled: true },
        }),
      })
    )
  })

  it('réunit les articles des repas avec ceux des associations', async () => {
    prismaMock.editionOrganizerHandoutItem.findMany.mockResolvedValue([
      { organizerId: null, handoutItemId: 10, quantity: 1 },
    ])
    prismaMock.ticketingHandoutItem.findMany.mockResolvedValue([
      { id: 10, name: 'Bracelet', cumulative: false },
    ])
    prismaMock.organizerMealSelection.findMany.mockResolvedValue([
      repas([{ quantity: 2, handoutItem: { id: 40, name: 'Ticket cantine', cumulative: true } }]),
    ])

    const result = await verifyHandler(mockEvent as any)

    const noms = result.data.participant.organizer.handoutItems.map((i: any) => i.name).sort()
    expect(noms).toEqual(['Bracelet', 'Ticket cantine'])
  })

  it('rend aussi la liste des repas, comme pour les bénévoles et les artistes', async () => {
    prismaMock.organizerMealSelection.findMany.mockResolvedValue([repas([])])

    const result = await verifyHandler(mockEvent as any)

    expect(result.data.participant.organizer.meals).toHaveLength(1)
    expect(result.data.participant.organizer.meals[0].mealType).toBe('DINNER')
  })
})

/**
 * L'interrupteur de l'édition, au guichet.
 *
 * Il ne rangeait que l'entrée de menu : éteint, le contrôle d'accès continuait de réclamer des
 * articles. C'est un écart assumé avec les autres modules, qui ne coupent que leur menu — un
 * article non remis, lui, se constate au comptoir, trop tard.
 */
describe('POST /api/editions/[id]/ticketing/verify (articles désactivés)', () => {
  const mockUser = { id: 1, email: 'user@example.com', pseudo: 'testuser' }
  const mockEvent = { context: { params: { id: '1' }, user: mockUser } }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAccessEditionData.mockResolvedValue(true)
    articlesARemettre(false)
  })

  it('ne remet RIEN à un bénévole, même si des articles sont paramétrés', async () => {
    global.readBody = vi.fn().mockResolvedValue({ qrCode: 'volunteer-5-tok5' })
    prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue({
      id: 5,
      userId: 42,
      entryValidated: false,
      entryValidatedAt: null,
      entryValidatedBy: null,
      userSnapshotPhone: null,
      user: { prenom: 'Marie', nom: 'Dupont', email: 'marie@example.com', phone: null },
      teamAssignments: [],
    })
    prismaMock.volunteerAssignment.findMany.mockResolvedValue([])
    prismaMock.editionVolunteerHandoutItem.findMany.mockResolvedValue([
      { quantity: 1, handoutItem: { id: 10, name: 'Bracelet', cumulative: false } },
    ])
    prismaMock.volunteerMealSelection.findMany.mockResolvedValue([])

    const result = await verifyHandler(mockEvent as any)

    expect(result.data.participant.volunteer.handoutItems).toEqual([])
  })

  it('ne remet RIEN à un organisateur', async () => {
    global.readBody = vi.fn().mockResolvedValue({ qrCode: 'organizer-7-tok7' })
    prismaMock.editionOrganizer.findFirst.mockResolvedValue({
      id: 7,
      entryValidated: false,
      entryValidatedAt: null,
      entryValidatedBy: null,
      organizer: {
        title: null,
        user: { prenom: 'Claire', nom: 'Bernard', email: 'claire@example.com', phone: null },
      },
    })
    prismaMock.editionOrganizerHandoutItem.findMany.mockResolvedValue([
      { organizerId: null, handoutItemId: 10, quantity: 1 },
    ])
    prismaMock.ticketingHandoutItem.findMany.mockResolvedValue([
      { id: 10, name: 'Bracelet', cumulative: false },
    ])
    prismaMock.organizerMealSelection.findMany.mockResolvedValue([])

    const result = await verifyHandler(mockEvent as any)

    expect(result.data.participant.organizer.handoutItems).toEqual([])
  })

  it('laisse tout le reste intact : la personne est toujours trouvée', async () => {
    // Couper la remise ne doit pas couper le contrôle d'accès lui-même.
    global.readBody = vi.fn().mockResolvedValue({ qrCode: 'organizer-7-tok7' })
    prismaMock.editionOrganizer.findFirst.mockResolvedValue({
      id: 7,
      entryValidated: false,
      entryValidatedAt: null,
      entryValidatedBy: null,
      organizer: {
        title: 'Responsable accueil',
        user: { prenom: 'Claire', nom: 'Bernard', email: 'claire@example.com', phone: null },
      },
    })
    prismaMock.editionOrganizerHandoutItem.findMany.mockResolvedValue([])
    prismaMock.ticketingHandoutItem.findMany.mockResolvedValue([])
    prismaMock.organizerMealSelection.findMany.mockResolvedValue([])

    const result = await verifyHandler(mockEvent as any)

    expect(result.data.found).toBe(true)
    expect(result.data.participant.organizer.user.firstName).toBe('Claire')
  })
})

/**
 * Le jeton n'est plus une option.
 *
 * Le scan acceptait `genre-{id}` — un identifiant séquentiel, sans rien à deviner. Les trois
 * branches partagent désormais `designerLaPersonne`, et la base ne porte plus aucune ligne sans
 * jeton : le repli ne protégeait plus personne.
 */
describe('POST /api/editions/[id]/ticketing/verify (le jeton du QR code)', () => {
  const mockEvent = {
    context: { params: { id: '1' }, user: { id: 1, pseudo: 'orga' } },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAccessEditionData.mockResolvedValue(true)
    articlesARemettre(true)
  })

  it.each([
    ['volunteer-42', 'editionVolunteerApplication'],
    ['artist-9', 'editionArtist'],
    ['organizer-7', 'editionOrganizer'],
  ])('refuse « %s » sans même interroger la base', async (qrCode, table) => {
    global.readBody = vi.fn().mockResolvedValue({ qrCode })

    const result = await verifyHandler(mockEvent as any)

    expect(result.data.found).toBe(false)
    expect(prismaMock[table].findFirst).not.toHaveBeenCalled()
  })

  it('dit quoi faire au guichet plutôt que « introuvable »', async () => {
    global.readBody = vi.fn().mockResolvedValue({ qrCode: 'volunteer-42' })

    const result = await verifyHandler(mockEvent as any)

    expect(result.message).toContain('rouvrir')
  })

  it('exige le jeton dans le where quand le QR code en porte un', async () => {
    global.readBody = vi.fn().mockResolvedValue({ qrCode: 'artist-9-jetonSecret' })
    prismaMock.editionArtist.findFirst.mockResolvedValue(null)

    await verifyHandler(mockEvent as any)

    expect(prismaMock.editionArtist.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 9, qrCodeToken: 'jetonSecret' }),
      })
    )
  })
})

/**
 * La relecture demandée par l'écran de gestion.
 *
 * Elle rouvre une fiche déjà affichée après une validation. L'identifiant vient de la réponse
 * précédente du serveur, et la personne aux commandes a déjà prouvé son droit — le même qui lui
 * permet de trouver n'importe qui par son nom. C'est ce chemin qui fabriquait auparavant un faux
 * QR code sans jeton, et qui obligeait donc le scan à accepter cette forme.
 */
describe('POST /api/editions/[id]/ticketing/verify (relecture par identifiant)', () => {
  const mockEvent = {
    context: { params: { id: '1' }, user: { id: 1, pseudo: 'orga' } },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAccessEditionData.mockResolvedValue(true)
    articlesARemettre(true)
  })

  it('trouve la personne sans jeton, et sans condition sur le jeton', async () => {
    global.readBody = vi.fn().mockResolvedValue({ type: 'organizer', id: 7 })
    prismaMock.editionOrganizer.findFirst.mockResolvedValue(null)

    await verifyHandler(mockEvent as any)

    const where = prismaMock.editionOrganizer.findFirst.mock.calls[0][0].where
    expect(where).toMatchObject({ id: 7, editionId: 1 })
    expect(where).not.toHaveProperty('qrCodeToken')
  })

  it('reste soumise au même droit que le scan', async () => {
    mockCanAccessEditionData.mockResolvedValue(false)
    global.readBody = vi.fn().mockResolvedValue({ type: 'volunteer', id: 5 })

    await expect(verifyHandler(mockEvent as any)).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.editionVolunteerApplication.findFirst).not.toHaveBeenCalled()
  })
})

/**
 * Un billet ne dépend que de son édition.
 *
 * Cette branche exigeait une configuration HelloAsso avant même de chercher, et rendait donc une
 * erreur pour toute édition qui n'en a pas — alors que la vente au guichet produit ses propres
 * QR codes `onsite-…` sans aucun fournisseur externe.
 */
describe('POST /api/editions/[id]/ticketing/verify (billet sans billetterie externe)', () => {
  const mockEvent = {
    context: { params: { id: '1' }, user: { id: 1, pseudo: 'orga' } },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAccessEditionData.mockResolvedValue(true)
    articlesARemettre(true)
  })

  it('trouve un billet vendu sur place, sans configuration HelloAsso', async () => {
    global.readBody = vi.fn().mockResolvedValue({ qrCode: 'onsite-0168d7ddee737c74' })
    prismaMock.externalTicketing.findUnique.mockResolvedValue(null)
    prismaMock.ticketingOrderItem.findFirst.mockResolvedValue({
      id: 303,
      helloAssoItemId: null,
      name: 'Samedi journée',
      amount: 2500,
      state: 'Processed',
      qrCode: 'onsite-0168d7ddee737c74',
      firstName: 'Charlotte',
      lastName: 'September',
      email: 'c@example.com',
      customFields: null,
      entryValidated: false,
      entryValidatedAt: null,
      entryValidatedBy: null,
      tier: null,
      selectedOptions: [],
      order: {
        helloAssoOrderId: null,
        status: 'Onsite',
        externalTicketing: null,
        payerFirstName: 'Charlotte',
        payerLastName: 'September',
        payerEmail: 'c@example.com',
        items: [],
      },
    })

    const result = await verifyHandler(mockEvent as any)

    expect(result.data.found).toBe(true)
    expect(result.data.type).toBe('ticket')
    // La provenance est nulle pour une saisie au guichet, et la réponse sait déjà le dire.
    expect(result.data.participant.ticket.order.provider).toBeNull()
  })

  it('ne consulte plus la configuration externe pour trouver le billet', async () => {
    global.readBody = vi.fn().mockResolvedValue({ qrCode: 'onsite-abc' })
    prismaMock.ticketingOrderItem.findFirst.mockResolvedValue(null)

    await verifyHandler(mockEvent as any)

    expect(prismaMock.externalTicketing.findUnique).not.toHaveBeenCalled()
  })
})
