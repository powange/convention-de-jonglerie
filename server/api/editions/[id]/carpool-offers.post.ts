import { prisma } from '../../../utils/prisma';


export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    });
  }

  const editionId = parseInt(event.context.params?.id as string);
  const body = await readBody(event);

  if (!editionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Edition ID invalide',
    });
  }

  // Validation des données
  if (!body.departureDate || !body.departureCity || !body.departureAddress || !body.availableSeats) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Données manquantes',
    });
  }

  try {
    // Vérifier que l'édition existe
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
    });

    if (!edition) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Edition non trouvée',
      });
    }

    // Créer l'offre de covoiturage
    const carpoolOffer = await prisma.carpoolOffer.create({
      data: {
        editionId,
        userId: event.context.user.id,
        departureDate: new Date(body.departureDate),
        departureCity: body.departureCity,
        departureAddress: body.departureAddress,
        availableSeats: parseInt(body.availableSeats),
        description: body.description,
        phoneNumber: body.phoneNumber,
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
    });

    return carpoolOffer;
  } catch (error) {
    console.error('Erreur lors de la création du covoiturage:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur',
    });
  }
});