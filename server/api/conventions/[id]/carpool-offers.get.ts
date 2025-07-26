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
    const carpoolOffers = await prisma.carpoolOffer.findMany({
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
        comments: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        departureDate: 'asc',
      },
    });

    return carpoolOffers;
  } catch (error) {
    console.error('Erreur lors de la récupération des covoiturages:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur',
    });
  }
});