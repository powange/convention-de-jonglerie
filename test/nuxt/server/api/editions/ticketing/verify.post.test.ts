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

// Mock de canAccessEditionData pour contrôler l'accès
const mockCanAccessEditionData = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canAccessEditionData: mockCanAccessEditionData,
}))

// Mock de requireAuth pour simuler un utilisateur authentifié
vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import verifyHandler from '../../../../../../server/api/editions/[id]/ticketing/verify.post'

// Utiliser le mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('POST /api/editions/[id]/ticketing/verify (bénévole)', () => {
  const mockUser = { id: 1, email: 'user@example.com', pseudo: 'testuser' }

  const mockEvent = {
    context: {
      params: { id: '1' },
      user: mockUser,
    },
  }

  const mockApplication = {
    id: 5,
    userId: 42,
    entryValidated: false,
    entryValidatedAt: null,
    entryValidatedBy: null,
    userSnapshotPhone: null,
    user: { prenom: 'Marie', nom: 'Dupont', email: 'marie@example.com', phone: null },
    teamAssignments: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn().mockResolvedValue({ qrCode: 'volunteer-5-tok123' })
    mockCanAccessEditionData.mockResolvedValue(true)

    // Requêtes secondaires de la branche bénévole : vides par défaut
    prismaMock.volunteerAssignment.findMany.mockResolvedValue([])
    prismaMock.editionVolunteerHandoutItem.findMany.mockResolvedValue([])
    prismaMock.volunteerMealSelection.findMany.mockResolvedValue([])
  })

  it("devrait rejeter avec 403 si l'utilisateur n'a pas accès à l'édition", async () => {
    mockCanAccessEditionData.mockResolvedValue(false)

    await expect(verifyHandler(mockEvent as any)).rejects.toThrow(/Droits insuffisants/)
    expect(prismaMock.editionVolunteerApplication.findFirst).not.toHaveBeenCalled()
  })

  it('devrait retourner found:false pour un QR code bénévole invalide', async () => {
    global.readBody = vi.fn().mockResolvedValue({ qrCode: 'volunteer-abc' })

    const result = await verifyHandler(mockEvent as any)

    expect(result.data.found).toBe(false)
    expect(prismaMock.editionVolunteerApplication.findFirst).not.toHaveBeenCalled()
  })

  it('devrait trouver un bénévole accepté via son QR code', async () => {
    prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(mockApplication)

    const result = await verifyHandler(mockEvent as any)

    expect(result.data.found).toBe(true)
    expect(result.data.type).toBe('volunteer')
    expect(result.data.participant.volunteer.id).toBe(5)
    expect(result.data.participant.volunteer.user.firstName).toBe('Marie')
  })

  // Garde-fou de régression : depuis l'abstraction Event (étape 0), les candidatures bénévoles
  // sont rattachées à Event. La vérification DOIT filtrer sur `eventId`, jamais `editionId`.
  it('devrait filtrer la candidature sur eventId (et non editionId)', async () => {
    prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(mockApplication)

    await verifyHandler(mockEvent as any)

    expect(prismaMock.editionVolunteerApplication.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 5,
          eventId: 1,
          status: 'ACCEPTED',
        }),
      })
    )

    const whereArg = prismaMock.editionVolunteerApplication.findFirst.mock.calls[0][0].where
    expect(whereArg).not.toHaveProperty('editionId')
  })
})
