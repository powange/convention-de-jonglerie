import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../../server/api/messenger/conversations/index.get'
import { utilisateursResponsablesDeLEquipe } from '../../../../../../server/utils/editions/volunteers/responsables-equipe'

const prismaMock = (globalThis as any).prisma

/*
 * ⚠️ `utilisateursResponsablesDeLEquipe` EST UN AUTO-IMPORT NITRO dans ce point d'API : il l'emploie
 * sans l'importer, là où il importe explicitement ses six autres utilitaires. À l'exécution Nitro
 * le résout ; sous vitest, l'identifiant nu n'est lié à rien et le handler lève
 * `ReferenceError`, que `wrapApiHandler` transforme en 500. Le point d'API était donc
 * INTESTABLE sur tout ce qui suit la ligne 245 — ce qui explique en partie l'absence de tests.
 *
 * On pose donc la VRAIE fonction sur la globale, et non un mock : ainsi les deux requêtes qui
 * distinguent un responsable bénévole d'un organisateur rattaché sont réellement jouées, au-dessus
 * du mock de Prisma. Un mock aurait rendu ce qu'on lui dit de rendre, et n'aurait rien prouvé des
 * deux titres.
 */
;(globalThis as any).utilisateursResponsablesDeLEquipe = utilisateursResponsablesDeLEquipe

const canManageEditionVolunteers = vi.hoisted(() => vi.fn())
const canManageArtistsById = vi.hoisted(() => vi.fn())
const checkAdminMode = vi.hoisted(() => vi.fn())
const compterNonLusParConversation = vi.hoisted(() => vi.fn())
const ensureOrganizersGroupConversation = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/organizer-management', () => ({
  canManageEditionVolunteers,
  checkAdminMode,
}))
vi.mock('#server/utils/permissions/edition-permissions', () => ({ canManageArtistsById }))
vi.mock('#server/utils/messenger-unread-service', () => ({ compterNonLusParConversation }))
vi.mock('#server/utils/messenger-helpers', () => ({ ensureOrganizersGroupConversation }))

const g = global as any

/**
 * La liste des conversations d'une édition porte, pour chacune, la page vers laquelle mène le
 * bouton de l'en-tête. Ce qui est éprouvé ici : le câblage — les droits du lecteur sur l'édition,
 * l'appel à spectacles d'une candidature — et non la règle, qu'éprouvent les tests unitaires de
 * `destination-conversation`.
 */
describe('/api/messenger/conversations GET — destination', () => {
  const evenement = { context: { user: { id: 9 } } }

  const conversation = (type: string, extra: Record<string, unknown> = {}) => ({
    id: `conv-${type}`,
    type,
    editionId: 7,
    teamId: null,
    team: null,
    show: null,
    showApplication: null,
    participants: [{ id: 'p', userId: 9, lastReadAt: null, lastReadMessageId: null, user: {} }],
    messages: [],
    _count: { messages: 0 },
    ...extra,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    g.requireAuth = vi.fn().mockReturnValue({ id: 9 })
    g.getQuery = vi.fn().mockReturnValue({ editionId: '7' })
    checkAdminMode.mockResolvedValue(false)
    compterNonLusParConversation.mockResolvedValue(new Map())
    prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue({ id: 1 })
    prismaMock.edition.findUnique.mockResolvedValue({
      conventionId: 1,
      convention: { organizers: [] },
    })
    prismaMock.showApplication.findFirst.mockResolvedValue(null)
    prismaMock.editionOrganizer.findFirst.mockResolvedValue(null)
    prismaMock.conversation.findMany.mockResolvedValue([
      conversation('VOLUNTEER_TO_ORGANIZERS'),
      conversation('ARTIST_APPLICATION', {
        editionId: null,
        showApplication: { id: 42, showCallId: 3, showTitle: 'T', artistName: 'A', user: {} },
      }),
    ])
  })

  const destinations = async () => {
    const resultat = await handler(evenement as any)
    return Object.fromEntries(
      resultat.data.map((c: { type: string; destination: { to: string } | null }) => [
        c.type,
        c.destination?.to ?? null,
      ])
    )
  }

  it('mène un bénévole et un artiste à leurs pages publiques', async () => {
    canManageEditionVolunteers.mockResolvedValue(false)
    canManageArtistsById.mockResolvedValue(false)

    expect(await destinations()).toEqual({
      VOLUNTEER_TO_ORGANIZERS: '/editions/7/volunteers',
      // L'édition vient de la requête : la conversation de candidature n'en porte pas.
      ARTIST_APPLICATION: '/editions/7/shows-call/3',
    })
  })

  it('mène celui qui gère en gestion, d’après ses droits sur l’édition', async () => {
    canManageEditionVolunteers.mockResolvedValue(true)
    canManageArtistsById.mockResolvedValue(true)

    expect(await destinations()).toEqual({
      VOLUNTEER_TO_ORGANIZERS: '/editions/7/gestion/volunteers/applications',
      ARTIST_APPLICATION: '/editions/7/gestion/shows-call/3/applications/42',
    })
    expect(canManageEditionVolunteers).toHaveBeenCalledWith(7, 9, evenement)
    expect(canManageArtistsById).toHaveBeenCalledWith(7, 9, evenement)
  })

  it('sélectionne l’appel à spectacles de la candidature', async () => {
    canManageEditionVolunteers.mockResolvedValue(false)
    canManageArtistsById.mockResolvedValue(false)
    await destinations()

    const include = prismaMock.conversation.findMany.mock.calls[0][0].include
    expect(include.showApplication.select.showCallId).toBe(true)
  })
})

