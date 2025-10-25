import { requireAuth } from '@@/server/utils/auth-utils'
import { canEditEdition } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const updateArtistSchema = z.object({
  arrivalDateTime: z.string().optional().nullable(),
  departureDateTime: z.string().optional().nullable(),
  dietaryPreference: z.enum(['NONE', 'VEGETARIAN', 'VEGAN']).optional(),
  allergies: z.string().optional().nullable(),
  allergySeverity: z.enum(['LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL']).optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const artistId = parseInt(getRouterParam(event, 'artistId') || '0')

  if (!editionId || !artistId) {
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
      message: "Vous n'êtes pas autorisé à gérer les artistes de cette édition",
    })
  }

  try {
    // Vérifier que l'artiste existe et appartient à cette édition
    const existingArtist = await prisma.editionArtist.findFirst({
      where: {
        id: artistId,
        editionId,
      },
    })

    if (!existingArtist) {
      throw createError({
        statusCode: 404,
        message: 'Artiste non trouvé',
      })
    }

    const body = await readBody(event)
    const validatedData = updateArtistSchema.parse(body)

    // Mettre à jour l'artiste
    const updatedArtist = await prisma.editionArtist.update({
      where: { id: artistId },
      data: {
        arrivalDateTime: validatedData.arrivalDateTime,
        departureDateTime: validatedData.departureDateTime,
        dietaryPreference: validatedData.dietaryPreference,
        allergies: validatedData.allergies,
        allergySeverity: validatedData.allergySeverity,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            prenom: true,
            nom: true,
            phone: true,
          },
        },
        shows: {
          include: {
            show: {
              select: {
                id: true,
                title: true,
                startDateTime: true,
                location: true,
              },
            },
          },
        },
      },
    })

    return {
      success: true,
      artist: updatedArtist,
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

    console.error("Erreur lors de la modification de l'artiste:", error)
    throw createError({
      statusCode: 500,
      message: "Erreur lors de la modification de l'artiste",
    })
  }
})
