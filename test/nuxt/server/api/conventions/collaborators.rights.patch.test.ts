import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock des utilitaires - DOIT être avant les imports
vi.mock('../../../../../server/utils/organizer-management', () => ({
  canManageOrganizers: vi.fn(),
}))

import { canManageOrganizers } from '@@/server/utils/organizer-management'
import handler from '../../../../../server/api/conventions/[id]/collaborators/[organizerId].patch'
import { prismaMock } from '../../../../__mocks__/prisma'

const mockCanManage = canManageOrganizers as ReturnType<typeof vi.fn>

const baseEvent = {
  context: {
    params: { id: '5', organizerId: '9' },
    user: { id: 42 },
  },
}

describe('/api/conventions/[id]/collaborators/[organizerId]/rights PATCH', () => {
  beforeEach(() => {
    mockCanManage.mockReset()
    prismaMock.conventionOrganizer.findUnique.mockReset()
    prismaMock.conventionOrganizer.update.mockReset()
    prismaMock.editionOrganizerPermission.deleteMany.mockReset()
    prismaMock.editionOrganizerPermission.create.mockReset()
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
    canManageOrganizers: false,
    canAddEdition: false,
    canEditAllEditions: false,
    canDeleteAllEditions: false,
    perEditionPermissions: [{ editionId: 100, canEdit: true, canDelete: false }],
  }

  it('met à jour droits globaux et crée historique', async () => {
    mockCanManage.mockResolvedValue(true)
    prismaMock.conventionOrganizer.findUnique.mockResolvedValue(existingCollaborator)
    prismaMock.conventionOrganizer.update.mockResolvedValue({
      ...existingCollaborator,
      canEditConvention: true,
    })
    prismaMock.organizerPermissionHistory.create.mockResolvedValue({ id: 1 })

    const body = { rights: { editConvention: true } }
    ;(global.readBody as any).mockResolvedValue(body)

    const res = await handler(baseEvent as any)
    expect(res.success).toBe(true)
    expect(prismaMock.conventionOrganizer.update).toHaveBeenCalled()
    expect(prismaMock.organizerPermissionHistory.create).toHaveBeenCalled()
    const args = prismaMock.organizerPermissionHistory.create.mock.calls[0][0]
    expect(args.data.actorId).toBe(42)
    expect(args.data.targetUserId).toBe(existingCollaborator.userId)
    expect(res.collaborator.rights.editConvention).toBe(true)
  })

  it('met à jour perEdition et log PER_EDITIONS_UPDATED', async () => {
    mockCanManage.mockResolvedValue(true)
    prismaMock.conventionOrganizer.findUnique.mockResolvedValue(existingCollaborator)
    prismaMock.conventionOrganizer.update.mockResolvedValue(existingCollaborator) // pas de changement global
    prismaMock.editionOrganizerPermission.deleteMany.mockResolvedValue({})
    prismaMock.editionOrganizerPermission.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...data })
    )
    prismaMock.organizerPermissionHistory.create.mockResolvedValue({ id: 2 })

    const body = { perEdition: [{ editionId: 101, canEdit: true, canDelete: true }] }
    ;(global.readBody as any).mockResolvedValue(body)

    const res = await handler(baseEvent as any)
    expect(res.success).toBe(true)
    expect(prismaMock.editionOrganizerPermission.deleteMany).toHaveBeenCalledWith({
      where: { organizerId: 9 },
    })
    expect(prismaMock.editionOrganizerPermission.create).toHaveBeenCalled()
    expect(prismaMock.organizerPermissionHistory.create.mock.calls[0][0].data.changeType).toBe(
      'PER_EDITIONS_UPDATED'
    )
    const args = prismaMock.organizerPermissionHistory.create.mock.calls[0][0]
    expect(args.data.actorId).toBe(42)
    expect(args.data.targetUserId).toBe(existingCollaborator.userId)
    expect(res.collaborator.perEdition[0].editionId).toBe(101)
  })

  it('refuse sans permission', async () => {
    mockCanManage.mockResolvedValue(false)
    prismaMock.conventionOrganizer.findUnique.mockResolvedValue(existingCollaborator)
    ;(global.readBody as any).mockResolvedValue({ rights: { editConvention: true } })
    await expect(handler(baseEvent as any)).rejects.toThrow('Permission insuffisante')
  })

  it('404 si collaborateur introuvable', async () => {
    mockCanManage.mockResolvedValue(true)
    prismaMock.conventionOrganizer.findUnique.mockResolvedValue(null)
    ;(global.readBody as any).mockResolvedValue({ rights: { editConvention: true } })
    await expect(handler(baseEvent as any)).rejects.toThrow('Organisateur introuvable')
  })

  it("ne crée pas d'historique si aucun changement", async () => {
    mockCanManage.mockResolvedValue(true)
    prismaMock.conventionOrganizer.findUnique.mockResolvedValue(existingCollaborator)
    // Pas de body (ou body vide)
    ;(global.readBody as any).mockResolvedValue({})
    prismaMock.organizerPermissionHistory.create.mockResolvedValue({ id: 99 })

    const res = await handler(baseEvent as any)
    expect(res.success).toBe(true)
    // Aucune mise à jour DB car aucun champ changé
    expect(prismaMock.conventionOrganizer.update).not.toHaveBeenCalled()
    // Pas d'historique créé
    expect(prismaMock.organizerPermissionHistory.create).not.toHaveBeenCalled()
  })

  it('met à jour droits globaux + perEdition ensemble (changeType PER_EDITIONS_UPDATED)', async () => {
    mockCanManage.mockResolvedValue(true)
    prismaMock.conventionOrganizer.findUnique.mockResolvedValue(existingCollaborator)
    // update global + perEdition
    prismaMock.conventionOrganizer.update.mockResolvedValue({
      ...existingCollaborator,
      canDeleteConvention: true,
    })
    prismaMock.editionOrganizerPermission.deleteMany.mockResolvedValue({})
    prismaMock.editionOrganizerPermission.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...data })
    )
    prismaMock.organizerPermissionHistory.create.mockResolvedValue({ id: 3 })
    ;(global.readBody as any).mockResolvedValue({
      rights: { deleteConvention: true },
      perEdition: [{ editionId: 150, canEdit: true }],
    })

    const res = await handler(baseEvent as any)
    expect(res.success).toBe(true)
    const historyArgs = prismaMock.organizerPermissionHistory.create.mock.calls[0][0]
    expect(historyArgs.data.changeType).toBe('PER_EDITIONS_UPDATED') // priorité perEdition
    expect(historyArgs.data.after.rights.canDeleteConvention).toBe(true)
    expect(historyArgs.data.actorId).toBe(42)
    expect(historyArgs.data.targetUserId).toBe(existingCollaborator.userId)
    expect(res.collaborator.rights.deleteConvention).toBe(true)
    expect(res.collaborator.perEdition[0].editionId).toBe(150)
  })
})
