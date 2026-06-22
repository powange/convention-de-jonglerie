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

import handler from '../../../../../../../../layers/faq/server/api/editions/[id]/faq/[entryId].put'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'u@t.com', pseudo: 'u' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}
const baseEvent = { context: { params: { id: '1' }, user: mockUser } }

describe('PUT /api/editions/[id]/faq/[entryId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanEditEdition.mockReturnValue(true)
    prismaMock.faqEntry.findFirst.mockReset()
    prismaMock.faqEntry.findFirst.mockResolvedValue({ id: 5 })
    prismaMock.faqEntry.update.mockReset()
    prismaMock.faqEntry.update.mockResolvedValue({
      id: 5,
      question: 'Q',
      answer: 'A',
      isPublic: true,
    })
    // getRouterParam est partagé par validateEditionId ('id') et le handler ('entryId').
    global.getRouterParam = vi.fn((_e: unknown, name: string) => (name === 'entryId' ? '5' : '1'))
    global.readBody = vi.fn().mockResolvedValue({ isPublic: true })
  })

  it('met à jour uniquement les champs fournis (patch partiel)', async () => {
    global.readBody = vi.fn().mockResolvedValue({ question: 'Nouvelle question' })
    const result = await handler(baseEvent as any)
    expect(result.success).toBe(true)
    expect(prismaMock.faqEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5 }, data: { question: 'Nouvelle question' } })
    )
  })

  it('bascule la visibilité (isPublic)', async () => {
    global.readBody = vi.fn().mockResolvedValue({ isPublic: false })
    await handler(baseEvent as any)
    expect(prismaMock.faqEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isPublic: false } })
    )
  })

  it("rejette 400 si l'identifiant d'entrée est invalide", async () => {
    global.getRouterParam = vi.fn((_e: unknown, name: string) => (name === 'entryId' ? 'abc' : '1'))
    await expect(handler(baseEvent as any)).rejects.toThrow('Identifiant invalide')
    expect(prismaMock.faqEntry.update).not.toHaveBeenCalled()
  })

  it("rejette 404 si l'édition est introuvable", async () => {
    mockGetEditionWithPermissions.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Édition non trouvée')
  })

  it('rejette 403 si pas canEditEdition', async () => {
    mockCanEditEdition.mockReturnValue(false)
    await expect(handler(baseEvent as any)).rejects.toThrow('Droits insuffisants')
  })

  it("rejette 404 si l'entrée n'appartient pas à l'édition", async () => {
    prismaMock.faqEntry.findFirst.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Entrée introuvable')
    expect(prismaMock.faqEntry.update).not.toHaveBeenCalled()
  })

  it('rejette si la question dépasse la longueur maximale', async () => {
    global.readBody = vi.fn().mockResolvedValue({ question: 'x'.repeat(501) })
    await expect(handler(baseEvent as any)).rejects.toThrow()
    expect(prismaMock.faqEntry.update).not.toHaveBeenCalled()
  })
})
