import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())
const mockCanManageTasks = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEditionWithPermissions,
  canManageTasks: mockCanManageTasks,
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../../../../../layers/tasks/server/api/editions/[id]/task-groups/[groupId]/tags/index.get'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'user@test.com', pseudo: 'testuser' }
const mockEdition = {
  id: 1,
  name: 'Edition Test',
  convention: { id: 10, name: 'Convention', authorId: 200, organizers: [] },
  organizerPermissions: [],
}
const mockTags = [
  { id: 7, name: 'urgent', color: '#ff0000', displayOrder: 0 },
  { id: 8, name: 'matériel', color: '#00ff00', displayOrder: 1 },
]

const baseEvent = {
  context: {
    params: { id: '1', groupId: '2' },
    user: mockUser,
  },
}

/**
 * Les tags d'un groupe de tâches.
 *
 * ⚠️ Ce point a longtemps été ouvert à tout compte authentifié : le refus opposé à qui ne gère pas
 * les tâches est donc la raison d'être de ce fichier, pas un cas limite. Un nom de tag dit souvent
 * quelque chose de l'organisation interne, et les identifiants de groupe s'énumèrent.
 */
describe('GET /api/editions/[id]/task-groups/[groupId]/tags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageTasks.mockReturnValue(true)
    prismaMock.taskGroup.findFirst.mockReset()
    prismaMock.taskTag.findMany.mockReset()
    prismaMock.taskGroup.findFirst.mockResolvedValue({ id: 2 })
    prismaMock.taskTag.findMany.mockResolvedValue(mockTags)
  })

  it('retourne les tags du groupe, ordonnés', async () => {
    const result = await handler(baseEvent as any)

    expect(result).toEqual({ success: true, data: { tags: mockTags } })
    expect(prismaMock.taskTag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { taskGroupId: 2 },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      })
    )
  })

  it('refuse un compte qui ne gère pas les tâches de cette édition', async () => {
    mockCanManageTasks.mockReturnValue(false)

    await expect(handler(baseEvent as any)).rejects.toThrow(
      "Vous n'êtes pas autorisé à gérer les tâches de cette édition"
    )
  })

  it('ne lit aucun tag quand le droit manque', async () => {
    // Le refus doit tomber AVANT la requête : sinon les noms de tags auraient déjà quitté la base,
    // et il suffirait d'une erreur de rédaction ultérieure pour qu'ils atteignent la réponse.
    mockCanManageTasks.mockReturnValue(false)

    await expect(handler(baseEvent as any)).rejects.toThrow()
    expect(prismaMock.taskTag.findMany).not.toHaveBeenCalled()
    expect(prismaMock.taskGroup.findFirst).not.toHaveBeenCalled()
  })

  it("rejette si l'édition est introuvable", async () => {
    mockGetEditionWithPermissions.mockResolvedValue(null)

    await expect(handler(baseEvent as any)).rejects.toThrow('Édition non trouvée')
  })

  it("rejette un groupe qui n'appartient pas à l'édition", async () => {
    // La garde contre le passage d'une édition à l'autre par l'identifiant de groupe.
    prismaMock.taskGroup.findFirst.mockResolvedValue(null)

    await expect(handler(baseEvent as any)).rejects.toThrow('Groupe introuvable')
  })

  it('rejette un identifiant de groupe invalide', async () => {
    const badEvent = {
      context: { params: { id: '1', groupId: 'abc' }, user: mockUser },
    }

    await expect(handler(badEvent as any)).rejects.toThrow('Identifiant de groupe invalide')
  })
})
