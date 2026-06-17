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

import handler from '../../../../../../layers/faq/server/api/editions/[id]/faq/[entryId].delete'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'u@t.com', pseudo: 'u' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}
const baseEvent = { context: { params: { id: '1' }, user: mockUser } }

describe('DELETE /api/editions/[id]/faq/[entryId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanEditEdition.mockReturnValue(true)
    prismaMock.faqEntry.findFirst.mockReset()
    prismaMock.faqEntry.findFirst.mockResolvedValue({ id: 5 })
    prismaMock.faqEntry.delete.mockReset()
    prismaMock.faqEntry.delete.mockResolvedValue({ id: 5 })
    // getRouterParam est partagé par validateEditionId ('id') et le handler ('entryId').
    global.getRouterParam = vi.fn((_e: unknown, name: string) => (name === 'entryId' ? '5' : '1'))
  })

  it('supprime une entrée appartenant à l’édition', async () => {
    const result = await handler(baseEvent as any)
    expect(result.success).toBe(true)
    expect(result.data.deleted).toBe(true)
    expect(prismaMock.faqEntry.delete).toHaveBeenCalledWith({ where: { id: 5 } })
  })

  it("rejette 400 si l'identifiant d'entrée est invalide", async () => {
    global.getRouterParam = vi.fn((_e: unknown, name: string) => (name === 'entryId' ? 'abc' : '1'))
    await expect(handler(baseEvent as any)).rejects.toThrow('Identifiant invalide')
    expect(prismaMock.faqEntry.delete).not.toHaveBeenCalled()
  })

  it("rejette 404 si l'édition est introuvable", async () => {
    mockGetEditionWithPermissions.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Édition non trouvée')
  })

  it('rejette 403 si pas canEditEdition', async () => {
    mockCanEditEdition.mockReturnValue(false)
    await expect(handler(baseEvent as any)).rejects.toThrow('Droits insuffisants')
    expect(prismaMock.faqEntry.delete).not.toHaveBeenCalled()
  })

  it("rejette 404 si l'entrée n'appartient pas à l'édition", async () => {
    prismaMock.faqEntry.findFirst.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Entrée introuvable')
    expect(prismaMock.faqEntry.delete).not.toHaveBeenCalled()
  })
})
