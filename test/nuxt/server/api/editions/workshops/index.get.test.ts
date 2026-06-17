import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetConfig = vi.hoisted(() => vi.fn())
const mockGetUserSession = vi.hoisted(() => vi.fn())

// wrapApiHandler et validateEditionId sont auto-importés (Nitro) dans le handler.
vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
  if (!(globalThis as any).validateEditionId) {
    ;(globalThis as any).validateEditionId = (event: any) =>
      parseInt(event?.context?.params?.id, 10)
  }
})

// getUserSession est auto-importé depuis nuxt-auth-utils (cf. nuxt.config imports.imports).
vi.mock('nuxt-auth-utils', () => ({
  getUserSession: mockGetUserSession,
  requireUserSession: vi.fn(),
  setUserSession: vi.fn(),
  clearUserSession: vi.fn(),
}))

// Existence + activation via le port ateliers.
vi.mock('#server/workshops/ports/registry', () => ({
  useWorkshopsPorts: () => ({ event: { getConfig: mockGetConfig } }),
}))

import handler from '../../../../../../layers/workshops/server/api/editions/[id]/workshops/index.get'

const prismaMock = (globalThis as any).prisma

const mockEvent = { context: { params: { id: '1' }, user: null } }

const enabledConfig = {
  found: true,
  enabled: true,
  locationsFreeInput: false,
  startDate: new Date('2026-07-01'),
  endDate: new Date('2026-07-05'),
}

describe('GET /api/editions/[id]/workshops', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetConfig.mockResolvedValue(enabledConfig)
    mockGetUserSession.mockResolvedValue({ user: null })
    prismaMock.workshop.findMany.mockReset()
    prismaMock.workshop.findMany.mockResolvedValue([])
  })

  it('retourne les workshops quand le module est activé', async () => {
    prismaMock.workshop.findMany.mockResolvedValue([{ id: 1, title: 'A', favorites: [] }])
    const res = await handler(mockEvent as any)
    expect(mockGetConfig).toHaveBeenCalledWith(1)
    expect(res).toHaveLength(1)
    expect(res[0]).toMatchObject({ id: 1, isFavorite: false })
  })

  it('rejette 404 si l’édition est introuvable', async () => {
    mockGetConfig.mockResolvedValue({
      found: false,
      enabled: false,
      locationsFreeInput: false,
      startDate: null,
      endDate: null,
    })
    await expect(handler(mockEvent as any)).rejects.toThrow('Édition non trouvée')
    expect(prismaMock.workshop.findMany).not.toHaveBeenCalled()
  })

  it('rejette 403 si les workshops sont désactivés', async () => {
    mockGetConfig.mockResolvedValue({ ...enabledConfig, enabled: false })
    await expect(handler(mockEvent as any)).rejects.toThrow('ne sont pas activés')
    expect(prismaMock.workshop.findMany).not.toHaveBeenCalled()
  })
})
