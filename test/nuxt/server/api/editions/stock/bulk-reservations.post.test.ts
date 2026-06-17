import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())
const mockCanAccessStock = vi.hoisted(() => vi.fn())
const mockGetReservedQuantityOnPeriod = vi.hoisted(() => vi.fn())
const mockValidateReservationLocation = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEditionWithPermissions,
}))

vi.mock('#server/utils/stock-helpers', () => ({
  canAccessStock: mockCanAccessStock,
  getReservedQuantityOnPeriod: mockGetReservedQuantityOnPeriod,
  validateReservationLocation: mockValidateReservationLocation,
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../../layers/stock/server/api/editions/[id]/stock-reservations/bulk.post'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'u@t.com', pseudo: 'u' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}

const baseEvent = { context: { params: { id: '1' }, user: mockUser } }

const validBody = {
  items: [
    { id: 10, quantity: 2 },
    { id: 11, quantity: 1 },
    { id: 12, quantity: 3 },
  ],
  startsAt: '2026-06-01T10:00:00.000Z',
  endsAt: '2026-06-01T18:00:00.000Z',
  usage: 'Spectacle de feu samedi',
  location: 'Scène principale',
}

describe('POST /api/editions/[id]/stock-reservations/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanAccessStock.mockResolvedValue(true)
    mockGetReservedQuantityOnPeriod.mockResolvedValue(0)
    mockValidateReservationLocation.mockResolvedValue(undefined)
    prismaMock.stockItem.findMany.mockReset()
    prismaMock.stockItem.findMany.mockResolvedValue([
      { id: 10, name: 'Rallonge', quantity: 5 },
      { id: 11, name: 'Projecteur', quantity: 2 },
      { id: 12, name: 'Câble', quantity: 10 },
    ])
    prismaMock.stockReservation.create.mockReset()
    prismaMock.stockReservation.create.mockImplementation(async ({ data }: any) => ({
      id: data.stockItemId + 1000,
    }))
    // Le handler utilise maintenant `$transaction(async (tx) => ...)`. On passe
    // le mock global comme tx pour réutiliser les mêmes mocks de modèle.
    prismaMock.$transaction.mockImplementation(async (arg: any) => {
      if (typeof arg === 'function') return arg(prismaMock)
      return Promise.all(arg)
    })
    global.readBody = vi.fn().mockResolvedValue(validBody)
  })

  it('crée une réservation par item avec la quantité demandée', async () => {
    const result = await handler(baseEvent as any)
    expect(result.success).toBe(true)
    expect(result.data.created).toBe(3)
    expect(prismaMock.stockReservation.create).toHaveBeenCalledTimes(3)
    // Vérifie les quantités passées à chaque création
    const calls = prismaMock.stockReservation.create.mock.calls
    const byItem = Object.fromEntries(
      calls.map((c: any) => [c[0].data.stockItemId, c[0].data.quantityReserved])
    )
    expect(byItem).toEqual({ 10: 2, 11: 1, 12: 3 })
  })

  it('rejette 404 si édition introuvable', async () => {
    mockGetEditionWithPermissions.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Édition non trouvée')
  })

  it('rejette 403 sans canAccessStock', async () => {
    mockCanAccessStock.mockResolvedValue(false)
    await expect(handler(baseEvent as any)).rejects.toThrow('Droits insuffisants')
  })

  it("rejette si un item n'appartient pas à l'édition", async () => {
    prismaMock.stockItem.findMany.mockResolvedValue([{ id: 10, name: 'Rallonge', quantity: 5 }])
    await expect(handler(baseEvent as any)).rejects.toThrow(/appartiennent/)
  })

  it('rejette si la période est inversée', async () => {
    global.readBody = vi.fn().mockResolvedValue({
      ...validBody,
      startsAt: '2026-06-01T18:00:00.000Z',
      endsAt: '2026-06-01T10:00:00.000Z',
    })
    await expect(handler(baseEvent as any)).rejects.toThrow(/date de fin/)
  })

  it('rejette en bloc si la quantité demandée dépasse la dispo', async () => {
    // Projecteur dispo = 2, on en demande 1, mais une résa de 2 occupe la période
    mockGetReservedQuantityOnPeriod.mockImplementation(async (itemId: number) => {
      if (itemId === 11) return 2
      return 0
    })
    await expect(handler(baseEvent as any)).rejects.toThrow(/disponibles/)
    expect(prismaMock.stockReservation.create).not.toHaveBeenCalled()
  })

  it('rejette si la quantité demandée dépasse le stock total', async () => {
    global.readBody = vi.fn().mockResolvedValue({
      ...validBody,
      items: [{ id: 11, quantity: 99 }],
    })
    prismaMock.stockItem.findMany.mockResolvedValue([{ id: 11, name: 'Projecteur', quantity: 2 }])
    await expect(handler(baseEvent as any)).rejects.toThrow(/disponibles/)
    expect(prismaMock.stockReservation.create).not.toHaveBeenCalled()
  })

  it('rejette zone et marker simultanés', async () => {
    global.readBody = vi.fn().mockResolvedValue({
      ...validBody,
      location: null,
      zoneId: 5,
      markerId: 6,
    })
    await expect(handler(baseEvent as any)).rejects.toThrow()
    expect(prismaMock.stockReservation.create).not.toHaveBeenCalled()
  })

  it('rejette si ni texte ni zone ni marker', async () => {
    global.readBody = vi.fn().mockResolvedValue({
      ...validBody,
      location: '',
      zoneId: null,
      markerId: null,
    })
    await expect(handler(baseEvent as any)).rejects.toThrow()
  })

  it("fusionne les doublons d'item id en additionnant leurs quantités", async () => {
    global.readBody = vi.fn().mockResolvedValue({
      ...validBody,
      items: [
        { id: 10, quantity: 1 },
        { id: 10, quantity: 2 },
        { id: 11, quantity: 1 },
      ],
    })
    prismaMock.stockItem.findMany.mockResolvedValue([
      { id: 10, name: 'Rallonge', quantity: 5 },
      { id: 11, name: 'Projecteur', quantity: 2 },
    ])
    await handler(baseEvent as any)
    expect(prismaMock.stockReservation.create).toHaveBeenCalledTimes(2)
    const byItem = Object.fromEntries(
      prismaMock.stockReservation.create.mock.calls.map((c: any) => [
        c[0].data.stockItemId,
        c[0].data.quantityReserved,
      ])
    )
    expect(byItem).toEqual({ 10: 3, 11: 1 })
  })

  it('rejette items vide via Zod', async () => {
    global.readBody = vi.fn().mockResolvedValue({ ...validBody, items: [] })
    await expect(handler(baseEvent as any)).rejects.toThrow()
  })

  it('rejette quantity = 0 via Zod', async () => {
    global.readBody = vi.fn().mockResolvedValue({
      ...validBody,
      items: [{ id: 10, quantity: 0 }],
    })
    await expect(handler(baseEvent as any)).rejects.toThrow()
  })

  it('rejette plus de 50 items via Zod', async () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => ({ id: i + 1, quantity: 1 }))
    global.readBody = vi.fn().mockResolvedValue({ ...validBody, items: tooMany })
    await expect(handler(baseEvent as any)).rejects.toThrow()
    expect(prismaMock.stockReservation.create).not.toHaveBeenCalled()
  })

  it('ne crée rien si validateReservationLocation échoue', async () => {
    // On lève juste un objet pour vérifier l'absence de side-effect — le
    // mapping vers une 400 propre est testé indirectement ailleurs.
    mockValidateReservationLocation.mockRejectedValue(new Error('zone invalide'))
    await expect(handler(baseEvent as any)).rejects.toThrow()
    expect(prismaMock.stockReservation.create).not.toHaveBeenCalled()
  })

  it('rejette si la somme des doublons dépasse la dispo', async () => {
    global.readBody = vi.fn().mockResolvedValue({
      ...validBody,
      items: [
        { id: 11, quantity: 1 }, // Projecteur dispo = 2
        { id: 11, quantity: 2 }, // somme = 3 > 2
      ],
    })
    prismaMock.stockItem.findMany.mockResolvedValue([{ id: 11, name: 'Projecteur', quantity: 2 }])
    await expect(handler(baseEvent as any)).rejects.toThrow(/disponibles/)
    expect(prismaMock.stockReservation.create).not.toHaveBeenCalled()
  })
})
