import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock des utilitaires - DOIT être avant les imports
vi.mock('../../../../../server/utils/collaborator-management', () => ({
  canManageCollaborators: vi.fn(),
}))

import { canManageCollaborators } from '../../../../../server/utils/collaborator-management'
import handler from '../../../../../server/api/conventions/[id]/collaborators/[collaboratorId].patch'
import { prismaMock } from '../../../../__mocks__/prisma'

const mockCanManage = canManageCollaborators as ReturnType<typeof vi.fn>

const baseEvent = {
  context: {
    params: { id: '5', collaboratorId: '9' },
    user: { id: 42 },
  },
}

describe('/api/conventions/[id]/collaborators/[collaboratorId]/rights PATCH', () => {
  beforeEach(() => {
    mockCanManage.mockReset()
    prismaMock.conventionCollaborator.findUnique.mockReset()
    prismaMock.conventionCollaborator.update.mockReset()
    prismaMock.editionCollaboratorPermission.deleteMany.mockReset()
    prismaMock.editionCollaboratorPermission.create.mockReset()
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))
    global.readBody = vi.fn()
  })

  const existingCollaborator = {
    id: 9,
    conventionId: 5,
    userId: 77,
    title: 'Ancien titre',
    canEditConvention: false,
    canDeleteConvention: false,
    canManageCollaborators: false,
    canAddEdition: false,
    canEditAllEditions: false,
    canDeleteAllEditions: false,
    perEditionPermissions: [{ editionId: 100, canEdit: true, canDelete: false }],
  }

  it('met à jour droits globaux et crée historique', async () => {
    mockCanManage.mockResolvedValue(true)
    prismaMock.conventionCollaborator.findUnique.mockResolvedValue(existingCollaborator)
    prismaMock.conventionCollaborator.update.mockResolvedValue({
      ...existingCollaborator,
      canEditConvention: true,
    })
    prismaMock.collaboratorPermissionHistory.create.mockResolvedValue({ id: 1 })

    const body = { rights: { editConvention: true } }
    ;(global.readBody as any).mockResolvedValue(body)

    const res = await handler(baseEvent as any)
    expect(res.success).toBe(true)
    expect(prismaMock.conventionCollaborator.update).toHaveBeenCalled()
    expect(prismaMock.collaboratorPermissionHistory.create).toHaveBeenCalled()
    const args = prismaMock.collaboratorPermissionHistory.create.mock.calls[0][0]
    expect(args.data.actorId).toBe(42)
    expect(args.data.targetUserId).toBe(existingCollaborator.userId)
    expect(res.collaborator.rights.editConvention).toBe(true)
  })

  it('met à jour perEdition et log PER_EDITIONS_UPDATED', async () => {
    mockCanManage.mockResolvedValue(true)
    prismaMock.conventionCollaborator.findUnique.mockResolvedValue(existingCollaborator)
    prismaMock.conventionCollaborator.update.mockResolvedValue(existingCollaborator) // pas de changement global
    prismaMock.editionCollaboratorPermission.deleteMany.mockResolvedValue({})
    prismaMock.editionCollaboratorPermission.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...data })
    )
    prismaMock.collaboratorPermissionHistory.create.mockResolvedValue({ id: 2 })

    const body = { perEdition: [{ editionId: 101, canEdit: true, canDelete: true }] }
    ;(global.readBody as any).mockResolvedValue(body)

    const res = await handler(baseEvent as any)
    expect(res.success).toBe(true)
    expect(prismaMock.editionCollaboratorPermission.deleteMany).toHaveBeenCalledWith({
      where: { collaboratorId: 9 },
    })
    expect(prismaMock.editionCollaboratorPermission.create).toHaveBeenCalled()
    expect(prismaMock.collaboratorPermissionHistory.create.mock.calls[0][0].data.changeType).toBe(
      'PER_EDITIONS_UPDATED'
    )
    const args = prismaMock.collaboratorPermissionHistory.create.mock.calls[0][0]
    expect(args.data.actorId).toBe(42)
    expect(args.data.targetUserId).toBe(existingCollaborator.userId)
    expect(res.collaborator.perEdition[0].editionId).toBe(101)
  })

  it('refuse sans permission', async () => {
    mockCanManage.mockResolvedValue(false)
    prismaMock.conventionCollaborator.findUnique.mockResolvedValue(existingCollaborator)
    ;(global.readBody as any).mockResolvedValue({ rights: { editConvention: true } })
    await expect(handler(baseEvent as any)).rejects.toThrow('Permission insuffisante')
  })

  it('404 si collaborateur introuvable', async () => {
    mockCanManage.mockResolvedValue(true)
    prismaMock.conventionCollaborator.findUnique.mockResolvedValue(null)
    ;(global.readBody as any).mockResolvedValue({ rights: { editConvention: true } })
    await expect(handler(baseEvent as any)).rejects.toThrow('Collaborateur introuvable')
  })

  it("ne crée pas d'historique si aucun changement", async () => {
    mockCanManage.mockResolvedValue(true)
    prismaMock.conventionCollaborator.findUnique.mockResolvedValue(existingCollaborator)
    // Pas de body (ou body vide)
    ;(global.readBody as any).mockResolvedValue({})
    prismaMock.collaboratorPermissionHistory.create.mockResolvedValue({ id: 99 })

    const res = await handler(baseEvent as any)
    expect(res.success).toBe(true)
    // Aucune mise à jour DB car aucun champ changé
    expect(prismaMock.conventionCollaborator.update).not.toHaveBeenCalled()
    // Pas d'historique créé
    expect(prismaMock.collaboratorPermissionHistory.create).not.toHaveBeenCalled()
  })

  it('met à jour droits globaux + perEdition ensemble (changeType PER_EDITIONS_UPDATED)', async () => {
    mockCanManage.mockResolvedValue(true)
    prismaMock.conventionCollaborator.findUnique.mockResolvedValue(existingCollaborator)
    // update global + perEdition
    prismaMock.conventionCollaborator.update.mockResolvedValue({
      ...existingCollaborator,
      canDeleteConvention: true,
    })
    prismaMock.editionCollaboratorPermission.deleteMany.mockResolvedValue({})
    prismaMock.editionCollaboratorPermission.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...data })
    )
    prismaMock.collaboratorPermissionHistory.create.mockResolvedValue({ id: 3 })
    ;(global.readBody as any).mockResolvedValue({
      rights: { deleteConvention: true },
      perEdition: [{ editionId: 150, canEdit: true }],
    })

    const res = await handler(baseEvent as any)
    expect(res.success).toBe(true)
    const historyArgs = prismaMock.collaboratorPermissionHistory.create.mock.calls[0][0]
    expect(historyArgs.data.changeType).toBe('PER_EDITIONS_UPDATED') // priorité perEdition
    expect(historyArgs.data.after.rights.canDeleteConvention).toBe(true)
    expect(historyArgs.data.actorId).toBe(42)
    expect(historyArgs.data.targetUserId).toBe(existingCollaborator.userId)
    expect(res.collaborator.rights.deleteConvention).toBe(true)
    expect(res.collaborator.perEdition[0].editionId).toBe(150)
  })
})
