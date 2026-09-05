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

// Mock du contrôle d'accès. Le nom compte : la recherche s'appuie sur le helper qui admet
// AUSSI les bénévoles en créneau actif de contrôle d'accès. Avec l'ancien helper, réservé aux
// gestionnaires de la billetterie, la personne qui tient l'entrée ne pouvait chercher personne.
const mockCanAccessEditionData = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canAccessEditionDataOrAccessControl: mockCanAccessEditionData,
}))

// Mock de requireAuth pour simuler un utilisateur authentifié
vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import searchHandler from '../../../../../../server/api/editions/[id]/ticketing/search.post'
import { global } from '../../../../globales-nitro'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('POST /api/editions/[id]/ticketing/search', () => {
  const mockUser = { id: 1, email: 'user@example.com', pseudo: 'testuser' }

  const mockEvent = {
    context: {
      params: { id: '1' },
      user: mockUser,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn().mockResolvedValue({ searchTerm: 'dupont' })
    mockCanAccessEditionData.mockResolvedValue(true)

    // Par défaut, toutes les requêtes renvoient des résultats vides
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])
    prismaMock.editionArtist.findMany.mockResolvedValue([])
    prismaMock.editionOrganizer.findMany.mockResolvedValue([])
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([])
    prismaMock.volunteerAssignment.findMany.mockResolvedValue([])
    prismaMock.user.findMany.mockResolvedValue([])
  })

  it("devrait rejeter avec 403 si l'utilisateur n'a pas accès à l'édition", async () => {
    mockCanAccessEditionData.mockResolvedValue(false)

    await expect(searchHandler(mockEvent as any)).rejects.toThrow(/Droits insuffisants/)
    expect(prismaMock.editionVolunteerApplication.findMany).not.toHaveBeenCalled()
  })

  it('devrait retourner des résultats vides quand rien ne correspond', async () => {
    const result = await searchHandler(mockEvent as any)

    expect(result.success).toBe(true)
    expect(result.data.results.total).toBe(0)
    expect(result.data.results.volunteers).toEqual([])
  })

  // Garde-fou de régression : depuis l'abstraction Event (étape 0), les candidatures bénévoles
  // sont rattachées à Event. La recherche DOIT filtrer sur `eventId`, jamais `editionId`.
  it('devrait filtrer les bénévoles sur eventId (et non editionId)', async () => {
    await searchHandler(mockEvent as any)

    expect(prismaMock.editionVolunteerApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventId: 1,
          status: 'ACCEPTED',
        }),
      })
    )

    const whereArg = prismaMock.editionVolunteerApplication.findMany.mock.calls[0][0].where
    expect(whereArg).not.toHaveProperty('editionId')
  })
})
