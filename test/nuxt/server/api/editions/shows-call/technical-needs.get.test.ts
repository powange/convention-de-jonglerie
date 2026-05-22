import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../server/api/editions/[id]/shows-call/technical-needs.get'

const prismaMock = (globalThis as any).prisma

describe('/api/editions/[id]/shows-call/technical-needs GET', () => {
  const mockUser = {
    id: 1,
    email: 'organizer@example.com',
    pseudo: 'organizer',
    isGlobalAdmin: false,
  }

  const mockEdition = {
    id: 1,
    name: 'Convention Test 2026',
    status: 'PUBLISHED',
    creatorId: 1,
    convention: {
      name: 'Convention Test',
      authorId: 1,
      organizers: [],
    },
    organizers: [{ userId: 1, canManageArtists: true }],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn().mockReturnValue('1')
    prismaMock.edition.findUnique.mockResolvedValue(mockEdition)
    prismaMock.showApplication.findMany.mockResolvedValue([])
  })

  it('rejette les utilisateurs non connectés', async () => {
    const mockEvent = { context: { user: null } }
    await expect(handler(mockEvent as any)).rejects.toThrow('Unauthorized')
  })

  it('rejette si édition introuvable', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(null)
    const mockEvent = { context: { user: mockUser } }
    await expect(handler(mockEvent as any)).rejects.toThrow(/non trouvée/i)
  })

  it('rejette les utilisateurs sans canManageArtists', async () => {
    prismaMock.edition.findUnique.mockResolvedValue({
      ...mockEdition,
      creatorId: 999,
      convention: { authorId: 999, organizers: [], name: '' },
      organizers: [{ userId: 1, canManageArtists: false }],
    })
    const mockEvent = { context: { user: mockUser } }
    await expect(handler(mockEvent as any)).rejects.toThrow(/droits/i)
  })

  it('filtre les candidatures sur status ACCEPTED + showCall.editionId', async () => {
    const mockEvent = { context: { user: mockUser } }
    await handler(mockEvent as any)
    expect(prismaMock.showApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'ACCEPTED', showCall: { editionId: 1 } },
      })
    )
  })

  it('regroupe les candidatures par showId et trie les groupes par titre', async () => {
    prismaMock.showApplication.findMany.mockResolvedValue([
      {
        id: 11,
        artistName: 'Alice',
        showTitle: 'Show A',
        technicalNeeds: 'Lumière douce',
        showId: 100,
        show: { id: 100, title: 'Z-Final', editionId: 1 },
      },
      {
        id: 12,
        artistName: 'Bob',
        showTitle: 'Show B',
        technicalNeeds: 'Son fort',
        showId: 200,
        show: { id: 200, title: 'A-Opener', editionId: 1 },
      },
      {
        id: 13,
        artistName: 'Carla',
        showTitle: 'Show A bis',
        technicalNeeds: null,
        showId: 100,
        show: { id: 100, title: 'Z-Final', editionId: 1 },
      },
    ])
    const mockEvent = { context: { user: mockUser } }
    const result = await handler(mockEvent as any)
    // Tri alpha sur le titre du show : 'A-Opener' avant 'Z-Final'
    expect(result.data.groups).toHaveLength(2)
    expect(result.data.groups[0].show.title).toBe('A-Opener')
    expect(result.data.groups[1].show.title).toBe('Z-Final')
    // Z-Final regroupe Alice + Carla
    expect(result.data.groups[1].applications).toHaveLength(2)
  })

  it('place le groupe sans show lié en dernier', async () => {
    prismaMock.showApplication.findMany.mockResolvedValue([
      {
        id: 11,
        artistName: 'Alice',
        showTitle: 'Solo',
        technicalNeeds: 'Rien',
        showId: null,
        show: null,
      },
      {
        id: 12,
        artistName: 'Bob',
        showTitle: 'Show B',
        technicalNeeds: 'Son',
        showId: 200,
        show: { id: 200, title: 'Opener', editionId: 1 },
      },
    ])
    const mockEvent = { context: { user: mockUser } }
    const result = await handler(mockEvent as any)
    expect(result.data.groups).toHaveLength(2)
    expect(result.data.groups[0].show?.title).toBe('Opener')
    expect(result.data.groups[1].show).toBeNull()
    expect(result.data.groups[1].applications[0].artistName).toBe('Alice')
  })

  it('traite comme orphelin un show appartenant à une autre édition', async () => {
    prismaMock.showApplication.findMany.mockResolvedValue([
      {
        id: 11,
        artistName: 'Alice',
        showTitle: 'Show A',
        technicalNeeds: 'X',
        showId: 999,
        // editionId différent → ne doit pas exposer ce show
        show: { id: 999, title: 'Show secret autre édition', editionId: 42 },
      },
    ])
    const mockEvent = { context: { user: mockUser } }
    const result = await handler(mockEvent as any)
    expect(result.data.groups).toHaveLength(1)
    expect(result.data.groups[0].show).toBeNull()
    // Le titre fuiterait sinon — on vérifie qu'il n'est nulle part
    const serialized = JSON.stringify(result.data)
    expect(serialized).not.toContain('Show secret autre édition')
  })

  it("renvoie editionName depuis l'édition (ou fallback convention)", async () => {
    const mockEvent = { context: { user: mockUser } }
    const result = await handler(mockEvent as any)
    expect(result.data.editionName).toBe('Convention Test 2026')

    prismaMock.edition.findUnique.mockResolvedValue({
      ...mockEdition,
      name: null,
      convention: { name: 'Fallback Convention', authorId: 1, organizers: [] },
    })
    const result2 = await handler(mockEvent as any)
    expect(result2.data.editionName).toBe('Fallback Convention')
  })
})
