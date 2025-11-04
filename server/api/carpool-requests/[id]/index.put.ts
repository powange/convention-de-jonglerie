import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'
import { validateResourceId } from '@@/server/utils/validation-helpers'
import { z } from 'zod'

const updateCarpoolRequestSchema = z.object({
  tripDate: z.string().optional(),
  locationCity: z.string().min(1, 'La ville de départ est requise').optional(),
  seatsNeeded: z
    .number()
    .int()
    .min(1, 'Au moins 1 place nécessaire')
    .max(8, 'Maximum 8 places')
    .optional(),
  description: z.string().max(500, 'Description trop longue (500 caractères max)').optional(),
  phoneNumber: z.string().max(20, 'Numéro de téléphone trop long').optional().nullable(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const requestId = validateResourceId(event, 'id', 'demande')

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
        message: 'Demande de covoiturage introuvable',
      })
    }

    // Seul le créateur peut modifier sa demande
    if (existingRequest.userId !== user.id) {
      throw createError({
        statusCode: 403,
        message: "Vous n'avez pas les droits pour modifier cette demande",
      })
    }

    // Préparer les données à mettre à jour
    const updateData: any = {}

    if (validatedData.tripDate) {
      updateData.tripDate = new Date(validatedData.tripDate)
    }
    if (validatedData.locationCity) {
      updateData.locationCity = validatedData.locationCity.trim()
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
  },
  { operationName: 'UpdateCarpoolRequest' }
)
