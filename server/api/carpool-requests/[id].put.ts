import { z } from 'zod'

import { prisma } from '../../utils/prisma'

const updateCarpoolRequestSchema = z.object({
  departureDate: z.string().optional(),
  departureCity: z.string().min(1, 'La ville de départ est requise').optional(),
  seatsNeeded: z
    .number()
    .int()
    .min(1, 'Au moins 1 place nécessaire')
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

  const requestId = parseInt(getRouterParam(event, 'id') as string)

  if (isNaN(requestId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID de demande invalide',
    })
  }

  try {
    const body = await readBody(event)

    // Valider les données
    const validatedData = updateCarpoolRequestSchema.parse(body)

    // Vérifier que la demande existe et que l'utilisateur en est le créateur
    const existingRequest = await prisma.carpoolRequest.findUnique({
      where: { id: requestId },
      include: {
        user: {
          select: { id: true, pseudo: true },
        },
      },
    })

    if (!existingRequest) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Demande de covoiturage introuvable',
      })
    }

    // Seul le créateur peut modifier sa demande
    if (existingRequest.userId !== event.context.user.id) {
      throw createError({
        statusCode: 403,
        statusMessage: "Vous n'avez pas les droits pour modifier cette demande",
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
    if (validatedData.seatsNeeded !== undefined) {
      updateData.seatsNeeded = validatedData.seatsNeeded
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description?.trim() || null
    }
    if (validatedData.phoneNumber !== undefined) {
      updateData.phoneNumber = validatedData.phoneNumber?.trim() || null
    }

    // Mettre à jour la demande
    const updatedRequest = await prisma.carpoolRequest.update({
      where: { id: requestId },
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

    return updatedRequest
  } catch (error: unknown) {
    console.error('Erreur lors de la mise à jour de la demande de covoiturage:', error)

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
      statusMessage: 'Erreur lors de la mise à jour de la demande',
    })
  }
})
