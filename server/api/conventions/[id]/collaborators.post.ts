import { z } from 'zod'

import { requireAuth } from '../../../utils/auth-utils'
import {
  addConventionCollaborator,
  findUserByPseudoOrEmail,
} from '../../../utils/collaborator-management'
import { validateConventionId } from '../../../utils/convention-permissions'

const addCollaboratorSchema = z
  .object({
    userIdentifier: z.string().min(1, 'Pseudo ou email requis').optional(),
    userId: z.number().positive().optional(),
    // Droits optionnels (sinon valeurs par défaut côté service)
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
          editionId: z.number().int().positive(),
          canEdit: z.boolean().optional(),
          canDelete: z.boolean().optional(),
          canManageVolunteers: z.boolean().optional(),
        })
      )
      .optional(),
  })
  .refine((data) => data.userIdentifier || data.userId, {
    message: 'userIdentifier ou userId est requis',
  })

export default defineEventHandler(async (event) => {
  try {
    const conventionId = validateConventionId(getRouterParam(event, 'id'))
    const user = requireAuth(event)

    const body = await readBody(event)

    // Valider les données
    const { userIdentifier, userId, rights, title, perEdition } = addCollaboratorSchema.parse(body)

    let userToAdd

    // Si userId est fourni, l'utiliser directement
    if (userId) {
      const { PrismaClient } = await import('@prisma/client')
      const prisma = new PrismaClient()
      userToAdd = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, pseudo: true },
      })

      if (!userToAdd) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Utilisateur introuvable',
        })
      }
    } else if (userIdentifier) {
      // Sinon, rechercher par pseudo ou email (comportement existant)
      userToAdd = await findUserByPseudoOrEmail(userIdentifier)

      if (!userToAdd) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Utilisateur introuvable avec ce pseudo ou cet email',
        })
      }
    } else {
      throw createError({
        statusCode: 400,
        statusMessage: 'userIdentifier ou userId est requis',
      })
    }

    // Empêcher l'utilisateur de s'ajouter lui-même
    if (userToAdd.id === user.id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Vous ne pouvez pas vous ajouter comme collaborateur',
      })
    }

    // Ajouter le collaborateur (la fonction gère les permissions et les vérifications)
    const collaborator = await addConventionCollaborator({
      conventionId,
      userId: userToAdd.id,
      addedById: user.id,
      rights,
      title: title ?? undefined,
      perEdition,
    })

    const anyCollab: any = collaborator as any
    // Structure normalisée (avec sous‑objet rights et tableau perEdition)
    return {
      success: true,
      collaborator: {
        id: collaborator.id,
        title: collaborator.title,
        rights: {
          editConvention: collaborator.canEditConvention,
          deleteConvention: collaborator.canDeleteConvention,
          manageCollaborators: collaborator.canManageCollaborators,
          manageVolunteers: collaborator.canManageVolunteers,
          addEdition: collaborator.canAddEdition,
          editAllEditions: collaborator.canEditAllEditions,
          deleteAllEditions: collaborator.canDeleteAllEditions,
        },
        perEdition: (anyCollab.perEditionPermissions || []).map((p: any) => ({
          editionId: p.editionId,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
          canManageVolunteers: p.canManageVolunteers,
        })),
        user: collaborator.user,
      },
    }
  } catch (error: unknown) {
    const httpError = error as { statusCode?: number; message?: string }
    if (httpError.statusCode) {
      throw error
    }
    console.error("Erreur lors de l'ajout du collaborateur:", error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur',
    })
  }
})
