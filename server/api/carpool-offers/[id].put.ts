import { z } from 'zod'

import { prisma } from '../../utils/prisma'

const updateCarpoolOfferSchema = z.object({
  departureDate: z.string().optional(),
  departureCity: z.string().min(1, 'La ville de départ est requise').optional(),
  departureAddress: z.string().min(1, "L'adresse de départ est requise").optional(),
  availableSeats: z
    .number()
    .int()
    .min(1, 'Au moins 1 place disponible')
    .max(8, 'Maximum 8 places')
    .optional(),
  description: z.string().max(500, 'Description trop longue (500 caractères max)').optional(),
  phoneNumber: z.string().max(20, 'Numéro de téléphone trop long').optional().nullable(),
})

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    })
  }

  const offerId = parseInt(getRouterParam(event, 'id') as string)

  if (isNaN(offerId)) {
    throw createError({
      statusCode: 400,
      statusMessage: "ID d'offre invalide",
    })
  }

  try {
    const body = await readBody(event)

    // Valider les données
    const validatedData = updateCarpoolOfferSchema.parse(body)

    // Vérifier que l'offre existe et que l'utilisateur en est le créateur
    const existingOffer = await prisma.carpoolOffer.findUnique({
      where: { id: offerId },
      include: {
        user: {
          select: { id: true, pseudo: true },
        },
      },
    })

    if (!existingOffer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Offre de covoiturage introuvable',
      })
    }

    // Seul le créateur peut modifier son offre
    if (existingOffer.userId !== event.context.user.id) {
      throw createError({
        statusCode: 403,
        statusMessage: "Vous n'avez pas les droits pour modifier cette offre",
      })
    }

    // Préparer les données à mettre à jour
    const updateData: any = {}

    if (validatedData.departureDate) {
      updateData.departureDate = new Date(validatedData.departureDate)
    }
    if (validatedData.departureCity) {
      updateData.departureCity = validatedData.departureCity.trim()
    }
    if (validatedData.departureAddress) {
      updateData.departureAddress = validatedData.departureAddress.trim()
    }
    if (validatedData.availableSeats !== undefined) {
      updateData.availableSeats = validatedData.availableSeats
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description?.trim() || null
    }
    if (validatedData.phoneNumber !== undefined) {
      updateData.phoneNumber = validatedData.phoneNumber?.trim() || null
    }

    // Mettre à jour l'offre
    const updatedOffer = await prisma.carpoolOffer.update({
      where: { id: offerId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            profilePicture: true,
          },
        },
      },
    })

    return updatedOffer
  } catch (error: unknown) {
    console.error("Erreur lors de la mise à jour de l'offre de covoiturage:", error)

    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Données invalides',
        data: error.errors,
      })
    }

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Erreur lors de la mise à jour de l'offre",
    })
  }
})
