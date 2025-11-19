import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock des utilitaires - DOIT être avant les imports
vi.mock('../../../../../server/utils/organizer-management', () => ({
  canAccessConvention: vi.fn(),
}))

import { canAccessConvention } from '@@/server/utils/organizer-management'
import handler from '../../../../../server/api/conventions/[id]/editions.get'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const mockCanAccess = canAccessConvention as ReturnType<typeof vi.fn>

const baseEvent = {
  context: {
    params: { id: '1' },
    user: { id: 10 },
  },
}

describe('/api/conventions/[id]/editions GET', () => {
  beforeEach(() => {
    mockCanAccess.mockReset()
    prismaMock.edition.findMany.mockReset()
  })

  it('retourne les editions avec succès', async () => {
    mockCanAccess.mockResolvedValue(true)
    const editions = [
      {
        id: 1,
        name: 'Edition 1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-05'),
      },
      {
        id: 2,
        name: 'Edition 2',
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-05'),
      },
    ]
    prismaMock.edition.findMany.mockResolvedValue(editions)

    const res = await handler(baseEvent as any)
    expect(res).toEqual(editions)
    expect(prismaMock.edition.findMany).toHaveBeenCalledWith({
      where: { conventionId: 1 },
      select: { id: true, name: true, startDate: true, endDate: true },
    })
  })

  it('rejette utilisateur non authentifié', async () => {
    await expect(
      handler({ ...baseEvent, context: { ...baseEvent.context, user: null } } as any)
    ).rejects.toThrow('Unauthorized')
  })

  it('rejette si pas de permission', async () => {
    mockCanAccess.mockResolvedValue(false)
    await expect(handler(baseEvent as any)).rejects.toThrow('Accès refusé')
  })

  it('valide id invalide', async () => {
    const ev = { ...baseEvent, context: { ...baseEvent.context, params: { id: '0' } } }
    await expect(handler(ev as any)).rejects.toThrow('ID de convention invalide')
  })

  it('retourne tableau vide si aucune édition', async () => {
    mockCanAccess.mockResolvedValue(true)
    prismaMock.edition.findMany.mockResolvedValue([])
    const res = await handler(baseEvent as any)
    expect(res).toEqual([])
  })

  it('accepte conversion ID numérique', async () => {
    mockCanAccess.mockResolvedValue(true)
    prismaMock.edition.findMany.mockResolvedValue([])
    const ev = { ...baseEvent, context: { ...baseEvent.context, params: { id: '42' } } }
    await handler(ev as any)
    expect(prismaMock.edition.findMany).toHaveBeenCalledWith({
      where: { conventionId: 42 },
      select: { id: true, name: true, startDate: true, endDate: true },
    })
  })

  it('permet accès à un organisateur sans aucun droit spécifique', async () => {
    // Un organisateur avec tous les droits à false peut quand même accéder
    mockCanAccess.mockResolvedValue(true)
    const editions = [
      {
        id: 1,
        name: 'Edition accessible',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-05'),
      },
    ]
    prismaMock.edition.findMany.mockResolvedValue(editions)

    const res = await handler(baseEvent as any)
    expect(res).toEqual(editions)
    expect(mockCanAccess).toHaveBeenCalledWith(1, 10, baseEvent)
  })
})
