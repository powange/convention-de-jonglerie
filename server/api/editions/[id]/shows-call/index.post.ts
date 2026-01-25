import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import {
  getEditionWithPermissions,
  canManageArtists,
} from '@@/server/utils/permissions/edition-permissions'
import { validateEditionId } from '@@/server/utils/validation-helpers'
import { z } from 'zod'

const createShowCallSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100, 'Le nom est trop long'),
  description: z.string().max(5000).optional().nullable(),
  mode: z.enum(['INTERNAL', 'EXTERNAL']).default('INTERNAL'),
  externalUrl: z.string().url('URL invalide').optional().nullable(),
  deadline: z.string().datetime().optional().nullable(),
  isOpen: z.boolean().default(false),
  askPortfolioUrl: z.boolean().default(true),
  askVideoUrl: z.boolean().default(true),
  askTechnicalNeeds: z.boolean().default(true),
  askAccommodation: z.boolean().default(false),
  askDepartureCity: z.boolean().default(false),
})

/**
 * Crée un nouvel appel à spectacles pour une édition
 * Accessible par les organisateurs ayant les droits de gestion des artistes
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

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
        message: "Vous n'avez pas les droits pour créer un appel à spectacles",
      })
    }

    // Valider les données
    const body = await readBody(event)
    const validatedData = createShowCallSchema.parse(body)

    // Vérifier la cohérence des données
    if (validatedData.mode === 'EXTERNAL' && validatedData.isOpen && !validatedData.externalUrl) {
      throw createError({
        statusCode: 400,
        message: "L'URL externe est requise lorsque le mode est EXTERNAL et l'appel est ouvert",
      })
    }

    // Vérifier que le nom n'existe pas déjà pour cette édition
    const existingShowCall = await prisma.editionShowCall.findUnique({
      where: {
        editionId_name: {
          editionId,
          name: validatedData.name,
        },
      },
    })

    if (existingShowCall) {
      throw createError({
        statusCode: 400,
        message: 'Un appel à spectacles avec ce nom existe déjà pour cette édition',
      })
    }

    // Créer l'appel à spectacles
    const showCall = await prisma.editionShowCall.create({
      data: {
        editionId,
        name: validatedData.name,
        description: validatedData.description || null,
        mode: validatedData.mode,
        externalUrl: validatedData.externalUrl || null,
        deadline: validatedData.deadline ? new Date(validatedData.deadline) : null,
        isOpen: validatedData.isOpen,
        askPortfolioUrl: validatedData.askPortfolioUrl,
        askVideoUrl: validatedData.askVideoUrl,
        askTechnicalNeeds: validatedData.askTechnicalNeeds,
        askAccommodation: validatedData.askAccommodation,
        askDepartureCity: validatedData.askDepartureCity,
      },
    })

    return {
      success: true,
      showCall,
    }
  },
  { operationName: 'CreateShowCall' }
)
