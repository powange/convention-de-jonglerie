import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  const conventionId = parseInt(event.context.params?.id as string);

  if (!conventionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Convention ID invalide',
    });
  }

  try {
    const carpoolRequests = await prisma.carpoolRequest.findMany({
      where: {
        conventionId,
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            prenom: true,
            nom: true,
            email: true,
          },
        },
      },
      orderBy: {
        departureDate: 'asc',
      },
    });

    return carpoolRequests;
  } catch (error) {
    console.error('Erreur lors de la récupération des demandes:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur',
    });
  }
});