import { prisma } from '../../utils/prisma';


export default defineEventHandler(async (event) => {
  // Cette route est publique pour permettre la consultation des conventions
  // L'authentification et les droits d'édition sont vérifiés côté client

  try {
    const conventionId = parseInt(getRouterParam(event, 'id') as string);
    
    if (isNaN(conventionId)) {
      throw createError({
        statusCode: 400,
        message: 'ID de convention invalide',
      });
    }

    // Récupérer la convention
    const convention = await prisma.convention.findUnique({
      where: {
        id: conventionId,
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
        },
      },
    });

    if (!convention) {
      throw createError({
        statusCode: 404,
        message: 'Convention introuvable',
      });
    }

    return convention;
  } catch (error) {
    // Si c'est déjà une erreur HTTP, la relancer
    if (error.statusCode) {
      throw error;
    }
    
    console.error('Erreur lors de la récupération de la convention:', error);
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur',
    });
  }
});