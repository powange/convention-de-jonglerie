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

const mockCanAccessEditionData = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canAccessEditionData: mockCanAccessEditionData,
}))

import handler from '../../../../../../server/api/editions/[id]/ticketing/stats/validations.get'

const prismaMock = (globalThis as any).prisma

const mockEvent = {
  context: { params: { id: '1' }, user: { id: 1, pseudo: 'u' } },
}

describe('GET /api/editions/[id]/ticketing/stats/validations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAccessEditionData.mockResolvedValue(true)
    ;(globalThis as any).getQuery = vi.fn().mockReturnValue({ granularity: '60' })
    prismaMock.event.findUnique.mockResolvedValue({
      startDate: new Date('2025-07-15T00:00:00Z'),
      endDate: new Date('2025-07-20T00:00:00Z'),
      volunteerSettings: null,
    })
    // Aucune validation d'entrée par défaut
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([])
    prismaMock.editionArtist.findMany.mockResolvedValue([])
    prismaMock.editionOrganizer.findMany.mockResolvedValue([])
  })

  it('retourne les périodes sans planter (régression: `edition is not defined`)', async () => {
    const result = await handler(mockEvent as any)

    // Les périodes proviennent désormais de l'Event (evStart/evEnd), plus de la variable `edition`.
    expect(result.periods).toBeDefined()
    expect(result.periods.event.start).toBe(new Date('2025-07-15T00:00:00Z').toISOString())
    expect(result.periods.event.end).toBe(new Date('2025-07-20T00:00:00Z').toISOString())
    expect(result.periods.setup.end).toBe(result.periods.event.start)
    expect(result.periods.teardown.start).toBe(result.periods.event.end)
    // Structure de réponse de base
    expect(Array.isArray(result.labels)).toBe(true)
    expect(result.totals).toEqual({
      participants: 0,
      others: 0,
      volunteers: 0,
      artists: 0,
      organizers: 0,
    })
  })

  it('compte les validations dans la bonne tranche', async () => {
    prismaMock.ticketingOrderItem.findMany
      .mockResolvedValueOnce([{ entryValidatedAt: new Date('2025-07-15T10:30:00Z') }]) // participants
      .mockResolvedValueOnce([]) // others
    const result = await handler(mockEvent as any)
    expect(result.totals.participants).toBe(1)
  })

  it('rejette 404 si l’événement est introuvable', async () => {
    prismaMock.event.findUnique.mockResolvedValue(null)
    await expect(handler(mockEvent as any)).rejects.toThrow('Edition not found')
  })

  it('rejette 403 sans accès aux données de l’édition', async () => {
    mockCanAccessEditionData.mockResolvedValue(false)
    await expect(handler(mockEvent as any)).rejects.toThrow('Droits insuffisants')
  })
})