/**
 * QUI a accès aux conversations d'une édition — la garde que ce fichier n'éprouvait pas.
 *
 * ⚠️ CE QUE CE 403 PROTÈGE. La liste ne rend que les conversations dont on est participant, mais
 * la garde s'exerce AVANT : sans elle, un visiteur quelconque apprendrait par le simple code de
 * réponse quelles éditions existent, et un organisateur retiré continuerait d'interroger la liste.
 * Ce point d'API crée aussi, au passage, le groupe des organisateurs — un effet de bord qu'un
 * refus manquant ouvrirait à n'importe qui.
 *
 * ⚠️ CINQ CHEMINS MÈNENT À L'ACCÈS, et c'est ce qui rend la garde fragile : candidature de
 * bénévole, organisateur de la CONVENTION, organisateur de l'ÉDITION, candidature d'artiste, mode
 * administrateur. Un `&&` mis pour un `||` n'en fermerait qu'un ou quatre à la fois — et il
 * suffirait d'un seul test pour ne pas s'en apercevoir. D'où un cas par chemin.
 */
describe('/api/messenger/conversations GET — le droit d’accès', () => {
  const evenement = { context: { user: { id: 9 } } }

  /** Les cinq chemins fermés : personne n'a rien à voir avec cette édition. */
  const aucunAcces = () => {
    prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(null)
    prismaMock.edition.findUnique.mockResolvedValue({
      conventionId: 1,
      convention: { organizers: [] },
    })
    prismaMock.showApplication.findFirst.mockResolvedValue(null)
    prismaMock.editionOrganizer.findFirst.mockResolvedValue(null)
    checkAdminMode.mockResolvedValue(false)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    g.requireAuth = vi.fn().mockReturnValue({ id: 9 })
    g.getQuery = vi.fn().mockReturnValue({ editionId: '7' })
    canManageEditionVolunteers.mockResolvedValue(false)
    canManageArtistsById.mockResolvedValue(false)
    compterNonLusParConversation.mockResolvedValue(new Map())
    prismaMock.conversation.findMany.mockResolvedValue([])
    aucunAcces()
  })

  it('REFUSE qui n’a aucun lien avec l’édition', async () => {
    // 🔬 L'assertion centrale : sans elle, les quatre cas suivants ne prouveraient rien.
    await expect(handler(evenement as any)).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.conversation.findMany).not.toHaveBeenCalled()
  })

  it('n’ouvre PAS le groupe des organisateurs à qui est refusé', async () => {
    // L'effet de bord doit rester derrière la garde.
    await expect(handler(evenement as any)).rejects.toMatchObject({ statusCode: 403 })
    expect(ensureOrganizersGroupConversation).not.toHaveBeenCalled()
  })

  it('accepte un candidat bénévole, même NON accepté', async () => {
    /*
     * ⚠️ Volontaire, et à ne pas « corriger » sans y penser : la requête ne filtre pas sur
     * `status`. Un candidat en attente doit pouvoir écrire aux organisateurs — c'est souvent
     * exactement pourquoi il écrit.
     */
    prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue({ id: 1, status: 'PENDING' })

    await expect(handler(evenement as any)).resolves.toBeTruthy()
    const where = prismaMock.editionVolunteerApplication.findFirst.mock.calls[0][0].where
    expect(where).not.toHaveProperty('status')
  })

  it('accepte un organisateur de la CONVENTION', async () => {
    prismaMock.edition.findUnique.mockResolvedValue({
      conventionId: 1,
      convention: { organizers: [{ id: 5 }] },
    })

    await expect(handler(evenement as any)).resolves.toBeTruthy()
  })

  it('accepte un organisateur de l’ÉDITION, et lui ouvre le groupe', async () => {
    prismaMock.editionOrganizer.findFirst.mockResolvedValue({ id: 3 })

    await expect(handler(evenement as any)).resolves.toBeTruthy()
    expect(ensureOrganizersGroupConversation).toHaveBeenCalledWith(7)
  })

  it('accepte un artiste candidat, SANS lui ouvrir le groupe des organisateurs', async () => {
    prismaMock.showApplication.findFirst.mockResolvedValue({ id: 42 })

    await expect(handler(evenement as any)).resolves.toBeTruthy()
    expect(ensureOrganizersGroupConversation).not.toHaveBeenCalled()
  })

  it('accepte le mode administrateur', async () => {
    checkAdminMode.mockResolvedValue(true)

    await expect(handler(evenement as any)).resolves.toBeTruthy()
  })

  it('ne rend que les conversations où l’on est ENCORE participant', async () => {
    /*
     * ⚠️ `leftAt: null` : qui a quitté une conversation n'en reçoit plus rien. Un bénévole retiré
     * de son équipe n'est pas effacé mais marqué parti, pour que l'historique reste lisible aux
     * organisateurs — sans ce filtre, il continuerait de lire le fil de l'équipe qu'il a quittée.
     *
     * On mesure la FORME de la requête, que le mock de Prisma ignore.
     */
    prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue({ id: 1 })

    await handler(evenement as any)

    const where = prismaMock.conversation.findMany.mock.calls[0][0].where
    expect(where.participants.some).toEqual({ userId: 9, leftAt: null })
  })
})

