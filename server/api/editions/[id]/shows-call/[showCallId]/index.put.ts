import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import {
  getEditionWithPermissions,
  canManageArtists,
} from '@@/server/utils/permissions/edition-permissions'
import { validateEditionId } from '@@/server/utils/validation-helpers'
import { z } from 'zod'

const updateShowCallSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100, 'Le nom est trop long').optional(),
  description: z.string().max(5000).optional().nullable(),
  mode: z.enum(['INTERNAL', 'EXTERNAL']).optional(),
  externalUrl: z.string().url('URL invalide').optional().nullable(),
  deadline: z.string().datetime().optional().nullable(),
  isOpen: z.boolean().optional(),
  askPortfolioUrl: z.boolean().optional(),
  askVideoUrl: z.boolean().optional(),
  askTechnicalNeeds: z.boolean().optional(),
  askAccommodation: z.boolean().optional(),
  askDepartureCity: z.boolean().optional(),
})

/**
 * Met à jour un appel à spectacles
 * Accessible par les organisateurs ayant les droits de gestion des artistes
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const showCallId = Number(getRouterParam(event, 'showCallId'))

    if (isNaN(showCallId)) {
      throw createError({
        statusCode: 400,
        message: "ID de l'appel à spectacles invalide",
      })
    }

    // Vérifier les permissions
    const edition = await getEditionWithPermissions(editionId, {
      userId: user.id,
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        message: 'Édition non trouvée',
      })
    }

    if (!canManageArtists(edition, user)) {
      throw createError({
        statusCode: 403,
        message: "Vous n'avez pas les droits pour modifier cet appel à spectacles",
      })
    }

    // Vérifier que l'appel existe
    const existingShowCall = await prisma.editionShowCall.findFirst({
      where: {
        id: showCallId,
        editionId,
      },
    })

    if (!existingShowCall) {
      throw createError({
        statusCode: 404,
        message: 'Appel à spectacles non trouvé',
      })
    }

    // Valider les données
    const body = await readBody(event)
    const validatedData = updateShowCallSchema.parse(body)

    // Déterminer les valeurs finales pour la vérification de cohérence
    const finalMode = validatedData.mode ?? existingShowCall.mode
    const finalIsOpen = validatedData.isOpen ?? existingShowCall.isOpen
    const finalExternalUrl = validatedData.externalUrl ?? existingShowCall.externalUrl

    if (finalMode === 'EXTERNAL' && finalIsOpen && !finalExternalUrl) {
      throw createError({
        statusCode: 400,
        message: "L'URL externe est requise lorsque le mode est EXTERNAL et l'appel est ouvert",
      })
    }

    // Vérifier l'unicité du nom si changé
    if (validatedData.name && validatedData.name !== existingShowCall.name) {
      const duplicateName = await prisma.editionShowCall.findUnique({
        where: {
          editionId_name: {
            editionId,
            name: validatedData.name,
          },
        },
      })

      if (duplicateName) {
        throw createError({
          statusCode: 400,
          message: 'Un appel à spectacles avec ce nom existe déjà pour cette édition',
        })
      }
    }

    // Mettre à jour l'appel
    const showCall = await prisma.editionShowCall.update({
      where: { id: showCallId },
      data: {
        ...(validatedData.name !== undefined && { name: validatedData.name }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(validatedData.mode !== undefined && { mode: validatedData.mode }),
        ...(validatedData.externalUrl !== undefined && { externalUrl: validatedData.externalUrl }),
        ...(validatedData.deadline !== undefined && {
          deadline: validatedData.deadline ? new Date(validatedData.deadline) : null,
        }),
        ...(validatedData.isOpen !== undefined && { isOpen: validatedData.isOpen }),
        ...(validatedData.askPortfolioUrl !== undefined && {
          askPortfolioUrl: validatedData.askPortfolioUrl,
        }),
        ...(validatedData.askVideoUrl !== undefined && { askVideoUrl: validatedData.askVideoUrl }),
        ...(validatedData.askTechnicalNeeds !== undefined && {
          askTechnicalNeeds: validatedData.askTechnicalNeeds,
        }),
        ...(validatedData.askAccommodation !== undefined && {
          askAccommodation: validatedData.askAccommodation,
        }),
        ...(validatedData.askDepartureCity !== undefined && {
          askDepartureCity: validatedData.askDepartureCity,
        }),
      },
    })

    return {
      success: true,
      showCall,
    }
  },
  { operationName: 'UpdateShowCall' }
)
