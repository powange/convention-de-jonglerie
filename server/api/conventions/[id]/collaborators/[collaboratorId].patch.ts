import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canManageCollaborators } from '@@/server/utils/collaborator-management'
import { prisma } from '@@/server/utils/prisma'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { validateConventionId, validateResourceId } from '@@/server/utils/validation-helpers'
import { z } from 'zod'

import type {
  CollaboratorUpdateInput,
  CollaboratorPermissionSnapshot,
} from '@@/server/types/prisma-helpers'

// Schéma combiné (droits globaux + perEdition + title)
const perEditionSchema = z.object({
  editionId: z.number().int().positive(),
  canEdit: z.boolean().optional(),
  canDelete: z.boolean().optional(),
  canManageVolunteers: z.boolean().optional(),
})

const payloadSchema = z.object({
  title: z.string().max(120).optional().nullable(),
  rights: z
    .object({
      editConvention: z.boolean().optional(),
      deleteConvention: z.boolean().optional(),
      manageCollaborators: z.boolean().optional(),
      manageVolunteers: z.boolean().optional(),
      addEdition: z.boolean().optional(),
      editAllEditions: z.boolean().optional(),
      deleteAllEditions: z.boolean().optional(),
    })
    .partial()
    .optional(),
  perEdition: z.array(perEditionSchema).optional(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const conventionId = validateConventionId(event)
    const collaboratorId = validateResourceId(event, 'collaboratorId', 'collaborateur')
    const body = await readBody(event).catch(() => ({}))
    const parsed = payloadSchema.parse(body || {})

    // Pas de payload => rien à faire
    if (!parsed.rights && parsed.title === undefined && !parsed.perEdition)
      return { success: true, unchanged: true }

    const canManage = await canManageCollaborators(conventionId, user.id, event)
    if (!canManage) throw createError({ statusCode: 403, message: 'Permission insuffisante' })

    const collaborator = await fetchResourceOrFail(prisma.conventionCollaborator, collaboratorId, {
      errorMessage: 'Collaborateur introuvable',
      include: { perEditionPermissions: true },
    })
    if (collaborator.conventionId !== conventionId)
      throw createError({ statusCode: 404, message: 'Collaborateur introuvable' })

    const beforeSnapshot: CollaboratorPermissionSnapshot = {
      title: collaborator.title,
      rights: {
        canEditConvention: collaborator.canEditConvention,
        canDeleteConvention: collaborator.canDeleteConvention,
        canManageCollaborators: collaborator.canManageCollaborators,
        canManageVolunteers: collaborator.canManageVolunteers,
        canAddEdition: collaborator.canAddEdition,
        canEditAllEditions: collaborator.canEditAllEditions,
        canDeleteAllEditions: collaborator.canDeleteAllEditions,
      },
      perEdition: collaborator.perEditionPermissions.map((p) => ({
        editionId: p.editionId,
        canEdit: p.canEdit,
        canDelete: p.canDelete,
        canManageVolunteers: p.canManageVolunteers,
      })),
    }

    const updateData: CollaboratorUpdateInput = {}
    if (parsed.title !== undefined) updateData.title = parsed.title || null
    if (parsed.rights) {
      if (parsed.rights.editConvention !== undefined)
        updateData.canEditConvention = parsed.rights.editConvention
      if (parsed.rights.deleteConvention !== undefined)
        updateData.canDeleteConvention = parsed.rights.deleteConvention
      if (parsed.rights.manageCollaborators !== undefined)
        updateData.canManageCollaborators = parsed.rights.manageCollaborators
      if (parsed.rights.manageVolunteers !== undefined)
        updateData.canManageVolunteers = parsed.rights.manageVolunteers
      if (parsed.rights.addEdition !== undefined)
        updateData.canAddEdition = parsed.rights.addEdition
      if (parsed.rights.editAllEditions !== undefined)
        updateData.canEditAllEditions = parsed.rights.editAllEditions
      if (parsed.rights.deleteAllEditions !== undefined)
        updateData.canDeleteAllEditions = parsed.rights.deleteAllEditions
    }
    const perEditionInput = parsed.perEdition || null

    const result = await prisma.$transaction(async (tx) => {
      const updated = Object.keys(updateData).length
        ? await tx.conventionCollaborator.update({
            where: { id: collaboratorId },
            data: updateData,
          })
        : collaborator

      let newPerEdition = collaborator.perEditionPermissions
      if (perEditionInput) {
        await tx.editionCollaboratorPermission.deleteMany({ where: { collaboratorId } })
        if (perEditionInput.length) {
          newPerEdition = await Promise.all(
            perEditionInput.map((p) =>
              tx.editionCollaboratorPermission.create({
                data: {
                  collaboratorId,
                  editionId: p.editionId,
                  canEdit: !!p.canEdit,
                  canDelete: !!p.canDelete,
                  canManageVolunteers: !!p.canManageVolunteers,
                },
              })
            )
          )
        } else newPerEdition = []
      }

      const afterSnapshot: CollaboratorPermissionSnapshot = {
        title: updated.title,
        rights: {
          canEditConvention: updated.canEditConvention,
          canDeleteConvention: updated.canDeleteConvention,
          canManageCollaborators: updated.canManageCollaborators,
          canManageVolunteers: updated.canManageVolunteers,
          canAddEdition: updated.canAddEdition,
          canEditAllEditions: updated.canEditAllEditions,
          canDeleteAllEditions: updated.canDeleteAllEditions,
        },
        perEdition: newPerEdition.map((p) => ({
          editionId: p.editionId,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
          canManageVolunteers: p.canManageVolunteers,
        })),
      }

      if (JSON.stringify(beforeSnapshot) !== JSON.stringify(afterSnapshot)) {
        await tx.collaboratorPermissionHistory.create({
          data: {
            conventionId,
            targetUserId: collaborator.userId,
            actorId: user.id,
            changeType: perEditionInput ? 'PER_EDITIONS_UPDATED' : 'RIGHTS_UPDATED',
            before: beforeSnapshot,
            after: afterSnapshot,
          },
        })
      }
      return { updated, perEdition: afterSnapshot.perEdition }
    })

    return {
      success: true,
      collaborator: {
        id: collaboratorId,
        title: result.updated.title,
        rights: {
          editConvention: result.updated.canEditConvention,
          deleteConvention: result.updated.canDeleteConvention,
          manageCollaborators: result.updated.canManageCollaborators,
          manageVolunteers: result.updated.canManageVolunteers,
          addEdition: result.updated.canAddEdition,
          editAllEditions: result.updated.canEditAllEditions,
          deleteAllEditions: result.updated.canDeleteAllEditions,
        },
        perEdition: result.perEdition,
      },
    }
  },
  { operationName: 'UpdateCollaboratorPermissions' }
)
