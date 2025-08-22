import { prisma } from '../../utils/prisma';
import { getEmailHash } from '../../utils/email-hash';


export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié',
    });
  }

    try {
      // Editions must include isOnline (non-nullable boolean with default false)
      const editionsSelect: any = {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        city: true,
        country: true,
        imageUrl: true,
        isOnline: true,
      }
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
                email: true,
              },
            },
          },
          orderBy: {
            addedAt: 'asc',
          },
        },
        editions: {
          select: editionsSelect,
          orderBy: {
            startDate: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transformer les emails en emailHash pour les auteurs et collaborateurs
    const transformedConventions = conventions.map(convention => ({
      ...convention,
      author: {
        ...convention.author,
        emailHash: getEmailHash(convention.author.email),
        email: undefined
      } as any,
      collaborators: convention.collaborators.map(collab => ({
        ...collab,
        user: {
          ...collab.user,
          emailHash: getEmailHash(collab.user.email),
          email: undefined
        } as any
      }))
    }));

    return transformedConventions;
  } catch (error) {
    console.error('Erreur lors de la récupération des conventions:', error);
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur',
    });
  }
});