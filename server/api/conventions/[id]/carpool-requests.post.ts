import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    });
  }

  const conventionId = parseInt(event.context.params?.id as string);
  const body = await readBody(event);

  if (!conventionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Convention ID invalide',
    });
  }

  // Validation des données
  if (!body.departureDate || !body.departureCity) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Données manquantes',
    });
  }

  try {
    // Vérifier que la convention existe
    const convention = await prisma.convention.findUnique({
      where: { id: conventionId },
    });

    if (!convention) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Convention non trouvée',
      });
    }

    // Créer la demande de covoiturage
    const carpoolRequest = await prisma.carpoolRequest.create({
      data: {
        conventionId,
        userId: event.context.user.id,
        departureDate: new Date(body.departureDate),
        departureCity: body.departureCity,
        seatsNeeded: body.seatsNeeded || 1,
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

    return carpoolRequest;
  } catch (error) {
    console.error('Erreur lors de la création de la demande:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur',
    });
  }
});