import { z } from 'zod'

import type {
  OrganizerUpdateInput,
  OrganizerPermissionSnapshot,
} from '#server/types/prisma-helpers'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageOrganizers } from '#server/utils/organizer-management'
import {
  applyConventionRights,
  conventionRightsZodShape,
  editionRightsZodShape,
  readEditionRights,
} from '#server/utils/permissions/rights-shapes'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { validateConventionId, validateResourceId } from '#server/utils/validation-helpers'

// Schéma combiné (droits globaux + perEdition + title)
// Dérivé de la source unique : un droit ajouté y est accepté sans retoucher ce fichier.
const perEditionSchema = z.object({
  editionId: z.number().int().positive(),
  ...editionRightsZodShape(),
})

const payloadSchema = z.object({
  title: z.string().max(120).optional().nullable(),
  rights: z.object(conventionRightsZodShape()).partial().optional(),
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
        canManageArtists: organizer.canManageArtists,
        canManageMeals: organizer.canManageMeals,
        canManageTicketing: organizer.canManageTicketing,
        canManageWorkshops: organizer.canManageWorkshops,
        canManageFAQ: organizer.canManageFAQ,
        canManageTreasury: organizer.canManageTreasury,
        canManageTasks: organizer.canManageTasks,
        canManageStock: organizer.canManageStock,
        canAddEdition: organizer.canAddEdition,
        canEditAllEditions: organizer.canEditAllEditions,
        canDeleteAllEditions: organizer.canDeleteAllEditions,
      },
      perEdition: organizer.perEditionPermissions.map((p) => ({
        editionId: p.editionId,
        canEdit: p.canEdit,
        canDelete: p.canDelete,
        canManageVolunteers: p.canManageVolunteers,
        canManageArtists: p.canManageArtists,
        canManageMeals: p.canManageMeals,
        canManageTicketing: p.canManageTicketing,
        canManageWorkshops: p.canManageWorkshops,
        canManageFAQ: p.canManageFAQ,
        canManageTreasury: p.canManageTreasury,
        canManageTasks: p.canManageTasks,
        canManageStock: p.canManageStock,
      })),
    }

    const updateData: OrganizerUpdateInput = {}
    if (parsed.title !== undefined) updateData.title = parsed.title || null
    if (parsed.rights) {
      // Dérivé de la source unique : chaque droit fourni est recopié, les absents ignorés.
      applyConventionRights(updateData, parsed.rights)
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
                  // Couvre canEdit et canDelete comme les droits métier : la source unique les
                  // liste tous.
                  ...readEditionRights(p),
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
          canManageArtists: updated.canManageArtists,
          canManageMeals: updated.canManageMeals,
          canManageTicketing: updated.canManageTicketing,
          canManageWorkshops: updated.canManageWorkshops,
          canManageFAQ: updated.canManageFAQ,
          canManageTreasury: updated.canManageTreasury,
          canManageTasks: updated.canManageTasks,
          canManageStock: updated.canManageStock,
          canAddEdition: updated.canAddEdition,
          canEditAllEditions: updated.canEditAllEditions,
          canDeleteAllEditions: updated.canDeleteAllEditions,
        },
        perEdition: newPerEdition.map((p) => ({
          editionId: p.editionId,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
          canManageVolunteers: p.canManageVolunteers,
          canManageArtists: p.canManageArtists,
          canManageMeals: p.canManageMeals,
          canManageTicketing: p.canManageTicketing,
          canManageWorkshops: p.canManageWorkshops,
          canManageFAQ: p.canManageFAQ,
          canManageTreasury: p.canManageTreasury,
          canManageTasks: p.canManageTasks,
          canManageStock: p.canManageStock,
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
          manageArtists: result.updated.canManageArtists,
          manageMeals: result.updated.canManageMeals,
          manageTicketing: result.updated.canManageTicketing,
          manageWorkshops: result.updated.canManageWorkshops,
          manageFAQ: result.updated.canManageFAQ,
          manageTreasury: result.updated.canManageTreasury,
          manageTasks: result.updated.canManageTasks,
          manageStock: result.updated.canManageStock,
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
