import { requireAuth } from '@@/server/utils/auth-utils'
import { canEditEdition } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const showSchema = z.object({
  title: z.string().min(1, 'Le titre est requis'),
  description: z.string().optional().nullable(),
  startDateTime: z.string().datetime(),
  duration: z.number().int().positive().optional().nullable(),
  location: z.string().optional().nullable(),
  artistIds: z.array(z.number().int().positive()).optional().default([]),
  returnableItemIds: z.array(z.number().int().positive()).optional().default([]),
})

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = parseInt(getRouterParam(event, 'id') || '0')

  if (!editionId) {
    throw createError({ statusCode: 400, message: 'Edition invalide' })
  }

  // Vérifier les permissions
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    include: {
      convention: {
        include: {
          collaborators: true,
        },
      },
      collaboratorPermissions: {
        include: {
          collaborator: true,
        },
      },
    },
  })

  if (!edition) {
    throw createError({
      statusCode: 404,
      message: 'Édition non trouvée',
    })
  }

  const hasPermission = canEditEdition(edition, user)
  if (!hasPermission) {
    throw createError({
      statusCode: 403,
      message: "Vous n'êtes pas autorisé à gérer les spectacles de cette édition",
    })
  }

  try {
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
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        message: 'Données invalides',
        data: error.errors,
      })
    }

    if ((error as any).statusCode) {
      throw error
    }

    console.error('Erreur lors de la création du spectacle:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la création du spectacle',
    })
  }
})
