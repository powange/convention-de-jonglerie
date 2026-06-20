import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())
const mockCanAccessStock = vi.hoisted(() => vi.fn())
const mockGetReservedQty = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEditionWithPermissions,
}))

vi.mock('#server/utils/stock-helpers', () => ({
  canAccessStock: mockCanAccessStock,
  getReservedQuantityOnPeriod: mockGetReservedQty,
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../../layers/stock/server/api/editions/[id]/stock-items/[itemId]/availability.get'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'u@t.com', pseudo: 'u' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}

function makeEvent(query: Record<string, string> = {}) {
  return {
    context: { params: { id: '1', itemId: '5' }, user: mockUser },
    node: { req: { url: '/?' + new URLSearchParams(query).toString() } },
  }
}

describe('GET /api/editions/[id]/stock-items/[itemId]/availability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanAccessStock.mockResolvedValue(true)
    mockGetReservedQty.mockResolvedValue(0)
    prismaMock.stockItem.findFirst.mockReset()
    prismaMock.stockItem.findFirst.mockResolvedValue({ id: 5, quantity: 10 })
    // getQuery global utilisé par H3
    ;(globalThis as any).getQuery = vi.fn((event) => {
      const url = event?.node?.req?.url || ''
      const search = url.split('?')[1] || ''
      const params = new URLSearchParams(search)
      const out: Record<string, string> = {}
      for (const [k, v] of params.entries()) out[k] = v
      return out
    })
  })

  it('retourne quantity / reserved / available avec période par défaut (now → +1h)', async () => {
    mockGetReservedQty.mockResolvedValue(3)
    const result = await handler(makeEvent() as any)
    expect(result.success).toBe(true)
    expect(result.data.quantity).toBe(10)
    expect(result.data.reserved).toBe(3)
    expect(result.data.available).toBe(7)
  })

  it('clampe available à 0 (jamais négatif)', async () => {
    mockGetReservedQty.mockResolvedValue(15)
    const result = await handler(makeEvent() as any)
    expect(result.data.available).toBe(0)
  })

  it('accepte une période explicite via ?at=...&until=...', async () => {
    const at = '2026-06-10T10:00:00.000Z'
    const until = '2026-06-10T18:00:00.000Z'
    await handler(makeEvent({ at, until }) as any)
    expect(mockGetReservedQty).toHaveBeenCalledWith(5, new Date(at), new Date(until))
  })

  it('refuse si until <= at', async () => {
    const at = '2026-06-10T10:00:00.000Z'
    await expect(handler(makeEvent({ at, until: at }) as any)).rejects.toThrow('Période invalide')
  })

  it('rejette 404 si item introuvable', async () => {
    prismaMock.stockItem.findFirst.mockResolvedValue(null)
    await expect(handler(makeEvent() as any)).rejects.toThrow('Objet introuvable')
  })

  it('rejette 403 sans canAccessStock', async () => {
    mockCanAccessStock.mockResolvedValue(false)
    await expect(handler(makeEvent() as any)).rejects.toThrow('Droits insuffisants')
  })
})
