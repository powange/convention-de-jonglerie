import { prisma } from '../../../../utils/prisma'
import { carpoolRequestSchema } from '../../../../utils/validation-schemas'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié',
    })
  }

  const editionId = parseInt(event.context.params?.id as string)
  const body = await readBody(event)

  if (!editionId) {
    throw createError({
      statusCode: 400,
      message: 'Edition ID invalide',
    })
  }

  // Validation des données avec Zod
  const validationResult = carpoolRequestSchema.safeParse(body)
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

    // Créer la demande de covoiturage
    const carpoolRequest = await prisma.carpoolRequest.create({
      data: {
        editionId,
        userId: event.context.user.id,
        tripDate: new Date(validatedData.tripDate),
        locationCity: validatedData.locationCity,
        seatsNeeded: validatedData.seatsNeeded,
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

    return carpoolRequest
  } catch (error) {
    console.error('Erreur lors de la création de la demande:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur',
    })
  }
})
