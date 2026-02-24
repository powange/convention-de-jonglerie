import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canEditEdition } from '#server/utils/permissions/edition-permissions'
import { buildUpdateData } from '#server/utils/prisma-helpers'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

const updateArtistSchema = z
  .object({
    arrivalDateTime: z.string().optional().nullable(),
    departureDateTime: z.string().optional().nullable(),
    dietaryPreference: z.enum(['NONE', 'VEGETARIAN', 'VEGAN']).optional(),
    allergies: z.string().optional().nullable(),
    allergySeverity: z.enum(['LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL']).optional().nullable(),
    payment: z.number().nonnegative().max(100000).optional().nullable(),
    paymentPaid: z.boolean().optional(),
    reimbursementMax: z.number().nonnegative().max(100000).optional().nullable(),
    reimbursementActual: z.number().nonnegative().max(100000).optional().nullable(),
    reimbursementActualPaid: z.boolean().optional(),
    accommodationAutonomous: z.boolean().optional(),
    accommodationType: z.enum(['TENT', 'VEHICLE', 'HOSTED', 'OTHER']).optional().nullable(),
    accommodationTypeOther: z.string().max(500).optional().nullable(),
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
  .refine(
    (data) => {
      if (data.reimbursementActual != null && data.reimbursementMax != null) {
        return data.reimbursementActual <= data.reimbursementMax
      }
      return true
    },
    { message: 'Le remboursement réel ne peut pas dépasser le maximum autorisé' }
  )

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

    // Vérification croisée remboursement vs valeur en base
    // undefined = non fourni (garder la valeur existante), null = effacement explicite
    const effectiveMax =
      validatedData.reimbursementMax !== undefined
        ? validatedData.reimbursementMax
        : existingArtist.reimbursementMax
    const effectiveActual =
      validatedData.reimbursementActual !== undefined
        ? validatedData.reimbursementActual
        : existingArtist.reimbursementActual
    if (effectiveActual != null && effectiveMax != null && effectiveActual > effectiveMax) {
      throw createError({
        status: 400,
        message: 'Le remboursement réel ne peut pas dépasser le maximum autorisé',
      })
    }
    if (effectiveMax == null && effectiveActual != null) {
      throw createError({
        status: 400,
        message:
          "Le remboursement maximum ne peut pas être supprimé tant qu'un remboursement réel est enregistré",
      })
    }

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
