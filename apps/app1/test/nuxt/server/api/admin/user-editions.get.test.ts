import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockRequireAdmin = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/admin-auth', () => ({
  requireGlobalAdminWithDbCheck: mockRequireAdmin,
}))

import handler from '../../../../../server/api/admin/users/[id]/editions.get'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '417' } } }

const appeler = async () => (await handler(evenement as any)) as any[]

/** Une édition telle que la requête la sélectionne, sans aucun rôle pour cette personne. */
const edition = (id: number, surcharges: Record<string, unknown> = {}) => ({
  id,
  name: `Édition ${id}`,
  startDate: new Date('2026-10-02'),
  endDate: new Date('2026-10-05'),
  city: 'Lyon',
  country: 'France',
  imageUrl: null,
  creatorId: null,
  convention: { id: 7, name: 'Convention de Lyon' },
  attendingUsers: [],
  artists: [],
  editionOrganizers: [],
  event: { volunteerApplications: [] },
  showCalls: [],
  ...surcharges,
})

/**
 * Les éditions rattachées à un profil, et à quel titre.
 *
 * La fiche d'administration n'affichait que des compteurs groupés par nature de lien — « 2
 * candidatures bénévoles » sans dire lesquelles. Ce point d'API répond à l'autre question : sur
 * quelles éditions, et à quel titre.
 */
describe('GET /api/admin/users/[id]/editions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 1, isGlobalAdmin: true })
    prismaMock.edition.findMany.mockResolvedValue([])
  })

  it('cherche les éditions par les six rattachements possibles', async () => {
    await appeler()

    const [arguments_] = prismaMock.edition.findMany.mock.calls[0]
    expect(arguments_.where.OR).toEqual([
      { creatorId: 417 },
      { attendingUsers: { some: { id: 417 } } },
      { artists: { some: { userId: 417 } } },
      { editionOrganizers: { some: { organizer: { userId: 417 } } } },
      { event: { volunteerApplications: { some: { userId: 417 } } } },
      { showCalls: { some: { applications: { some: { userId: 417 } } } } },
    ])
  })

  it('filtre chaque sous-sélection sur la personne demandée', async () => {
    // Sans ce filtre, on remonterait les artistes de l'édition au lieu du fait que celle-ci y est
    // artiste — et toute édition aurait tous les rôles.
    await appeler()

    const [arguments_] = prismaMock.edition.findMany.mock.calls[0]
    expect(arguments_.select.artists.where).toEqual({ userId: 417 })
    expect(arguments_.select.attendingUsers.where).toEqual({ id: 417 })
    expect(arguments_.select.editionOrganizers.where).toEqual({ organizer: { userId: 417 } })
    expect(arguments_.select.event.select.volunteerApplications.where).toEqual({ userId: 417 })
  })

  it('rend les rôles tenus sur une édition', async () => {
    prismaMock.edition.findMany.mockResolvedValue([
      edition(22, {
        creatorId: 417,
        attendingUsers: [{ id: 417 }],
        artists: [{ id: 3 }],
        editionOrganizers: [{ id: 9 }],
      }),
    ])

    const [resultat] = await appeler()

    expect(resultat.roles).toEqual([
      { type: 'creator' },
      { type: 'organizer' },
      { type: 'attendee' },
      { type: 'artist' },
    ])
  })

  it('distingue le statut d’une candidature bénévole', async () => {
    // Une candidature refusée n'est pas une participation : les confondre ferait passer ce profil
    // pour un bénévole de l'édition.
    prismaMock.edition.findMany.mockResolvedValue([
      edition(22, {
        event: {
          volunteerApplications: [{ id: 1, status: 'REJECTED', createdAt: new Date() }],
        },
      }),
    ])

    const [resultat] = await appeler()

    expect(resultat.roles).toEqual([{ type: 'volunteer', statut: 'REJECTED' }])
  })

  it('remonte les candidatures spectacle à travers les appels', async () => {
    prismaMock.edition.findMany.mockResolvedValue([
      edition(22, {
        showCalls: [
          { applications: [{ id: 1, status: 'ACCEPTED' }] },
          { applications: [{ id: 2, status: 'PENDING' }] },
        ],
      }),
    ])

    const [resultat] = await appeler()

    expect(resultat.roles).toEqual([
      { type: 'show', statut: 'ACCEPTED' },
      { type: 'show', statut: 'PENDING' },
    ])
  })

  it('n’expose pas les sous-sélections, qui ne sont qu’un moyen', async () => {
    prismaMock.edition.findMany.mockResolvedValue([edition(22, { artists: [{ id: 3 }] })])

    const [resultat] = await appeler()

    expect(resultat).toMatchObject({
      id: 22,
      city: 'Lyon',
      convention: { name: 'Convention de Lyon' },
    })
    expect(resultat.artists).toBeUndefined()
    expect(resultat.attendingUsers).toBeUndefined()
    expect(resultat.event).toBeUndefined()
    expect(resultat.creatorId).toBeUndefined()
  })

  it('trie les éditions les plus récentes en premier', async () => {
    await appeler()

    const [arguments_] = prismaMock.edition.findMany.mock.calls[0]
    expect(arguments_.orderBy).toEqual({ startDate: 'desc' })
  })

  it('exige les droits administrateur', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Accès refusé'))

    await expect(appeler()).rejects.toThrow()
    expect(prismaMock.edition.findMany).not.toHaveBeenCalled()
  })
})
