import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canEditEdition } from '#server/utils/permissions/edition-permissions'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

const showSchema = z.object({
  title: z.string().min(1, 'Le titre est requis'),
  description: z.string().optional().nullable(),
  startDateTime: z.string().datetime(),
  duration: z.number().int().positive().optional().nullable(),
  location: z.string().optional().nullable(),
  artistIds: z.array(z.number().int().positive()).optional().default([]),
  returnableItemIds: z.array(z.number().int().positive()).optional().default([]),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const edition = await fetchResourceOrFail(prisma.edition, editionId, {
      include: {
        convention: {
          include: {
            organizers: true,
          },
        },
        organizerPermissions: {
          include: {
            organizer: true,
          },
        },
      },
      errorMessage: 'Édition non trouvée',
    })

    const hasPermission = canEditEdition(edition, user)
    if (!hasPermission) {
      throw createError({
        status: 403,
        message: "Vous n'êtes pas autorisé à gérer les spectacles de cette édition",
      })
    }

    const body = await readBody(event)
    const validatedData = showSchema.parse(body)

    // Créer le spectacle
    const show = await prisma.show.create({
      data: {
        editionId,
        title: validatedData.title,
        description: validatedData.description,
        startDateTime: new Date(validatedData.startDateTime),
        duration: validatedData.duration,
        location: validatedData.location,
        artists: {
          create: validatedData.artistIds.map((artistId) => ({
            artistId,
          })),
        },
        returnableItems: {
          create: validatedData.returnableItemIds.map((returnableItemId) => ({
            returnableItemId,
          })),
        },
      },
      include: {
        artists: {
          include: {
            artist: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    prenom: true,
                    nom: true,
                  },
                },
              },
            },
          },
        },
        returnableItems: {
          include: {
            returnableItem: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    return {
      success: true,
      show,
    }
  },
  { operationName: 'CreateShow' }
)
