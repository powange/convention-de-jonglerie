import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import {
  addConventionOrganizer,
  checkAdminMode,
  findUserByPseudoOrEmail,
} from '@@/server/utils/organizer-management'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { userBasicSelect } from '@@/server/utils/prisma-select-helpers'
import { validateConventionId } from '@@/server/utils/validation-helpers'
import { z } from 'zod'

const addOrganizerschema = z
  .object({
    userIdentifier: z.string().min(1, 'Pseudo ou email requis').optional(),
    userId: z.number().positive().optional(),
    // Droits optionnels (sinon valeurs par défaut côté service)
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

export default wrapApiHandler(
  async (event) => {
    const conventionId = validateConventionId(event)
    const user = requireAuth(event)

    const body = await readBody(event)

    // Valider les données
    const { userIdentifier, userId, rights, title, perEdition } = addOrganizerschema.parse(body)

    let userToAdd

    // Si userId est fourni, l'utiliser directement
    if (userId) {
      const { PrismaClient } = await import('@prisma/client')
      const prisma = new PrismaClient()
      userToAdd = await fetchResourceOrFail(prisma.user, userId, {
        errorMessage: 'Utilisateur introuvable',
        select: userBasicSelect,
      })
    } else if (userIdentifier) {
      // Sinon, rechercher par pseudo ou email (comportement existant)
      userToAdd = await findUserByPseudoOrEmail(userIdentifier)

      if (!userToAdd) {
        throw createError({
          statusCode: 404,
          message: 'Utilisateur introuvable avec ce pseudo ou cet email',
        })
      }
    } else {
      throw createError({
        statusCode: 400,
        message: 'userIdentifier ou userId est requis',
      })
    }

    // Empêcher l'utilisateur de s'ajouter lui-même (sauf en mode admin)
    const isAdminMode = await checkAdminMode(user.id, event)
    if (userToAdd.id === user.id && !isAdminMode) {
      throw createError({
        statusCode: 400,
        message: 'Vous ne pouvez pas vous ajouter comme organisateur',
      })
    }

    // Ajouter le organisateur (la fonction gère les permissions et les vérifications)
    const organizer = await addConventionOrganizer({
      conventionId,
      userId: userToAdd.id,
      addedById: user.id,
      event,
      rights,
      title: title ?? undefined,
      perEdition,
    })

    // Structure normalisée (avec sous‑objet rights et tableau perEdition)
    const collabWithPermissions = organizer as typeof organizer & {
      perEditionPermissions?: Array<{
        editionId: number
        canEdit: boolean
        canDelete: boolean
        canManageVolunteers: boolean
      }>
    }

    return {
      success: true,
      organizer: {
        id: organizer.id,
        title: organizer.title,
        rights: {
          editConvention: organizer.canEditConvention,
          deleteConvention: organizer.canDeleteConvention,
          manageOrganizers: organizer.canManageOrganizers,
          manageVolunteers: organizer.canManageVolunteers,
          addEdition: organizer.canAddEdition,
          editAllEditions: organizer.canEditAllEditions,
          deleteAllEditions: organizer.canDeleteAllEditions,
        },
        perEdition: (collabWithPermissions.perEditionPermissions || []).map((p) => ({
          editionId: p.editionId,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
          canManageVolunteers: p.canManageVolunteers,
        })),
        user: organizer.user,
      },
    }
  },
  { operationName: 'AddConventionOrganizer' }
)
