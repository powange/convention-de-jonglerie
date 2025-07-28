import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié',
    });
  }

  try {
    // Récupérer les conventions créées par l'utilisateur
    const conventions = await prisma.convention.findMany({
      where: {
        authorId: event.context.user.id,
      },
      include: {
        author: {
          select: {
            id: true,
            pseudo: true,
            email: true,
          },
        },
        editions: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            city: true,
            country: true,
            imageUrl: true,
          },
          orderBy: {
            startDate: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return conventions;
  } catch (error) {
    console.error('Erreur lors de la récupération des conventions:', error);
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur',
    });
  }
});