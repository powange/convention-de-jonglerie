import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'
import { carpoolOfferSchema } from '@@/server/utils/validation-schemas'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(event.context.params?.id as string)
  const body = await readBody(event)

  if (!editionId) {
    throw createError({
      statusCode: 400,
      message: 'Edition ID invalide',
    })
  }

  // Validation des données avec Zod
  const validationResult = carpoolOfferSchema.safeParse(body)
  if (!validationResult.success) {
    throw createError({
      statusCode: 400,
      message: 'Données invalides',
      data: validationResult.error.flatten(),
    })
  }

  const validatedData = validationResult.data

  try {
    // Vérifier que l'édition existe
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        message: 'Edition non trouvée',
      })
    }

    // Créer l'offre de covoiturage
    const carpoolOffer = await prisma.carpoolOffer.create({
      data: {
        editionId,
        userId: user.id,
        tripDate: new Date(validatedData.tripDate),
        locationCity: validatedData.locationCity,
        locationAddress: validatedData.locationAddress,
        availableSeats: validatedData.availableSeats,
        direction: validatedData.direction,
        description: validatedData.description,
        phoneNumber: validatedData.phoneNumber,
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            prenom: true,
            nom: true,
          },
        },
      },
    })

    return carpoolOffer
  } catch (error) {
    console.error('Erreur lors de la création du covoiturage:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur',
    })
  }
})
