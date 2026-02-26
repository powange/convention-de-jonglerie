import { z } from 'zod'

import type {
  OrganizerUpdateInput,
  OrganizerPermissionSnapshot,
} from '#server/types/prisma-helpers'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageOrganizers } from '#server/utils/organizer-management'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { validateConventionId, validateResourceId } from '#server/utils/validation-helpers'

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
      manageOrganizers: z.boolean().optional(),
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
    const organizerId = validateResourceId(event, 'organizerId', 'organisateur')
    const body = await readBody(event).catch(() => ({}))
    const parsed = payloadSchema.parse(body || {})

    // Pas de payload => rien à faire
    if (!parsed.rights && parsed.title === undefined && !parsed.perEdition)
      return createSuccessResponse({ unchanged: true })

    const canManage = await canManageOrganizers(conventionId, user.id, event)
    if (!canManage) throw createError({ status: 403, message: 'Permission insuffisante' })

    const organizer = await fetchResourceOrFail(prisma.conventionOrganizer, organizerId, {
      errorMessage: 'Organisateur introuvable',
      include: { perEditionPermissions: true },
    })
    if (organizer.conventionId !== conventionId)
      throw createError({ status: 404, message: 'Organisateur introuvable' })

    const beforeSnapshot: OrganizerPermissionSnapshot = {
      title: organizer.title,
      rights: {
        canEditConvention: organizer.canEditConvention,
        canDeleteConvention: organizer.canDeleteConvention,
        canManageOrganizers: organizer.canManageOrganizers,
        canManageVolunteers: organizer.canManageVolunteers,
        canAddEdition: organizer.canAddEdition,
        canEditAllEditions: organizer.canEditAllEditions,
        canDeleteAllEditions: organizer.canDeleteAllEditions,
      },
      perEdition: organizer.perEditionPermissions.map((p) => ({
        editionId: p.editionId,
        canEdit: p.canEdit,
        canDelete: p.canDelete,
        canManageVolunteers: p.canManageVolunteers,
      })),
    }

    const updateData: OrganizerUpdateInput = {}
    if (parsed.title !== undefined) updateData.title = parsed.title || null
    if (parsed.rights) {
      if (parsed.rights.editConvention !== undefined)
        updateData.canEditConvention = parsed.rights.editConvention
      if (parsed.rights.deleteConvention !== undefined)
        updateData.canDeleteConvention = parsed.rights.deleteConvention
      if (parsed.rights.manageOrganizers !== undefined)
        updateData.canManageOrganizers = parsed.rights.manageOrganizers
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
        ? await tx.conventionOrganizer.update({
            where: { id: organizerId },
            data: updateData,
          })
        : organizer

      let newPerEdition = organizer.perEditionPermissions
      if (perEditionInput) {
        await tx.editionOrganizerPermission.deleteMany({ where: { organizerId } })
        if (perEditionInput.length) {
          newPerEdition = await Promise.all(
            perEditionInput.map((p) =>
              tx.editionOrganizerPermission.create({
                data: {
                  organizerId,
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

      const afterSnapshot: OrganizerPermissionSnapshot = {
        title: updated.title,
        rights: {
          canEditConvention: updated.canEditConvention,
          canDeleteConvention: updated.canDeleteConvention,
          canManageOrganizers: updated.canManageOrganizers,
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
        await tx.organizerPermissionHistory.create({
          data: {
            conventionId,
            targetUserId: organizer.userId,
            actorId: user.id,
            changeType: perEditionInput ? 'PER_EDITIONS_UPDATED' : 'RIGHTS_UPDATED',
            before: beforeSnapshot,
            after: afterSnapshot,
          },
        })
      }
      return { updated, perEdition: afterSnapshot.perEdition }
    })

    return createSuccessResponse({
      organizer: {
        id: organizerId,
        title: result.updated.title,
        rights: {
          editConvention: result.updated.canEditConvention,
          deleteConvention: result.updated.canDeleteConvention,
          manageOrganizers: result.updated.canManageOrganizers,
          manageVolunteers: result.updated.canManageVolunteers,
          addEdition: result.updated.canAddEdition,
          editAllEditions: result.updated.canEditAllEditions,
          deleteAllEditions: result.updated.canDeleteAllEditions,
        },
        perEdition: result.perEdition,
      },
    })
  },
  { operationName: 'UpdateOrganizerPermissions' }
)
