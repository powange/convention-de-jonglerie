import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  // L'authentification est gérée par le middleware global
  // L'utilisateur est disponible dans event.context.user si authentifié
  
  const offerId = parseInt(event.context.params?.id as string);

  if (!offerId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID de l\'offre invalide',
    });
  }

  try {
    const comments = await prisma.carpoolComment.findMany({
      where: {
        carpoolOfferId: offerId,
      },
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
        createdAt: 'asc',
      },
    });

    return comments;
  } catch (error) {
    console.error('Erreur lors de la récupération des commentaires:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur',
    });
  }
});