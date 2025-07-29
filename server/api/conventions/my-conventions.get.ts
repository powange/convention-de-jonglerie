import { prisma } from '../../utils/prisma';


export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié',
    });
  }

  try {
    // Récupérer les conventions où l'utilisateur est auteur OU collaborateur
    const conventions = await prisma.convention.findMany({
      where: {
        OR: [
          { authorId: event.context.user.id },
          { 
            collaborators: {
              some: {
                userId: event.context.user.id,
              }
            }
          }
        ]
      },
      include: {
        author: {
          select: {
            id: true,
            pseudo: true,
            email: true,
          },
        },
        collaborators: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                profilePicture: true,
              },
            },
          },
          orderBy: {
            addedAt: 'asc',
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