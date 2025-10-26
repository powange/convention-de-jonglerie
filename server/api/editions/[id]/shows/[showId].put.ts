import { requireAuth } from '@@/server/utils/auth-utils'
import { canEditEdition } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const updateShowSchema = z.object({
  title: z.string().min(1, 'Le titre est requis').optional(),
  description: z.string().optional().nullable(),
  startDateTime: z.string().datetime().optional(),
  duration: z.number().int().positive().optional().nullable(),
  location: z.string().optional().nullable(),
  artistIds: z.array(z.number().int().positive()).optional(),
  returnableItemIds: z.array(z.number().int().positive()).optional(),
})

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const showId = parseInt(getRouterParam(event, 'showId') || '0')

  if (!editionId || !showId) {
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })
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
    // Vérifier que le spectacle existe et appartient à cette édition
    const existingShow = await prisma.show.findFirst({
      where: {
        id: showId,
        editionId,
      },
    })

    if (!existingShow) {
      throw createError({
        statusCode: 404,
        message: 'Spectacle non trouvé',
      })
    }

    const body = await readBody(event)
    const validatedData = updateShowSchema.parse(body)

    // Préparer les données de mise à jour
    const updateData: any = {}

    if (validatedData.title !== undefined) updateData.title = validatedData.title
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.startDateTime !== undefined)
      updateData.startDateTime = new Date(validatedData.startDateTime)
    if (validatedData.duration !== undefined) updateData.duration = validatedData.duration
    if (validatedData.location !== undefined) updateData.location = validatedData.location

    // Si des artistIds sont fournis, mettre à jour les associations
    if (validatedData.artistIds !== undefined) {
      // Supprimer les anciennes associations
      await prisma.showArtist.deleteMany({
        where: { showId },
      })

      // Créer les nouvelles associations
      if (validatedData.artistIds.length > 0) {
        updateData.artists = {
          create: validatedData.artistIds.map((artistId) => ({
            artistId,
          })),
        }
      }
    }

    // Si des returnableItemIds sont fournis, mettre à jour les associations
    if (validatedData.returnableItemIds !== undefined) {
      // Supprimer les anciennes associations
      await prisma.showReturnableItem.deleteMany({
        where: { showId },
      })

      // Créer les nouvelles associations
      if (validatedData.returnableItemIds.length > 0) {
        updateData.returnableItems = {
          create: validatedData.returnableItemIds.map((returnableItemId) => ({
            returnableItemId,
          })),
        }
      }
    }

    // Mettre à jour le spectacle
    const updatedShow = await prisma.show.update({
      where: { id: showId },
      data: updateData,
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
      show: updatedShow,
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

    console.error('Erreur lors de la modification du spectacle:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la modification du spectacle',
    })
  }
})
