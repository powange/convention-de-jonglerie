import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionForEdit = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionForEdit: mockGetEditionForEdit,
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../../server/api/editions/[id]/external-map/import.post'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'u@t.com', pseudo: 'u' }
const baseEvent = { context: { params: { id: '24' }, user: mockUser } }

const POLYGON = {
  externalId: 'AAA1',
  kind: 'polygon',
  name: 'Camping',
  description: null,
  color: '#06B6D4',
  types: ['TENT_CAMPING'],
  coordinates: [
    [46.4, 15.8],
    [46.5, 15.9],
    [46.6, 15.7],
  ],
}

const POINT = {
  externalId: 'BBB1',
  kind: 'point',
  name: 'Accueil',
  description: null,
  color: '#0288D1',
  types: ['INFO'],
  coordinates: [[46.42, 15.86]],
}

function setBody(body: unknown) {
  ;(global.readBody as any) = vi.fn().mockResolvedValue(body)
}

describe('POST /api/editions/[id]/external-map/import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn(() => '24')
    mockGetEditionForEdit.mockResolvedValue({ id: 24 })

    for (const model of ['editionZone', 'editionMarker'] as const) {
      prismaMock[model].findFirst.mockReset()
      prismaMock[model].findFirst.mockResolvedValue(null)
      prismaMock[model].count.mockReset()
      prismaMock[model].count.mockResolvedValue(0)
      prismaMock[model].aggregate.mockReset()
      prismaMock[model].aggregate.mockResolvedValue({ _max: { order: 2 } })
      prismaMock[model].create.mockReset()
      prismaMock[model].create.mockResolvedValue({ id: 9 })
    }
  })

  it('crée une zone à partir d’un polygone, avec sa provenance', async () => {
    setBody(POLYGON)

    const result: any = await handler(baseEvent as any)

    expect(result.data.alreadyImported).toBe(false)
    const data = prismaMock.editionZone.create.mock.calls[0][0].data
    expect(data.externalMapObjectId).toBe('AAA1')
    expect(data.externalMapImportedAt).toBeInstanceOf(Date)
    expect(data.zoneTypes).toEqual(['TENT_CAMPING'])
    expect(data.order).toBe(3)
  })

  it('crée un marqueur à partir d’un point', async () => {
    setBody(POINT)

    await handler(baseEvent as any)

    const data = prismaMock.editionMarker.create.mock.calls[0][0].data
    expect(data.latitude).toBe(46.42)
    expect(data.longitude).toBe(15.86)
    expect(data.externalMapObjectId).toBe('BBB1')
  })

  // Un double-clic ne doit pas créer deux fois le même objet.
  it('ne recrée pas un objet déjà importé', async () => {
    setBody(POLYGON)
    prismaMock.editionZone.findFirst.mockResolvedValue({ id: 5 })

    const result: any = await handler(baseEvent as any)

    expect(result.data.alreadyImported).toBe(true)
    expect(prismaMock.editionZone.create).not.toHaveBeenCalled()
  })

  // Deux clics rapprochés passent tous deux la vérification avant que le premier n'écrive :
  // c'est alors la contrainte d'unicité qui tranche, et une 500 serait une mauvaise réponse.
  it('rattrape la violation d’unicité d’un double-clic concurrent', async () => {
    setBody(POLYGON)
    prismaMock.editionZone.create.mockRejectedValue(
      Object.assign(new Error('unique'), {
        code: 'P2002',
      })
    )
    prismaMock.editionZone.findFirst
      .mockResolvedValueOnce(null) // vérification initiale
      .mockResolvedValueOnce({ id: 5 }) // relecture après la collision

    const result: any = await handler(baseEvent as any)

    expect(result.data.alreadyImported).toBe(true)
    expect(result.data.item).toEqual({ id: 5 })
  })

  // Le rattrapage ci-dessus ne doit pas se transformer en avaleur d'erreurs : une panne réelle
  // doit échouer, et non être présentée comme un import déjà fait. Le message est masqué par
  // wrapApiHandler, qui évite d'exposer un détail technique — c'est le rejet qui compte.
  it('laisse échouer une erreur qui n’est pas une violation d’unicité', async () => {
    setBody(POLYGON)
    prismaMock.editionZone.create.mockRejectedValue(new Error('base indisponible'))

    await expect(handler(baseEvent as any)).rejects.toThrow()
    // La relecture de rattrapage n'a pas lieu : seule la vérification initiale a été faite.
    expect(prismaMock.editionZone.findFirst).toHaveBeenCalledTimes(1)
  })

  it('refuse un polygone qui n’a pas assez de points', async () => {
    setBody({ ...POLYGON, coordinates: [[46.4, 15.8]] })

    await expect(handler(baseEvent as any)).rejects.toThrow('au moins')
    expect(prismaMock.editionZone.create).not.toHaveBeenCalled()
  })

  it('refuse un point qui porte plusieurs coordonnées', async () => {
    setBody({
      ...POINT,
      coordinates: [
        [46.4, 15.8],
        [46.5, 15.9],
      ],
    })

    await expect(handler(baseEvent as any)).rejects.toThrow('exactement une coordonnée')
    expect(prismaMock.editionMarker.create).not.toHaveBeenCalled()
  })

  it('refuse une latitude hors bornes', async () => {
    setBody({ ...POINT, coordinates: [[500, 15.86]] })

    await expect(handler(baseEvent as any)).rejects.toThrow()
    expect(prismaMock.editionMarker.create).not.toHaveBeenCalled()
  })

  it('refuse une couleur qui n’est pas au format #RRGGBB', async () => {
    setBody({ ...POLYGON, color: 'bleu' })

    await expect(handler(baseEvent as any)).rejects.toThrow()
    expect(prismaMock.editionZone.create).not.toHaveBeenCalled()
  })

  it('respecte la limite de zones par édition', async () => {
    setBody(POLYGON)
    prismaMock.editionZone.count.mockResolvedValue(50)

    await expect(handler(baseEvent as any)).rejects.toThrow('Limite')
    expect(prismaMock.editionZone.create).not.toHaveBeenCalled()
  })

  it('respecte la limite de marqueurs par édition', async () => {
    setBody(POINT)
    prismaMock.editionMarker.count.mockResolvedValue(100)

    await expect(handler(baseEvent as any)).rejects.toThrow('Limite')
    expect(prismaMock.editionMarker.create).not.toHaveBeenCalled()
  })

  it('n’écrit rien sans droit sur l’édition', async () => {
    setBody(POLYGON)
    // getEditionForEdit lève un createError : wrapApiHandler le laisse passer, là où une
    // Error nue serait masquée derrière « Erreur serveur interne ».
    mockGetEditionForEdit.mockRejectedValue(
      createError({ status: 403, message: 'Droits insuffisants' })
    )

    await expect(handler(baseEvent as any)).rejects.toThrow('Droits insuffisants')
    expect(prismaMock.editionZone.create).not.toHaveBeenCalled()
  })

  // Sans identifiant, on ne peut pas dédupliquer : l'objet est créé tel quel, provenance nulle.
  it('accepte un objet sans identifiant de fournisseur', async () => {
    setBody({ ...POLYGON, externalId: null })

    await handler(baseEvent as any)

    expect(prismaMock.editionZone.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.editionZone.create.mock.calls[0][0].data.externalMapObjectId).toBeNull()
  })
})
