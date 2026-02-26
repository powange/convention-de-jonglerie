import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { handleFileUpload } from '#server/utils/file-helpers'
import { canEditEdition } from '#server/utils/permissions/edition-permissions'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { showZoneMarkerInclude } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

const showSchema = z.object({
  title: z.string().min(1, 'Le titre est requis'),
  description: z.string().optional().nullable(),
  startDateTime: z.string().datetime(),
  duration: z.number().int().positive().optional().nullable(),
  location: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  zoneId: z.number().int().positive().optional().nullable(),
  markerId: z.number().int().positive().optional().nullable(),
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

    // Créer le spectacle (sans image pour obtenir l'ID)
    const show = await prisma.show.create({
      data: {
        editionId,
        title: validatedData.title,
        description: validatedData.description,
        startDateTime: new Date(validatedData.startDateTime),
        duration: validatedData.duration,
        location: validatedData.location,
        zoneId: validatedData.zoneId || null,
        markerId: validatedData.markerId || null,
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
    })

    // Gérer l'image avec le helper centralisé
    const finalImageFilename = await handleFileUpload(validatedData.imageUrl, null, {
      resourceId: show.id,
      resourceType: 'shows',
    })

    // Mettre à jour l'image si nécessaire
    const updatedShow = await prisma.show.update({
      where: { id: show.id },
      data: {
        imageUrl: finalImageFilename || null,
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
        ...showZoneMarkerInclude,
      },
    })

    return createSuccessResponse({ show: updatedShow })
  },
  { operationName: 'CreateShow' }
)
