import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())
const mockCanEditEdition = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEditionWithPermissions,
  canEditEdition: mockCanEditEdition,
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../../layers/faq/server/api/editions/[id]/faq/reorder.put'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'u@t.com', pseudo: 'u' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}
const baseEvent = { context: { params: { id: '1' }, user: mockUser } }

describe('PUT /api/editions/[id]/faq/reorder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanEditEdition.mockReturnValue(true)
    prismaMock.faqEntry.findMany.mockReset()
    prismaMock.faqEntry.updateMany.mockReset()
    prismaMock.faqEntry.updateMany.mockResolvedValue({ count: 1 })
    global.readBody = vi.fn().mockResolvedValue({ orderedIds: [3, 1, 2] })
  })

  it('réassigne displayOrder selon l’index du tableau', async () => {
    prismaMock.faqEntry.findMany.mockResolvedValue([{ id: 3 }, { id: 1 }, { id: 2 }])
    const result = await handler(baseEvent as any)
    expect(result.success).toBe(true)
    expect(result.data.reordered).toBe(3)
    expect(prismaMock.faqEntry.updateMany).toHaveBeenCalledTimes(3)
    // Premier id du tableau → displayOrder 0, re-vérifie editionId (défense en profondeur).
    expect(prismaMock.faqEntry.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 3, editionId: 1 },
      data: { displayOrder: 0 },
    })
    expect(prismaMock.faqEntry.updateMany).toHaveBeenNthCalledWith(3, {
      where: { id: 2, editionId: 1 },
      data: { displayOrder: 2 },
    })
  })

  it('rejette 403 si pas canEditEdition', async () => {
    mockCanEditEdition.mockReturnValue(false)
    await expect(handler(baseEvent as any)).rejects.toThrow('Droits insuffisants')
    expect(prismaMock.faqEntry.updateMany).not.toHaveBeenCalled()
  })

  it("rejette 404 si l'édition est introuvable", async () => {
    mockGetEditionWithPermissions.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Édition non trouvée')
  })

  it("rejette 400 si certains ids n'appartiennent pas à l'édition", async () => {
    // orderedIds en contient 3 mais seules 2 entrées correspondent.
    prismaMock.faqEntry.findMany.mockResolvedValue([{ id: 3 }, { id: 1 }])
    await expect(handler(baseEvent as any)).rejects.toThrow("n'appartiennent pas à cette édition")
    expect(prismaMock.faqEntry.updateMany).not.toHaveBeenCalled()
  })
})
