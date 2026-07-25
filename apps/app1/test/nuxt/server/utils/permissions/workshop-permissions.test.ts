import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCanManageWorkshops = vi.hoisted(() => vi.fn())

// canManageWorkshopLocations délègue à canManageWorkshops (droit dédié « gérer les ateliers »)
// après avoir lu l'Edition côté core.
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageWorkshops: mockCanManageWorkshops,
}))

import { canManageWorkshopLocations } from '../../../../../server/utils/permissions/workshop-permissions'

const prismaMock = (globalThis as any).prisma

const user = { id: 1, isGlobalAdmin: false } as any

describe('canManageWorkshopLocations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('false si l’édition est introuvable (sans appeler canManageWorkshops)', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(null)
    expect(await canManageWorkshopLocations(user, 10)).toBe(false)
    expect(mockCanManageWorkshops).not.toHaveBeenCalled()
  })

  it('délègue à canManageWorkshops quand l’édition existe (autorisé)', async () => {
    const edition = { id: 10, convention: { organizers: [] }, organizerPermissions: [] }
    prismaMock.edition.findUnique.mockResolvedValue(edition)
    mockCanManageWorkshops.mockReturnValue(true)

    expect(await canManageWorkshopLocations(user, 10)).toBe(true)
    expect(mockCanManageWorkshops).toHaveBeenCalledWith(edition, user)
  })

  it('false quand canManageWorkshops refuse', async () => {
    prismaMock.edition.findUnique.mockResolvedValue({
      id: 10,
      convention: { organizers: [] },
      organizerPermissions: [],
    })
    mockCanManageWorkshops.mockReturnValue(false)
    expect(await canManageWorkshopLocations(user, 10)).toBe(false)
  })
})
