import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCanEditEdition = vi.hoisted(() => vi.fn())

// canManageWorkshopLocations délègue à canEditEdition après avoir lu l'Edition côté core.
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canEditEdition: mockCanEditEdition,
}))

import { canManageWorkshopLocations } from '../../../../../server/utils/permissions/workshop-permissions'

const prismaMock = (globalThis as any).prisma

const user = { id: 1, isGlobalAdmin: false } as any

describe('canManageWorkshopLocations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('false si l’édition est introuvable (sans appeler canEditEdition)', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(null)
    expect(await canManageWorkshopLocations(user, 10)).toBe(false)
    expect(mockCanEditEdition).not.toHaveBeenCalled()
  })

  it('délègue à canEditEdition quand l’édition existe (autorisé)', async () => {
    const edition = { id: 10, convention: { organizers: [] }, organizerPermissions: [] }
    prismaMock.edition.findUnique.mockResolvedValue(edition)
    mockCanEditEdition.mockReturnValue(true)

    expect(await canManageWorkshopLocations(user, 10)).toBe(true)
    expect(mockCanEditEdition).toHaveBeenCalledWith(edition, user)
  })

  it('false quand canEditEdition refuse', async () => {
    prismaMock.edition.findUnique.mockResolvedValue({
      id: 10,
      convention: { organizers: [] },
      organizerPermissions: [],
    })
    mockCanEditEdition.mockReturnValue(false)
    expect(await canManageWorkshopLocations(user, 10)).toBe(false)
  })
})
