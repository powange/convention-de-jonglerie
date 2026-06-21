import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())
const mockCanCommentTask = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEditionWithPermissions,
  canManageTasks: vi.fn(),
}))

vi.mock('#server/utils/tasks-helpers', () => ({
  canCommentTask: mockCanCommentTask,
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../../../../../layers/tasks/server/api/editions/[id]/tasks/[taskId]/comments/index.get'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'user@test.com', pseudo: 'testuser' }
const mockEdition = {
  id: 1,
  name: 'Edition Test',
  convention: { id: 10, name: 'Convention', authorId: 200, organizers: [] },
  organizerPermissions: [],
}
const mockTask = {
  id: 5,
  taskGroupId: 2,
  title: 'Tâche test',
  assignments: [{ userId: 1 }],
}
const mockComment = {
  id: 100,
  taskId: 5,
  userId: 1,
  content: 'Hello',
  editedAt: null,
  createdAt: new Date(),
  user: { id: 1, pseudo: 'testuser', emailHash: 'abc', profilePicture: null },
}

const baseEvent = {
  context: {
    params: { id: '1', taskId: '5' },
    user: mockUser,
  },
}

describe('GET /api/editions/[id]/tasks/[taskId]/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanCommentTask.mockReturnValue(true)
    prismaMock.task.findFirst.mockReset()
    prismaMock.taskComment.findMany.mockReset()
    prismaMock.task.findFirst.mockResolvedValue(mockTask)
    prismaMock.taskComment.findMany.mockResolvedValue([mockComment])
  })

  it('retourne la liste des commentaires', async () => {
    const result = await handler(baseEvent as any)
    expect(result).toEqual({ success: true, data: { comments: [mockComment] } })
    expect(prismaMock.taskComment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { taskId: 5 },
        orderBy: { createdAt: 'asc' },
      })
    )
  })

  it("rejette si l'édition est introuvable", async () => {
    mockGetEditionWithPermissions.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Édition non trouvée')
  })

  it('rejette si la tâche est introuvable', async () => {
    prismaMock.task.findFirst.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Tâche introuvable')
  })

  it("rejette si l'utilisateur n'a pas le droit de commenter", async () => {
    mockCanCommentTask.mockReturnValue(false)
    await expect(handler(baseEvent as any)).rejects.toThrow('Droits insuffisants')
  })

  it("rejette si l'identifiant de tâche est invalide", async () => {
    const badEvent = {
      context: { params: { id: '1', taskId: 'abc' }, user: mockUser },
    }
    await expect(handler(badEvent as any)).rejects.toThrow('Identifiant de tâche invalide')
  })

  it('transmet la liste des assignés à canCommentTask', async () => {
    prismaMock.task.findFirst.mockResolvedValue({
      ...mockTask,
      assignments: [{ userId: 1 }, { userId: 2 }, { userId: 3 }],
    })
    await handler(baseEvent as any)
    expect(mockCanCommentTask).toHaveBeenCalledWith(mockEdition, mockUser, [1, 2, 3])
  })
})
