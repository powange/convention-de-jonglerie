import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionForEdit = vi.hoisted(() => vi.fn())
const mockFetchExternalMapObjects = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionForEdit: mockGetEditionForEdit,
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

vi.mock('#server/utils/external-map-fetch', () => ({
  fetchExternalMapObjects: mockFetchExternalMapObjects,
}))

import handler from '../../../../../../server/api/editions/[id]/external-map/objects.get'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'u@t.com', pseudo: 'u' }
const baseEvent = { context: { params: { id: '24' }, user: mockUser } }

function mapObject(externalId: string | null, name: string, kind = 'polygon') {
  return {
    externalId,
    name,
    description: null,
    layer: 'Camp',
    kind,
    coordinates: [[46.4, 15.8]],
    color: '#06B6D4',
  }
}

function dbRow(id: number, externalMapObjectId: string | null) {
  return {
    id,
    name: `objet ${id}`,
    externalMapObjectId,
    externalMapImportedAt: externalMapObjectId ? new Date('2026-07-01T10:00:00Z') : null,
    updatedAt: new Date('2026-07-01T10:00:00Z'),
    // `showPerformances` : c'est le nom de la relation réelle. Le mock disait `shows`, ce que
    // le code demandait alors — et ce test passait donc sur une requête que Prisma refusait.
    _count: { showPerformances: 0, workshopLocations: 0, stockItems: 0, stockReservations: 0 },
  }
}

describe('GET /api/editions/[id]/external-map/objects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn(() => '24')
    mockGetEditionForEdit.mockResolvedValue({
      id: 24,
      externalMapProvider: 'google',
      externalMapRef: 'MID123',
    })
    mockFetchExternalMapObjects.mockResolvedValue({
      name: 'EJC2026',
      identified: true,
      objects: [mapObject('AAA1', 'Camping')],
    })
    prismaMock.editionZone.findMany.mockReset()
    prismaMock.editionZone.findMany.mockResolvedValue([])
    prismaMock.editionMarker.findMany.mockReset()
    prismaMock.editionMarker.findMany.mockResolvedValue([])
  })

  it('renvoie les objets de la carte rapprochés de la base', async () => {
    const result: any = await handler(baseEvent as any)

    expect(result.data.mapName).toBe('EJC2026')
    expect(result.data.identified).toBe(true)
    expect(result.data.rows).toHaveLength(1)
    expect(result.data.rows[0].state).toBe('importable')
    expect(result.data.layers).toEqual(['Camp'])
  })

  it('reconnaît un objet déjà importé', async () => {
    prismaMock.editionZone.findMany.mockResolvedValue([dbRow(7, 'AAA1')])

    const result: any = await handler(baseEvent as any)

    expect(result.data.rows[0].state).toBe('imported')
    expect(result.data.rows[0].record.id).toBe(7)
  })

  it("refuse quand aucune carte externe n'est renseignée", async () => {
    mockGetEditionForEdit.mockResolvedValue({
      id: 24,
      externalMapProvider: null,
      externalMapRef: null,
    })

    await expect(handler(baseEvent as any)).rejects.toThrow('Aucune carte externe')
    expect(mockFetchExternalMapObjects).not.toHaveBeenCalled()
  })

  // Une carte repassée en privé ou un incident réseau renvoie zéro objet. Proposer alors de
  // supprimer tout ce qui en provenait détruirait le travail de l'organisateur.
  it('refuse une carte vide alors que des objets en proviennent', async () => {
    mockFetchExternalMapObjects.mockResolvedValue({
      name: 'EJC2026',
      identified: true,
      objects: [],
    })
    prismaMock.editionZone.findMany.mockResolvedValue([dbRow(7, 'AAA1')])

    await expect(handler(baseEvent as any)).rejects.toThrow('revenue vide')
  })

  it('accepte une carte vide quand rien n’en a jamais été importé', async () => {
    mockFetchExternalMapObjects.mockResolvedValue({
      name: 'EJC2026',
      identified: true,
      objects: [],
    })
    prismaMock.editionZone.findMany.mockResolvedValue([dbRow(7, null)])

    const result: any = await handler(baseEvent as any)
    expect(result.data.rows).toEqual([])
  })

  it('remonte les dépendances qui perdraient leur lieu', async () => {
    const row = dbRow(7, 'AAA1')
    row._count = { showPerformances: 3, workshopLocations: 2, stockItems: 1, stockReservations: 0 }
    prismaMock.editionZone.findMany.mockResolvedValue([row])

    const result: any = await handler(baseEvent as any)

    expect(result.data.rows[0].record.dependencies).toEqual({
      shows: 3,
      workshops: 2,
      stockItems: 1,
      stockReservations: 0,
    })
  })

  it('ne consulte pas la carte sans droit sur l’édition', async () => {
    // getEditionForEdit lève un createError : wrapApiHandler le laisse passer, là où une
    // Error nue serait masquée derrière « Erreur serveur interne ».
    mockGetEditionForEdit.mockRejectedValue(
      createError({ status: 403, message: 'Droits insuffisants' })
    )

    await expect(handler(baseEvent as any)).rejects.toThrow('Droits insuffisants')
    expect(mockFetchExternalMapObjects).not.toHaveBeenCalled()
  })
})
