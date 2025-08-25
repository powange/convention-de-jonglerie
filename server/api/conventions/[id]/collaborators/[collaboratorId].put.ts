import { z } from 'zod'

import { updateCollaboratorRights } from '../../../../utils/collaborator-management'
import { prisma } from '../../../../utils/prisma'

const updateRightsSchema = z.object({
  rights: z
    .object({
      editConvention: z.boolean().optional(),
      deleteConvention: z.boolean().optional(),
      manageCollaborators: z.boolean().optional(),
      addEdition: z.boolean().optional(),
      editAllEditions: z.boolean().optional(),
      deleteAllEditions: z.boolean().optional(),
    })
    .partial()
    .optional(),
  title: z.string().max(100).optional().nullable(),
})

export default defineEventHandler(async (event) => {
  try {
    const conventionId = parseInt(getRouterParam(event, 'id') as string)
    const collaboratorId = parseInt(getRouterParam(event, 'collaboratorId') as string)
    const body = await readBody(event)

    // Valider les données
    const { rights, title } = updateRightsSchema.parse(body)

    // Empêcher une mise à jour vide (aucun champ fourni)
    if (!rights && (title === undefined || title === null)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Aucune donnée à mettre à jour',
      })
    }

    // Vérifier l'authentification (le middleware s'en charge déjà)
    if (!event.context.user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Non authentifié',
      })
    }

    // Charger l'état avant pour snapshot si on va changer
    const before = await prisma.conventionCollaborator.findUnique({
      where: { id: collaboratorId },
      select: {
        id: true,
        conventionId: true,
        title: true,
        canEditConvention: true,
        canDeleteConvention: true,
        canManageCollaborators: true,
        canAddEdition: true,
        canEditAllEditions: true,
        canDeleteAllEditions: true,
      },
    })

    const updatedCollaborator = await updateCollaboratorRights({
      conventionId,
      collaboratorId,
      userId: event.context.user.id,
      rights,
      title: title ?? undefined,
    })

    if (before) {
      const afterSnapshot = {
        title: updatedCollaborator.title,
        rights: {
          canEditConvention: (updatedCollaborator as any).canEditConvention,
          canDeleteConvention: (updatedCollaborator as any).canDeleteConvention,
          canManageCollaborators: (updatedCollaborator as any).canManageCollaborators,
          canAddEdition: (updatedCollaborator as any).canAddEdition,
          canEditAllEditions: (updatedCollaborator as any).canEditAllEditions,
          canDeleteAllEditions: (updatedCollaborator as any).canDeleteAllEditions,
        },
      }
      const beforeSnapshot = {
        title: before.title,
        rights: {
          canEditConvention: before.canEditConvention,
          canDeleteConvention: before.canDeleteConvention,
          canManageCollaborators: before.canManageCollaborators,
          canAddEdition: before.canAddEdition,
          canEditAllEditions: before.canEditAllEditions,
          canDeleteAllEditions: before.canDeleteAllEditions,
        },
      }
      if (JSON.stringify(beforeSnapshot) !== JSON.stringify(afterSnapshot)) {
        await prisma.collaboratorPermissionHistory.create({
          data: {
            conventionId,
            collaboratorId,
            actorId: event.context.user.id,
            changeType: 'RIGHTS_UPDATED',
            before: beforeSnapshot as any,
            after: afterSnapshot as any,
          },
        })
      }
    }

    const anyCollab: any = updatedCollaborator as any
    return {
      success: true,
      collaborator: {
        id: anyCollab.id,
        title: anyCollab.title,
        rights: {
          editConvention: anyCollab.canEditConvention,
          deleteConvention: anyCollab.canDeleteConvention,
          manageCollaborators: anyCollab.canManageCollaborators,
          addEdition: anyCollab.canAddEdition,
          editAllEditions: anyCollab.canEditAllEditions,
          deleteAllEditions: anyCollab.canDeleteAllEditions,
        },
        perEdition: (anyCollab.perEditionPermissions || []).map((p: any) => ({
          editionId: p.editionId,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
        })),
        user: anyCollab.user,
      },
    }
  } catch (error: unknown) {
    const httpError = error as { statusCode?: number; message?: string }
    if (httpError.statusCode) {
      throw error
    }
    console.error('Erreur lors de la mise à jour du rôle:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur',
    })
  }
})
