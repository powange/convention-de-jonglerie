import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { handleFileUpload } from '#server/utils/file-helpers'
import { canEditEdition } from '#server/utils/permissions/edition-permissions'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { showCompositionInclude, showZoneMarkerInclude } from '#server/utils/prisma-select-helpers'
import { replaceShowComposition, showActSchema } from '#server/utils/show-acts'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

const updateShowSchema = z.object({
  title: z.string().min(1, 'Le titre est requis').optional(),
  type: z.enum(['STANDARD', 'CABARET']).optional(),
  description: z.string().optional().nullable(),
  startDateTime: z.string().datetime().optional(),
  duration: z.number().int().positive().optional().nullable(),
  location: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  zoneId: z.number().int().positive().optional().nullable(),
  markerId: z.number().int().positive().optional().nullable(),
  artistIds: z.array(z.number().int().positive()).optional(),
  acts: z.array(showActSchema).optional(),
  handoutItemIds: z.array(z.number().int().positive()).optional(),
  isPublic: z.boolean().optional(),
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
    if (validatedData.type !== undefined) updateData.type = validatedData.type
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.startDateTime !== undefined)
      updateData.startDateTime = new Date(validatedData.startDateTime)
    if (validatedData.duration !== undefined) updateData.duration = validatedData.duration
    if (validatedData.location !== undefined) updateData.location = validatedData.location
    if (validatedData.zoneId !== undefined) updateData.zoneId = validatedData.zoneId || null
    if (validatedData.markerId !== undefined) updateData.markerId = validatedData.markerId || null
    if (validatedData.isPublic !== undefined) updateData.isPublic = validatedData.isPublic

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

    // Recomposer artistes et numéros dès que l'un des trois champs est fourni : ils sont liés,
    // et le type détermine laquelle des deux formes est conservée.
    const composedType = validatedData.type ?? existingShow.type
    if (
      validatedData.artistIds !== undefined ||
      validatedData.acts !== undefined ||
      (validatedData.type !== undefined && validatedData.type !== existingShow.type)
    ) {
      await replaceShowComposition(
        prisma,
        showId,
        composedType,
        validatedData.artistIds ?? [],
        validatedData.acts ?? []
      )
    }

    // Si des handoutItemIds sont fournis, mettre à jour les associations
    if (validatedData.handoutItemIds !== undefined) {
      // Supprimer les anciennes associations
      await prisma.showHandoutItem.deleteMany({
        where: { showId },
      })

      // Créer les nouvelles associations
      if (validatedData.handoutItemIds.length > 0) {
        updateData.handoutItems = {
          create: validatedData.handoutItemIds.map((handoutItemId) => ({
            handoutItemId,
          })),
        }
      }
    }

    // Mettre à jour le spectacle
    const updatedShow = await prisma.show.update({
      where: { id: showId },
      data: updateData,
      include: {
        ...showCompositionInclude,
        handoutItems: {
          include: {
            handoutItem: {
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

    return createSuccessResponse({ show: updatedShow })
  },
  { operationName: 'UpdateShow' }
)
