import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { handleFileUpload } from '#server/utils/file-helpers'
import { syncShowGroupParticipants } from '#server/utils/messenger-helpers'
import { canManageArtists } from '#server/utils/permissions/edition-permissions'
import {
  showCompositionInclude,
  showPerformancesInclude,
} from '#server/utils/prisma-select-helpers'
import { replaceShowComposition, showActSchema } from '#server/utils/show-acts'
import { replaceShowPerformances, showPerformancesSchema } from '#server/utils/show-performances'
import { normalizeHandoutItemAssociations } from '#server/utils/ticketing/handout-items'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

const updateShowSchema = z.object({
  // 191 = taille de la colonne : au-delà, l'écriture échouerait au milieu de la transaction
  title: z.string().min(1, 'Le titre est requis').max(191).optional(),
  type: z.enum(['STANDARD', 'CABARET']).optional(),
  companyName: z.string().max(191).optional().nullable(),
  description: z.string().optional().nullable(),
  // Sans plafond (comme description) : agrège les besoins techniques importés des candidatures
  technicalNeeds: z.string().optional().nullable(),
  // Omises = inchangées ; fournies = elles remplacent l'ensemble des représentations
  performances: showPerformancesSchema.optional(),
  duration: z.number().int().positive().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  artistIds: z.array(z.number().int().positive()).optional(),
  acts: z.array(showActSchema).optional(),
  // Un identifiant nu (quantité 1) ou un couple identifiant + quantité.
  handoutItemIds: z
    .array(
      z.union([
        z.number().int().positive(),
        z.object({
          handoutItemId: z.number().int().positive(),
          quantity: z.number().int().min(1).max(999).optional(),
        }),
      ])
    )
    .optional(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const showId = validateResourceId(event, 'showId', 'spectacle')

    // Vérifier les permissions
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
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
    })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }

    const hasPermission = canManageArtists(edition, user)
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
    const composedType = validatedData.type ?? existingShow.type

    if (validatedData.title !== undefined) updateData.title = validatedData.title
    if (validatedData.type !== undefined) updateData.type = validatedData.type
    if (validatedData.companyName !== undefined) updateData.companyName = validatedData.companyName
    // Un cabaret n'a pas de compagnie unique : en y basculant, on efface celle du spectacle
    // plutôt que de la laisser réapparaître si l'on revient un jour en STANDARD.
    if (composedType === 'CABARET') updateData.companyName = null
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.technicalNeeds !== undefined)
      updateData.technicalNeeds = validatedData.technicalNeeds
    if (validatedData.duration !== undefined) updateData.duration = validatedData.duration

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

    // La recomposition efface avant de recréer : sans transaction, un échec en cours de route
    // (titre trop long, zone supprimée entre-temps) laisserait le spectacle amputé de ses
    // artistes, de ses numéros et de ses articles, sans moyen de les retrouver.
    const recompose =
      validatedData.artistIds !== undefined ||
      validatedData.acts !== undefined ||
      (validatedData.type !== undefined && validatedData.type !== existingShow.type)

    // Un cabaret porte ses artistes dans ses numéros : accepter artistIds sans acts
    // reviendrait à effacer silencieusement tout le déroulé.
    if (recompose && composedType === 'CABARET' && validatedData.acts === undefined) {
      throw createError({
        status: 400,
        message: 'Les artistes d’un spectacle cabaret se définissent dans ses numéros (acts)',
      })
    }

    const updatedShow = await prisma.$transaction(async (tx) => {
      // L'update d'abord : il valide les champs du spectacle, et un échec ici ne doit pas
      // laisser la composition à moitié réécrite.
      const show = await tx.show.update({
        where: { id: showId },
        data: updateData,
      })

      if (validatedData.performances !== undefined) {
        await replaceShowPerformances(tx, showId, validatedData.performances)
      }

      if (recompose) {
        await replaceShowComposition(
          tx,
          showId,
          composedType,
          validatedData.artistIds ?? [],
          validatedData.acts ?? []
        )

        // Le groupe de messagerie du spectacle suit sa distribution : un artiste ajouté le
        // rejoint, un artiste retiré cesse d'en recevoir la suite. Sans effet tant que
        // personne n'a ouvert ce groupe.
        await syncShowGroupParticipants(showId, tx)
      }

      if (validatedData.handoutItemIds !== undefined) {
        await tx.showHandoutItem.deleteMany({ where: { showId } })
        const associations = normalizeHandoutItemAssociations(validatedData.handoutItemIds)
        if (associations.length > 0) {
          await tx.showHandoutItem.createMany({
            data: associations.map(({ handoutItemId, quantity }) => ({
              showId,
              handoutItemId,
              quantity,
            })),
          })
        }
      }

      return tx.show.findUniqueOrThrow({
        where: { id: show.id },
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
          ...showPerformancesInclude,
        },
      })
    })

    return createSuccessResponse({ show: updatedShow })
  },
  { operationName: 'UpdateShow' }
)
