import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { updateCollaboratorRights } from '@@/server/utils/collaborator-management'
import { prisma } from '@@/server/utils/prisma'
import { validateConventionId, validateResourceId } from '@@/server/utils/validation-helpers'
import { z } from 'zod'

import type {
  CollaboratorWithPermissions,
  CollaboratorPermissionSnapshot,
} from '@@/server/types/prisma-helpers'

const updateRightsSchema = z.object({
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
  title: z.string().max(100).optional().nullable(),
  perEdition: z
    .array(
      z.object({
        editionId: z.number(),
        canEdit: z.boolean().optional(),
        canDelete: z.boolean().optional(),
        canManageVolunteers: z.boolean().optional(),
      })
    )
    .optional(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const conventionId = validateConventionId(event)
    const organizerId = validateResourceId(event, 'organizerId', 'organisateur')
    const body = await readBody(event)

    // Valider les données
    const { rights, title, perEdition } = updateRightsSchema.parse(body)

    // Empêcher une mise à jour vide (aucun champ fourni)
    if (!rights && (title === undefined || title === null) && !perEdition) {
      throw createError({
        statusCode: 400,
        message: 'Aucune donnée à mettre à jour',
      })
    }

    // Charger l'état avant pour snapshot si on va changer
    const before = await prisma.conventionOrganizer.findUnique({
      where: { id: organizerId },
      select: {
        id: true,
        conventionId: true,
        title: true,
        canEditConvention: true,
        canDeleteConvention: true,
        canManageOrganizers: true,
        canManageVolunteers: true,
        canAddEdition: true,
        canEditAllEditions: true,
        canDeleteAllEditions: true,
      },
    })

    const updatedCollaborator = (await updateCollaboratorRights({
      conventionId,
      organizerId,
      userId: user.id,
      rights,
      title: title ?? undefined,
      perEdition,
    })) as CollaboratorWithPermissions

    if (before && updatedCollaborator) {
      const afterSnapshot: CollaboratorPermissionSnapshot = {
        title: updatedCollaborator.title,
        rights: {
          canEditConvention: updatedCollaborator.canEditConvention,
          canDeleteConvention: updatedCollaborator.canDeleteConvention,
          canManageOrganizers: updatedCollaborator.canManageOrganizers,
          canManageVolunteers: updatedCollaborator.canManageVolunteers,
          canAddEdition: updatedCollaborator.canAddEdition,
          canEditAllEditions: updatedCollaborator.canEditAllEditions,
          canDeleteAllEditions: updatedCollaborator.canDeleteAllEditions,
        },
      }
      const beforeSnapshot: CollaboratorPermissionSnapshot = {
        title: before.title,
        rights: {
          canEditConvention: before.canEditConvention,
          canDeleteConvention: before.canDeleteConvention,
          canManageOrganizers: before.canManageOrganizers,
          canManageVolunteers: before.canManageVolunteers,
          canAddEdition: before.canAddEdition,
          canEditAllEditions: before.canEditAllEditions,
          canDeleteAllEditions: before.canDeleteAllEditions,
        },
      }
      if (JSON.stringify(beforeSnapshot) !== JSON.stringify(afterSnapshot)) {
        const target = await prisma.conventionOrganizer.findUnique({
          where: { id: organizerId },
          select: { userId: true },
        })
        await prisma.organizerPermissionHistory.create({
          data: {
            conventionId,
            targetUserId: target?.userId ?? null,
            actorId: user.id,
            changeType: 'RIGHTS_UPDATED',
            before: beforeSnapshot,
            after: afterSnapshot,
          },
        })
      }
    }

    if (!updatedCollaborator) {
      throw createError({
        statusCode: 500,
        message: 'Échec de la mise à jour du collaborateur',
      })
    }

    return {
      success: true,
      collaborator: {
        id: updatedCollaborator.id,
        title: updatedCollaborator.title,
        rights: {
          editConvention: updatedCollaborator.canEditConvention,
          deleteConvention: updatedCollaborator.canDeleteConvention,
          manageCollaborators: updatedCollaborator.canManageOrganizers,
          manageVolunteers: updatedCollaborator.canManageVolunteers,
          addEdition: updatedCollaborator.canAddEdition,
          editAllEditions: updatedCollaborator.canEditAllEditions,
          deleteAllEditions: updatedCollaborator.canDeleteAllEditions,
        },
        perEdition: (updatedCollaborator.perEditionPermissions || []).map((p) => ({
          editionId: p.editionId,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
          canManageVolunteers: p.canManageVolunteers,
        })),
        user: updatedCollaborator.user,
      },
    }
  },
  { operationName: 'UpdateCollaboratorRights' }
)
