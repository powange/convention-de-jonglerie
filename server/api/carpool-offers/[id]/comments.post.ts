import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié',
    })
  }

  const carpoolOfferId = parseInt(event.context.params?.id as string)
  const body = await readBody(event)

  if (!carpoolOfferId) {
    throw createError({
      statusCode: 400,
      message: 'Carpool Offer ID invalide',
    })
  }

  // Validation des données
  if (!body.content || body.content.trim() === '') {
    throw createError({
      statusCode: 400,
      message: 'Le commentaire ne peut pas être vide',
    })
  }

  try {
    // Vérifier que l'offre de covoiturage existe
    const carpoolOffer = await prisma.carpoolOffer.findUnique({
      where: { id: carpoolOfferId },
    })

    if (!carpoolOffer) {
      throw createError({
        statusCode: 404,
        message: 'Offre de covoiturage non trouvée',
      })
    }

    // Créer le commentaire
    const comment = await prisma.carpoolComment.create({
      data: {
        carpoolOfferId,
        userId: event.context.user.id,
        content: body.content,
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
          },
        },
      },
    })

    return comment
  } catch (error) {
    console.error('Erreur lors de la création du commentaire:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur',
    })
  }
})
