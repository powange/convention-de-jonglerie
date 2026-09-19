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
vi.mock('#server/utils/validation-schemas', () => ({
  handleValidationError: (e: unknown) => {
    throw e
  },
}))

import handler from '../../../../../../../../../layers/tasks/server/api/editions/[id]/task-groups/[groupId]/index.delete'

const prismaMock = (globalThis as any).prisma
const mockUser = { id: 1, pseudo: 'testuser' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}
const evenement = { context: { params: { id: '1', groupId: '5' }, user: mockUser } }

/**
 * Supprimer un groupe emporte ses tâches en cascade.
 *
 * D'où l'insistance sur les refus : une suppression consentie pour un groupe ne doit jamais
 * atteindre celui d'une autre convention parce qu'un identifiant a été deviné.
 */
describe('DELETE /api/editions/[id]/task-groups/[groupId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageTasks.mockReturnValue(true)
    prismaMock.taskGroup.findFirst.mockReset()
    prismaMock.taskGroup.delete.mockReset()
    prismaMock.taskGroup.findFirst.mockResolvedValue({ id: 5 })
  })

  it('supprime le groupe', async () => {
    await handler(evenement as any)
    expect(prismaMock.taskGroup.delete).toHaveBeenCalledWith({ where: { id: 5 } })
  })

  it("vérifie l'appartenance à l'édition avant de supprimer", async () => {
    await handler(evenement as any)
    expect(prismaMock.taskGroup.findFirst.mock.calls[0][0].where).toMatchObject({
      id: 5,
      editionId: 1,
    })
  })

  it('ne supprime rien quand le groupe est introuvable', async () => {
    prismaMock.taskGroup.findFirst.mockResolvedValue(null)
    await expect(handler(evenement as any)).rejects.toThrow('Groupe introuvable')
    expect(prismaMock.taskGroup.delete).not.toHaveBeenCalled()
  })

  it('ne supprime rien sans le droit de gérer les tâches', async () => {
    mockCanManageTasks.mockReturnValue(false)
    await expect(handler(evenement as any)).rejects.toThrow('Droits insuffisants')
    expect(prismaMock.taskGroup.delete).not.toHaveBeenCalled()
  })
})
