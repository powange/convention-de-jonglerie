import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())
const mockCanManageFAQ = vi.hoisted(() => vi.fn())
const mockOptionalAuth = vi.hoisted(() => vi.fn())
const mockGetFaqVisibility = vi.hoisted(() => vi.fn())
const mockAAccesGestionEdition = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEditionWithPermissions,
  canManageFAQ: mockCanManageFAQ,
}))

vi.mock('#server/utils/auth-utils', () => ({
  optionalAuth: mockOptionalAuth,
}))

vi.mock('#server/utils/permissions/acces-gestion-edition', () => ({
  aAccesGestionEdition: mockAAccesGestionEdition,
}))

// Étape modularisation : la visibilité (faqEnabled/faqPagePublic) vient désormais du port FAQ,
// plus de l'objet Edition. On mocke le port pour piloter ces flags depuis les tests.
vi.mock('#server/faq/ports/registry', () => ({
  useFaqPorts: () => ({ directory: { getFaqVisibility: mockGetFaqVisibility } }),
}))

import handler from '../../../../../../../../layers/faq/server/api/editions/[id]/faq/index.get'

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
    mockCanManageFAQ.mockReturnValue(false)
    mockOptionalAuth.mockReturnValue(null)
    mockGetFaqVisibility.mockResolvedValue({ enabled: true, pagePublic: true })
    mockAAccesGestionEdition.mockResolvedValue(false)
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

  it('retourne toutes les entrées pour un organisateur avec canManageFAQ', async () => {
    mockOptionalAuth.mockReturnValue({ id: 42 })
    mockCanManageFAQ.mockReturnValue(true)
    await handler(baseEvent as any)
    expect(prismaMock.faqEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { editionId: 1 },
      })
    )
  })

  it('force le filtre isPublic même pour un éditeur quand publicOnly=1', async () => {
    mockOptionalAuth.mockReturnValue({ id: 42 })
    mockCanManageFAQ.mockReturnValue(true)
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
    mockCanManageFAQ.mockReturnValue(true)
    mockGetFaqVisibility.mockResolvedValue({ enabled: true, pagePublic: false })
    await handler(baseEvent as any)
    expect(prismaMock.faqEntry.findMany).toHaveBeenCalled()
  })

  /*
   * Le troisième public : celui à qui la barre latérale propose la FAQ sans qu'il détienne
   * `manageFAQ`. Il entrait sur un 404 qui coupait le rendu de la page de gestion.
   */
  describe('accès gestion sans le droit `manageFAQ`', () => {
    beforeEach(() => {
      mockOptionalAuth.mockReturnValue({ id: 77 })
      mockCanManageFAQ.mockReturnValue(false)
      mockAAccesGestionEdition.mockResolvedValue(true)
    })

    it('lit la FAQ bien que la page publique soit désactivée', async () => {
      mockGetFaqVisibility.mockResolvedValue({ enabled: true, pagePublic: false })
      await handler(baseEvent as any)
      expect(mockAAccesGestionEdition).toHaveBeenCalledWith(mockEdition, { id: 77 })
      expect(prismaMock.faqEntry.findMany).toHaveBeenCalled()
    })

    it('ne reçoit pour autant que les entrées publiques', async () => {
      mockGetFaqVisibility.mockResolvedValue({ enabled: true, pagePublic: false })
      await handler(baseEvent as any)
      expect(prismaMock.faqEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { editionId: 1, isPublic: true },
        })
      )
    })

    it('reste refusé quand le module FAQ est éteint : il n’y a rien à montrer à personne', async () => {
      mockGetFaqVisibility.mockResolvedValue({ enabled: false, pagePublic: false })
      await expect(handler(baseEvent as any)).rejects.toThrow('FAQ non disponible')
      expect(mockAAccesGestionEdition).not.toHaveBeenCalled()
      expect(prismaMock.faqEntry.findMany).not.toHaveBeenCalled()
    })

    it("n'est pas interrogé quand la page publique est active : deux requêtes de moins", async () => {
      await handler(baseEvent as any)
      expect(mockAAccesGestionEdition).not.toHaveBeenCalled()
      expect(prismaMock.faqEntry.findMany).toHaveBeenCalled()
    })
  })

  it('refuse celui qui n’a aucun accès à la gestion quand la page publique est désactivée', async () => {
    mockOptionalAuth.mockReturnValue({ id: 99 })
    mockCanManageFAQ.mockReturnValue(false)
    mockAAccesGestionEdition.mockResolvedValue(false)
    mockGetFaqVisibility.mockResolvedValue({ enabled: true, pagePublic: false })
    await expect(handler(baseEvent as any)).rejects.toThrow('FAQ non disponible')
    expect(prismaMock.faqEntry.findMany).not.toHaveBeenCalled()
  })
})
