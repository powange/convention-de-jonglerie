import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { handleFileUpload } from '#server/utils/file-helpers'
import { canEditEdition } from '#server/utils/permissions/edition-permissions'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { showZoneMarkerInclude } from '#server/utils/prisma-select-helpers'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

const updateShowSchema = z.object({
  title: z.string().min(1, 'Le titre est requis').optional(),
  description: z.string().optional().nullable(),
  startDateTime: z.string().datetime().optional(),
  duration: z.number().int().positive().optional().nullable(),
  location: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  zoneId: z.number().int().positive().optional().nullable(),
  markerId: z.number().int().positive().optional().nullable(),
  artistIds: z.array(z.number().int().positive()).optional(),
  returnableItemIds: z.array(z.number().int().positive()).optional(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const showId = validateResourceId(event, 'showId', 'spectacle')

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

    // Vérifier que le spectacle existe et appartient à cette édition
    const existingShow = await prisma.show.findFirst({
      where: {
        id: showId,
        editionId,
      },
    })

    if (!existingShow) {
      throw createError({
        status: 404,
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
    if (validatedData.zoneId !== undefined) updateData.zoneId = validatedData.zoneId || null
    if (validatedData.markerId !== undefined) updateData.markerId = validatedData.markerId || null

    // Gérer l'image avec le helper centralisé
    if (validatedData.imageUrl !== undefined) {
      const finalImageFilename = await handleFileUpload(
        validatedData.imageUrl,
        existingShow.imageUrl,
        {
          resourceId: showId,
          resourceType: 'shows',
        }
      )
      updateData.imageUrl =
        finalImageFilename !== undefined ? finalImageFilename : existingShow.imageUrl
    }

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
        ...showZoneMarkerInclude,
      },
    })

    return {
      success: true,
      show: updatedShow,
    }
  },
  { operationName: 'UpdateShow' }
)
