import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEditionWithPermissions,
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../../../layers/tasks/server/api/editions/[id]/tasks/[taskId]/comments/[commentId].put'

const prismaMock = (globalThis as any).prisma

const mockUser = { id: 1, email: 'user@test.com', pseudo: 'testuser' }
const mockEdition = {
  id: 1,
  convention: { id: 10, authorId: 200, organizers: [] },
  organizerPermissions: [],
}
const mockComment = { userId: 1 }
const mockUpdated = {
  id: 100,
  taskId: 5,
  userId: 1,
  content: 'Updated',
  editedAt: new Date(),
  createdAt: new Date(),
  user: { id: 1, pseudo: 'testuser', emailHash: 'abc' },
}

const baseEvent = {
  context: {
    params: { id: '1', taskId: '5', commentId: '100' },
    user: mockUser,
  },
}

describe('PUT /api/editions/[id]/tasks/[taskId]/comments/[commentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    prismaMock.taskComment.findFirst.mockReset()
    prismaMock.taskComment.update.mockReset()
    prismaMock.taskComment.findFirst.mockResolvedValue(mockComment)
    prismaMock.taskComment.update.mockResolvedValue(mockUpdated)
    global.readBody = vi.fn().mockResolvedValue({ content: 'Updated' })
  })

  it('met à jour le commentaire et fixe editedAt', async () => {
    const result = await handler(baseEvent as any)
    expect(result.success).toBe(true)
    expect(result.data.comment.content).toBe('Updated')
    expect(prismaMock.taskComment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 100 },
        data: expect.objectContaining({
          content: 'Updated',
          editedAt: expect.any(Date),
        }),
      })
    )
  })

  it("rejette si l'utilisateur n'est pas l'auteur", async () => {
    prismaMock.taskComment.findFirst.mockResolvedValue({ userId: 999 })
    await expect(handler(baseEvent as any)).rejects.toThrow(
      'Vous ne pouvez éditer que vos propres commentaires'
    )
    expect(prismaMock.taskComment.update).not.toHaveBeenCalled()
  })

  it("rejette si l'édition est introuvable", async () => {
    mockGetEditionWithPermissions.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Édition non trouvée')
  })

  it('rejette si le commentaire est introuvable', async () => {
    prismaMock.taskComment.findFirst.mockResolvedValue(null)
    await expect(handler(baseEvent as any)).rejects.toThrow('Commentaire introuvable')
  })

  it('rejette un contenu vide', async () => {
    global.readBody = vi.fn().mockResolvedValue({ content: '' })
    await expect(handler(baseEvent as any)).rejects.toThrow()
    expect(prismaMock.taskComment.update).not.toHaveBeenCalled()
  })

  it('rejette un identifiant de commentaire invalide', async () => {
    const badEvent = {
      context: { params: { id: '1', taskId: '5', commentId: 'abc' }, user: mockUser },
    }
    await expect(handler(badEvent as any)).rejects.toThrow('Identifiant invalide')
  })

  it("vérifie que le commentaire appartient bien à la tâche et à l'édition", async () => {
    await handler(baseEvent as any)
    expect(prismaMock.taskComment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 100, taskId: 5, task: { group: { editionId: 1 } } },
      })
    )
  })
})
