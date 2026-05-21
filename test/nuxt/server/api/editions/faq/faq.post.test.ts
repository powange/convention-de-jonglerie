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

import handler from '../../../../../../server/api/editions/[id]/faq/index.post'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'u@t.com', pseudo: 'u' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}

const baseEvent = { context: { params: { id: '1' }, user: mockUser } }
const validBody = {
  question: 'À quelle heure ouvrent les portes ?',
  answer: 'Les portes ouvrent à 9h.',
}

describe('POST /api/editions/[id]/faq', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanEditEdition.mockReturnValue(true)
    prismaMock.faqEntry.findFirst.mockReset()
    prismaMock.faqEntry.findFirst.mockResolvedValue(null)
    prismaMock.faqEntry.create.mockReset()
    prismaMock.faqEntry.create.mockResolvedValue({ id: 100, ...validBody, isPublic: false })
    global.readBody = vi.fn().mockResolvedValue(validBody)
  })

  it('crée une entrée FAQ privée par défaut', async () => {
    const result = await handler(baseEvent as any)
    expect(result.success).toBe(true)
    expect(prismaMock.faqEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          editionId: 1,
          question: validBody.question,
          answer: validBody.answer,
          isPublic: false,
          displayOrder: 0,
        }),
      })
    )
  })

  it('accepte isPublic = true', async () => {
    global.readBody = vi.fn().mockResolvedValue({ ...validBody, isPublic: true })
    await handler(baseEvent as any)
    expect(prismaMock.faqEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isPublic: true }) })
    )
  })

  it('rejette si question vide', async () => {
    global.readBody = vi.fn().mockResolvedValue({ ...validBody, question: '' })
    await expect(handler(baseEvent as any)).rejects.toThrow()
  })

  it('rejette si réponse vide', async () => {
    global.readBody = vi.fn().mockResolvedValue({ ...validBody, answer: '' })
    await expect(handler(baseEvent as any)).rejects.toThrow()
  })

  it('rejette 403 si pas canEditEdition', async () => {
    mockCanEditEdition.mockReturnValue(false)
    await expect(handler(baseEvent as any)).rejects.toThrow('Droits insuffisants')
  })

  it('calcule displayOrder = max+1 si entrées existantes', async () => {
    prismaMock.faqEntry.findFirst.mockResolvedValue({ displayOrder: 4 })
    await handler(baseEvent as any)
    expect(prismaMock.faqEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ displayOrder: 5 }) })
    )
  })
})