/**
 * Le badge « responsable » posé sur les participants d'une conversation d'équipe.
 */
describe('/api/messenger/conversations GET — le badge de responsable', () => {
  const evenement = { context: { user: { id: 9 } } }

  const conversationEquipe = (participants: number[]) => ({
    id: 'conv-equipe',
    type: 'TEAM_GROUP',
    editionId: 7,
    teamId: 'team-1',
    team: { id: 'team-1', name: 'Accueil', color: '#fff' },
    show: null,
    showApplication: null,
    participants: participants.map((userId) => ({
      id: `p-${userId}`,
      userId,
      lastReadAt: null,
      lastReadMessageId: null,
      user: {},
    })),
    messages: [],
    _count: { messages: 0 },
  })

  beforeEach(() => {
    vi.clearAllMocks()
    g.requireAuth = vi.fn().mockReturnValue({ id: 9 })
    g.getQuery = vi.fn().mockReturnValue({ editionId: '7' })
    checkAdminMode.mockResolvedValue(false)
    canManageEditionVolunteers.mockResolvedValue(false)
    canManageArtistsById.mockResolvedValue(false)
    compterNonLusParConversation.mockResolvedValue(new Map())
    prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue({ id: 1 })
    prismaMock.edition.findUnique.mockResolvedValue({
      conventionId: 1,
      convention: { organizers: [] },
    })
    prismaMock.showApplication.findFirst.mockResolvedValue(null)
    prismaMock.editionOrganizer.findFirst.mockResolvedValue(null)
    prismaMock.conversation.findMany.mockResolvedValue([conversationEquipe([9, 11, 12])])
    // Les responsables d'une équipe : bénévoles acceptés d'un côté, organisateurs rattachés de
    // l'autre — le badge doit paraître sur l'un comme sur l'autre.
    prismaMock.applicationTeamAssignment.findMany.mockResolvedValue([
      { application: { userId: 11 } },
    ])
    prismaMock.organizerTeamAssignment.findMany.mockResolvedValue([
      { editionOrganizer: { organizer: { userId: 12 } } },
    ])
  })

  it('marque les responsables, bénévoles COMME organisateurs rattachés', async () => {
    /*
     * 🔬 Le cas qui distingue les deux titres. Un test avec un seul responsable bénévole passerait
     * alors qu'un organisateur responsable n'aurait aucun badge — et c'est lui qu'on chercherait
     * dans la liste pour lui écrire.
     */
    const resultat: any = await handler(evenement as any)

    const badges = Object.fromEntries(
      resultat.data[0].participants.map((p: any) => [p.userId, p.isLeader])
    )
    expect(badges).toEqual({ 9: false, 11: true, 12: true })
  })

  it('ne pose AUCUN badge pour qui n’est pas participant', async () => {
    /*
     * 📍 Comportement EXISTANT, figé ici plutôt que corrigé : un organisateur qui lit une
     * conversation d'équipe sans y être inscrit n'obtient ni compteur ni badges. L'asymétrie est
     * douteuse — elle est notée dans le rapport —, mais la changer modifierait un écran, et ce lot
     * n'ajoute que des tests.
     */
    prismaMock.conversation.findMany.mockResolvedValue([conversationEquipe([11, 12])])

    const resultat: any = await handler(evenement as any)

    expect(resultat.data[0].participants.every((p: any) => p.isLeader === undefined)).toBe(true)
    expect(resultat.data[0].unreadCount).toBe(0)
  })

  it('ne cherche les responsables qu’UNE FOIS par équipe', async () => {
    // Deux conversations de la même équipe (groupe et fil privé) ne doivent pas coûter deux
    // interrogations des responsables.
    prismaMock.conversation.findMany.mockResolvedValue([
      conversationEquipe([9, 11, 12]),
      { ...conversationEquipe([9, 11]), id: 'conv-privee', type: 'TEAM_LEADER_PRIVATE' },
    ])

    await handler(evenement as any)

    expect(prismaMock.applicationTeamAssignment.findMany).toHaveBeenCalledTimes(1)
  })
})
