import { z } from 'zod'

import type {
  OrganizerWithPermissions,
  OrganizerPermissionSnapshot,
} from '#server/types/prisma-helpers'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { updateOrganizerRights } from '#server/utils/organizer-management'
import {
  conventionRightsZodShape,
  editionRightsZodShape,
} from '#server/utils/permissions/rights-shapes'
import { validateConventionId, validateResourceId } from '#server/utils/validation-helpers'

const updateRightsSchema = z.object({
  rights: z.object(conventionRightsZodShape()).partial().optional(),
  title: z.string().max(100).optional().nullable(),
  // Dérivés de la source unique : un droit ajouté y est accepté sans retoucher ce fichier.
  perEdition: z.array(z.object({ editionId: z.number(), ...editionRightsZodShape() })).optional(),
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
        status: 400,
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
        canManageArtists: true,
        canManageMeals: true,
        canManageTicketing: true,
        canManageWorkshops: true,
        canManageFAQ: true,
        canManageTreasury: true,
        canManageTasks: true,
        canManageStock: true,
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
          canManageArtists: updatedOrganizer.canManageArtists,
          canManageMeals: updatedOrganizer.canManageMeals,
          canManageTicketing: updatedOrganizer.canManageTicketing,
          canManageWorkshops: updatedOrganizer.canManageWorkshops,
          canManageFAQ: updatedOrganizer.canManageFAQ,
          canManageTreasury: updatedOrganizer.canManageTreasury,
          canManageTasks: updatedOrganizer.canManageTasks,
          canManageStock: updatedOrganizer.canManageStock,
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
          canManageArtists: before.canManageArtists,
          canManageMeals: before.canManageMeals,
          canManageTicketing: before.canManageTicketing,
          canManageWorkshops: before.canManageWorkshops,
          canManageFAQ: before.canManageFAQ,
          canManageTreasury: before.canManageTreasury,
          canManageTasks: before.canManageTasks,
          canManageStock: before.canManageStock,
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
        status: 500,
        message: 'Échec de la mise à jour du organisateur',
      })
    }

    return createSuccessResponse({
      organizer: {
        id: updatedOrganizer.id,
        title: updatedOrganizer.title,
        rights: {
          editConvention: updatedOrganizer.canEditConvention,
          deleteConvention: updatedOrganizer.canDeleteConvention,
          manageOrganizers: updatedOrganizer.canManageOrganizers,
          manageVolunteers: updatedOrganizer.canManageVolunteers,
          manageArtists: updatedOrganizer.canManageArtists,
          manageMeals: updatedOrganizer.canManageMeals,
          manageTicketing: updatedOrganizer.canManageTicketing,
          manageWorkshops: updatedOrganizer.canManageWorkshops,
          manageFAQ: updatedOrganizer.canManageFAQ,
          manageTreasury: updatedOrganizer.canManageTreasury,
          manageTasks: updatedOrganizer.canManageTasks,
          manageStock: updatedOrganizer.canManageStock,
          addEdition: updatedOrganizer.canAddEdition,
          editAllEditions: updatedOrganizer.canEditAllEditions,
          deleteAllEditions: updatedOrganizer.canDeleteAllEditions,
        },
        perEdition: (updatedOrganizer.perEditionPermissions || []).map((p) => ({
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
        user: updatedOrganizer.user,
      },
    })
  },
  { operationName: 'UpdateOrganizerRights' }
)
