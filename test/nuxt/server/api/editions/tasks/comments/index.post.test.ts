import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())
const mockCanCommentTask = vi.hoisted(() => vi.fn())
const mockTaskAssigned = vi.hoisted(() => vi.fn())
const mockTaskCommented = vi.hoisted(() => vi.fn())
const mockSafeNotify = vi.hoisted(() => vi.fn(async (fn: any) => fn()))

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

vi.mock('#server/utils/notification-service', () => ({
  NotificationHelpers: {
    taskAssigned: mockTaskAssigned,
    taskCommented: mockTaskCommented,
  },
  safeNotify: mockSafeNotify,
}))

import handler from '../../../../../../../server/api/editions/[id]/tasks/[taskId]/comments/index.post'

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
  assignments: [{ userId: 1 }, { userId: 2 }, { userId: 3 }],
}

const baseEvent = {
  context: {
    params: { id: '1', taskId: '5' },
    user: mockUser,
  },
}

describe('POST /api/editions/[id]/tasks/[taskId]/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanCommentTask.mockReturnValue(true)
    mockSafeNotify.mockImplementation(async (fn: any) => fn())
    prismaMock.task.findFirst.mockReset()
    prismaMock.taskComment.create.mockReset()
    prismaMock.task.findFirst.mockResolvedValue(mockTask)
    prismaMock.taskComment.create.mockResolvedValue({
      id: 100,
      taskId: 5,
      userId: 1,
      content: 'Hello',
      editedAt: null,
      createdAt: new Date(),
      user: { id: 1, pseudo: 'testuser', emailHash: 'abc' },
    })
    global.readBody = vi.fn().mockResolvedValue({ content: 'Hello' })
  })

  it('crée un commentaire et notifie les autres assignés', async () => {
    const result = await handler(baseEvent as any)

    expect(result.success).toBe(true)
    expect(result.data.comment.content).toBe('Hello')

    expect(prismaMock.taskComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { taskId: 5, userId: 1, content: 'Hello' },
      })
    )

    // 3 assignés - 1 auteur = 2 notifications
    expect(mockTaskCommented).toHaveBeenCalledTimes(2)
    expect(mockTaskCommented).toHaveBeenCalledWith(2, 'testuser', 'Tâche test', 'Edition Test', 1, 5)
    expect(mockTaskCommented).toHaveBeenCalledWith(3, 'testuser', 'Tâche test', 'Edition Test', 1, 5)
  })

  it("n'envoie pas de notification à l'auteur du commentaire", async () => {
    prismaMock.task.findFirst.mockResolvedValue({
      ...mockTask,
      assignments: [{ userId: 1 }], // seul l'auteur est assigné
    })
    await handler(baseEvent as any)
    expect(mockTaskCommented).not.toHaveBeenCalled()
  })

  it('utilise le nom de la convention si edition.name est null', async () => {
    mockGetEditionWithPermissions.mockResolvedValue({
      ...mockEdition,
      name: null,
    })
    await handler(baseEvent as any)
    expect(mockTaskCommented).toHaveBeenCalledWith(
      2,
      'testuser',
      'Tâche test',
      'Convention',
      1,
      5
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

  it('rejette un contenu vide via Zod', async () => {
    global.readBody = vi.fn().mockResolvedValue({ content: '' })
    await expect(handler(baseEvent as any)).rejects.toThrow()
    expect(prismaMock.taskComment.create).not.toHaveBeenCalled()
  })

  it('rejette un contenu trop long', async () => {
    global.readBody = vi.fn().mockResolvedValue({ content: 'a'.repeat(5001) })
    await expect(handler(baseEvent as any)).rejects.toThrow()
    expect(prismaMock.taskComment.create).not.toHaveBeenCalled()
  })

  it('trim le contenu avant insertion', async () => {
    global.readBody = vi.fn().mockResolvedValue({ content: '  Hello  ' })
    await handler(baseEvent as any)
    expect(prismaMock.taskComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ content: 'Hello' }),
      })
    )
  })
})
