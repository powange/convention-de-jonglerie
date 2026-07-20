import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { handleFileUpload } from '#server/utils/file-helpers'
import { canEditEdition } from '#server/utils/permissions/edition-permissions'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { showCompositionInclude, showZoneMarkerInclude } from '#server/utils/prisma-select-helpers'
import { replaceShowComposition, showActSchema } from '#server/utils/show-acts'
import { validateEditionId } from '#server/utils/validation-helpers'

const showSchema = z.object({
  title: z.string().min(1, 'Le titre est requis').max(191),
  type: z.enum(['STANDARD', 'CABARET']).optional().default('STANDARD'),
  description: z.string().optional().nullable(),
  technicalNeeds: z.string().max(2000).optional().nullable(),
  startDateTime: z.string().datetime(),
  duration: z.number().int().positive().optional().nullable(),
  location: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  zoneId: z.number().int().positive().optional().nullable(),
  markerId: z.number().int().positive().optional().nullable(),
  // artistIds pour un spectacle STANDARD, acts pour un CABARET dont les artistes
  // sont portés par les numéros
  artistIds: z.array(z.number().int().positive()).optional().default([]),
  acts: z.array(showActSchema).optional().default([]),
  handoutItemIds: z.array(z.number().int().positive()).optional().default([]),
  isPublic: z.boolean().optional().default(false),
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

    // Création et composition dans la même transaction : un numéro invalide ne doit pas
    // laisser derrière lui un spectacle à moitié constitué.
    const show = await prisma.$transaction(async (tx) => {
      const created = await tx.show.create({
        data: {
          editionId,
          title: validatedData.title,
          type: validatedData.type,
          description: validatedData.description,
          technicalNeeds: validatedData.technicalNeeds,
          startDateTime: new Date(validatedData.startDateTime),
          duration: validatedData.duration,
          location: validatedData.location,
          zoneId: validatedData.zoneId || null,
          markerId: validatedData.markerId || null,
          isPublic: validatedData.isPublic,
          handoutItems: {
            create: validatedData.handoutItemIds.map((handoutItemId) => ({
              handoutItemId,
            })),
          },
        },
      })

      // Les numéros ont besoin de l'id du spectacle, d'où cette seconde étape
      await replaceShowComposition(
        tx,
        created.id,
        validatedData.type,
        validatedData.artistIds,
        validatedData.acts
      )

      return created
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
  { operationName: 'CreateShow' }
)
