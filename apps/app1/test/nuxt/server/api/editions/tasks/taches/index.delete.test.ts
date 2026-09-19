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

const prismaMock = (globalThis as any).prisma
const mockUser = { id: 1, pseudo: 'testuser' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}
import handler from '../../../../../../../../../layers/tasks/server/api/editions/[id]/tasks/[taskId]/index.delete'

const evenement = { context: { params: { id: '1', taskId: '5' }, user: mockUser } }

/**
 * Supprimer une tâche emporte ses commentaires, sa checklist et ses assignations.
 *
 * Irréversible, donc : ce qui compte ici est que la suppression n'atteigne jamais une tâche d'une
 * autre convention parce qu'un identifiant a été deviné.
 */
describe('DELETE /api/editions/[id]/tasks/[taskId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageTasks.mockReturnValue(true)
    prismaMock.task.findFirst.mockReset()
    prismaMock.task.delete.mockReset()
    prismaMock.task.findFirst.mockResolvedValue({ id: 5 })
  })

  it('supprime la tâche', async () => {
    await handler(evenement as any)
    expect(prismaMock.task.delete).toHaveBeenCalledWith({ where: { id: 5 } })
  })

  it("cherche la tâche par l'édition, pas par son seul identifiant", async () => {
    await handler(evenement as any)
    expect(JSON.stringify(prismaMock.task.findFirst.mock.calls[0][0].where)).toContain('editionId')
  })

  it('ne supprime rien quand la tâche est introuvable', async () => {
    prismaMock.task.findFirst.mockResolvedValue(null)
    await expect(handler(evenement as any)).rejects.toThrow('Tâche introuvable')
    expect(prismaMock.task.delete).not.toHaveBeenCalled()
  })

  it('ne supprime rien sans le droit de gérer les tâches', async () => {
    mockCanManageTasks.mockReturnValue(false)
    await expect(handler(evenement as any)).rejects.toThrow('Droits insuffisants')
    expect(prismaMock.task.delete).not.toHaveBeenCalled()
  })

  it('rejette un identifiant de tâche invalide', async () => {
    const mauvais = { context: { params: { id: '1', taskId: 'abc' }, user: mockUser } }
    await expect(handler(mauvais as any)).rejects.toThrow('Identifiant de tâche invalide')
  })
})
