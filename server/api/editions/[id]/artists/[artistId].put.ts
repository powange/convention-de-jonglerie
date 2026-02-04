import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canEditEdition } from '@@/server/utils/permissions/edition-permissions'
import { buildUpdateData } from '@@/server/utils/prisma-helpers'
import { validateEditionId, validateResourceId } from '@@/server/utils/validation-helpers'
import { z } from 'zod'

const updateArtistSchema = z.object({
  arrivalDateTime: z.string().optional().nullable(),
  departureDateTime: z.string().optional().nullable(),
  dietaryPreference: z.enum(['NONE', 'VEGETARIAN', 'VEGAN']).optional(),
  allergies: z.string().optional().nullable(),
  allergySeverity: z.enum(['LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL']).optional().nullable(),
  payment: z.number().optional().nullable(),
  paymentPaid: z.boolean().optional(),
  reimbursementMax: z.number().optional().nullable(),
  reimbursementActual: z.number().optional().nullable(),
  reimbursementActualPaid: z.boolean().optional(),
  accommodationAutonomous: z.boolean().optional(),
  accommodationProposal: z.string().optional().nullable(),
  invoiceRequested: z.boolean().optional(),
  invoiceProvided: z.boolean().optional(),
  feeRequested: z.boolean().optional(),
  feeProvided: z.boolean().optional(),
  pickupRequired: z.boolean().optional(),
  pickupLocation: z.string().optional().nullable(),
  pickupResponsibleId: z.number().int().positive().optional().nullable(),
  dropoffRequired: z.boolean().optional(),
  dropoffLocation: z.string().optional().nullable(),
  dropoffResponsibleId: z.number().int().positive().optional().nullable(),
  // Champs utilisateur (modifiables uniquement si authProvider = MANUAL)
  userEmail: z.string().email().optional(),
  userPrenom: z.string().min(1).optional(),
  userNom: z.string().min(1).optional(),
  userPhone: z.string().optional().nullable(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const artistId = validateResourceId(event, 'artistId', 'artiste')

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
      throw createError({
        status: 404,
        message: 'Édition non trouvée',
      })
    }

    const hasPermission = canEditEdition(edition, user)
    if (!hasPermission) {
      throw createError({
        status: 403,
        message: "Vous n'êtes pas autorisé à gérer les artistes de cette édition",
      })
    }

    // Vérifier que l'artiste existe et appartient à cette édition
    const existingArtist = await prisma.editionArtist.findFirst({
      where: {
        id: artistId,
        editionId,
      },
      include: {
        user: {
          select: {
            id: true,
            authProvider: true,
          },
        },
      },
    })

    if (!existingArtist) {
      throw createError({
        status: 404,
        message: 'Artiste non trouvé',
      })
    }

    const body = await readBody(event)
    const validatedData = updateArtistSchema.parse(body)

    // Vérifier si des modifications d'utilisateur sont demandées
    const hasUserUpdates =
      validatedData.userEmail ||
      validatedData.userPrenom ||
      validatedData.userNom ||
      validatedData.userPhone !== undefined

    // Si des modifications d'utilisateur sont demandées, vérifier que authProvider = MANUAL
    if (hasUserUpdates && existingArtist.user.authProvider !== 'MANUAL') {
      throw createError({
        status: 403,
        message:
          "Les informations de l'utilisateur ne peuvent être modifiées que pour les utilisateurs créés manuellement",
      })
    }

    // Mettre à jour l'utilisateur si authProvider = MANUAL et que des modifications sont demandées
    if (hasUserUpdates && existingArtist.user.authProvider === 'MANUAL') {
      const userUpdateData: {
        email?: string
        prenom?: string
        nom?: string
        phone?: string | null
      } = {}

      if (validatedData.userEmail) userUpdateData.email = validatedData.userEmail
      if (validatedData.userPrenom) userUpdateData.prenom = validatedData.userPrenom
      if (validatedData.userNom) userUpdateData.nom = validatedData.userNom
      if (validatedData.userPhone !== undefined) userUpdateData.phone = validatedData.userPhone

      await prisma.user.update({
        where: { id: existingArtist.user.id },
        data: userUpdateData,
      })
    }

    // Mettre à jour l'artiste
    const updatedArtist = await prisma.editionArtist.update({
      where: { id: artistId },
      data: buildUpdateData(validatedData, {
        exclude: ['userEmail', 'userPrenom', 'userNom', 'userPhone'],
      }),
      include: {
        user: {
          select: {
            id: true,
            email: true,
            prenom: true,
            nom: true,
            phone: true,
            authProvider: true,
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
  },
  { operationName: 'UpdateArtist' }
)
