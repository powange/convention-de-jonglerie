import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../../server/api/messenger/conversations/index.get'

const prismaMock = (globalThis as any).prisma

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
