import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())
const mockCanEditEdition = vi.hoisted(() => vi.fn())
const mockOptionalAuth = vi.hoisted(() => vi.fn())
const mockGetFaqVisibility = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEditionWithPermissions,
  canEditEdition: mockCanEditEdition,
}))

vi.mock('#server/utils/auth-utils', () => ({
  optionalAuth: mockOptionalAuth,
}))

// Étape modularisation : la visibilité (faqEnabled/faqPagePublic) vient désormais du port FAQ,
// plus de l'objet Edition. On mocke le port pour piloter ces flags depuis les tests.
vi.mock('#server/faq/ports/registry', () => ({
  useFaqPorts: () => ({ directory: { getFaqVisibility: mockGetFaqVisibility } }),
}))

import handler from '../../../../../../layers/faq/server/api/editions/[id]/faq/index.get'

const prismaMock = (globalThis as any).prisma

const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}

const baseEvent = { context: { params: { id: '1' }, user: null } }

describe('GET /api/editions/[id]/faq', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanEditEdition.mockReturnValue(false)
    mockOptionalAuth.mockReturnValue(null)
    mockGetFaqVisibility.mockResolvedValue({ enabled: true, pagePublic: true })
    prismaMock.faqEntry.findMany.mockReset()
    prismaMock.faqEntry.findMany.mockResolvedValue([])
    // `getQuery` est utilisé par le handler ; on le mocke vide par défaut.
    ;(globalThis as any).getQuery = vi.fn().mockReturnValue({})
  })

  it('retourne uniquement les entrées publiques pour un visiteur non authentifié', async () => {
    await handler(baseEvent as any)
    expect(prismaMock.faqEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { editionId: 1, isPublic: true },
      })
    )
  })

  it('retourne toutes les entrées pour un organisateur avec canEditEdition', async () => {
    mockOptionalAuth.mockReturnValue({ id: 42 })
    mockCanEditEdition.mockReturnValue(true)
    await handler(baseEvent as any)
    expect(prismaMock.faqEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { editionId: 1 },
      })
    )
  })

  it('force le filtre isPublic même pour un éditeur quand publicOnly=1', async () => {
    mockOptionalAuth.mockReturnValue({ id: 42 })
    mockCanEditEdition.mockReturnValue(true)
    ;(globalThis as any).getQuery = vi.fn().mockReturnValue({ publicOnly: '1' })
    await handler(baseEvent as any)
    expect(prismaMock.faqEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { editionId: 1, isPublic: true },
      })
    )
  })

  it('retourne faqEnabled et faqPagePublic dans la réponse (depuis le port)', async () => {
    const result = await handler(baseEvent as any)
    expect(mockGetFaqVisibility).toHaveBeenCalledWith(1)
    expect(result.data.faqEnabled).toBe(true)
    expect(result.data.faqPagePublic).toBe(true)
  })

  it("rejette 404 si l'édition est introuvable", async () => {
    mockGetEditionWithPermissions.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Édition non trouvée')
  })

  it('rejette 404 pour un visiteur si faqEnabled = false', async () => {
    mockGetFaqVisibility.mockResolvedValue({ enabled: false, pagePublic: true })
    await expect(handler(baseEvent as any)).rejects.toThrow('FAQ non disponible')
    expect(prismaMock.faqEntry.findMany).not.toHaveBeenCalled()
  })

  it('rejette 404 pour un visiteur si faqPagePublic = false', async () => {
    mockGetFaqVisibility.mockResolvedValue({ enabled: true, pagePublic: false })
    await expect(handler(baseEvent as any)).rejects.toThrow('FAQ non disponible')
    expect(prismaMock.faqEntry.findMany).not.toHaveBeenCalled()
  })

  it('autorise un éditeur à accéder à la FAQ même si la page publique est désactivée', async () => {
    mockOptionalAuth.mockReturnValue({ id: 42 })
    mockCanEditEdition.mockReturnValue(true)
    mockGetFaqVisibility.mockResolvedValue({ enabled: true, pagePublic: false })
    await handler(baseEvent as any)
    expect(prismaMock.faqEntry.findMany).toHaveBeenCalled()
  })
})
