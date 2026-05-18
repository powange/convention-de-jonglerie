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

import handler from '../../../../../../../server/api/editions/[id]/tasks/[taskId]/comments/[commentId].delete'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'user@test.com', pseudo: 'testuser' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}

const baseEvent = {
  context: {
    params: { id: '1', taskId: '5', commentId: '100' },
    user: mockUser,
  },
}

describe('DELETE /api/editions/[id]/tasks/[taskId]/comments/[commentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageTasks.mockReturnValue(false)
    prismaMock.taskComment.findFirst.mockReset()
    prismaMock.taskComment.delete.mockReset()
    prismaMock.taskComment.delete.mockResolvedValue({ id: 100 })
  })

  it("permet à l'auteur de supprimer son propre commentaire", async () => {
    prismaMock.taskComment.findFirst.mockResolvedValue({ userId: 1 })
    const result = await handler(baseEvent as any)
    expect(result).toEqual({ success: true, data: { success: true } })
    expect(prismaMock.taskComment.delete).toHaveBeenCalledWith({ where: { id: 100 } })
  })

  it("permet à un modérateur (canManageTasks) de supprimer le commentaire d'autrui", async () => {
    prismaMock.taskComment.findFirst.mockResolvedValue({ userId: 999 })
    mockCanManageTasks.mockReturnValue(true)
    await handler(baseEvent as any)
    expect(prismaMock.taskComment.delete).toHaveBeenCalledWith({ where: { id: 100 } })
  })

  it("rejette si l'utilisateur n'est ni l'auteur ni un modérateur", async () => {
    prismaMock.taskComment.findFirst.mockResolvedValue({ userId: 999 })
    mockCanManageTasks.mockReturnValue(false)
    await expect(handler(baseEvent as any)).rejects.toThrow('Droits insuffisants')
    expect(prismaMock.taskComment.delete).not.toHaveBeenCalled()
  })

  it("rejette si l'édition est introuvable", async () => {
    mockGetEditionWithPermissions.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Édition non trouvée')
  })

  it('rejette si le commentaire est introuvable', async () => {
    prismaMock.taskComment.findFirst.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Commentaire introuvable')
  })

  it('rejette un identifiant invalide', async () => {
    const badEvent = {
      context: { params: { id: '1', taskId: 'abc', commentId: '100' }, user: mockUser },
    }
    await expect(handler(badEvent as any)).rejects.toThrow('Identifiant invalide')
  })

  it('vérifie le scope édition + tâche du commentaire', async () => {
    prismaMock.taskComment.findFirst.mockResolvedValue({ userId: 1 })
    await handler(baseEvent as any)
    expect(prismaMock.taskComment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 100, taskId: 5, task: { group: { editionId: 1 } } },
      })
    )
  })
})
