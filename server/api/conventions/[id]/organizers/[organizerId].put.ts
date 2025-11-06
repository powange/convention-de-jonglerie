import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { updateOrganizerRights } from '@@/server/utils/organizer-management'
import { prisma } from '@@/server/utils/prisma'
import { validateConventionId, validateResourceId } from '@@/server/utils/validation-helpers'
import { z } from 'zod'

import type {
  OrganizerWithPermissions,
  OrganizerPermissionSnapshot,
} from '@@/server/types/prisma-helpers'

const updateRightsSchema = z.object({
  rights: z
    .object({
      editConvention: z.boolean().optional(),
      deleteConvention: z.boolean().optional(),
      manageOrganizers: z.boolean().optional(),
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

    const updatedOrganizer = (await updateOrganizerRights({
      conventionId,
      organizerId,
      userId: user.id,
      rights,
      title: title ?? undefined,
      perEdition,
    })) as OrganizerWithPermissions

    if (before && updatedOrganizer) {
      const afterSnapshot: OrganizerPermissionSnapshot = {
        title: updatedOrganizer.title,
        rights: {
          canEditConvention: updatedOrganizer.canEditConvention,
          canDeleteConvention: updatedOrganizer.canDeleteConvention,
          canManageOrganizers: updatedOrganizer.canManageOrganizers,
          canManageVolunteers: updatedOrganizer.canManageVolunteers,
          canAddEdition: updatedOrganizer.canAddEdition,
          canEditAllEditions: updatedOrganizer.canEditAllEditions,
          canDeleteAllEditions: updatedOrganizer.canDeleteAllEditions,
        },
      }
      const beforeSnapshot: OrganizerPermissionSnapshot = {
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

    if (!updatedOrganizer) {
      throw createError({
        statusCode: 500,
        message: 'Échec de la mise à jour du organisateur',
      })
    }

    return {
      success: true,
      organizer: {
        id: updatedOrganizer.id,
        title: updatedOrganizer.title,
        rights: {
          editConvention: updatedOrganizer.canEditConvention,
          deleteConvention: updatedOrganizer.canDeleteConvention,
          manageOrganizers: updatedOrganizer.canManageOrganizers,
          manageVolunteers: updatedOrganizer.canManageVolunteers,
          addEdition: updatedOrganizer.canAddEdition,
          editAllEditions: updatedOrganizer.canEditAllEditions,
          deleteAllEditions: updatedOrganizer.canDeleteAllEditions,
        },
        perEdition: (updatedOrganizer.perEditionPermissions || []).map((p) => ({
          editionId: p.editionId,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
          canManageVolunteers: p.canManageVolunteers,
        })),
        user: updatedOrganizer.user,
      },
    }
  },
  { operationName: 'UpdateOrganizerRights' }
)
