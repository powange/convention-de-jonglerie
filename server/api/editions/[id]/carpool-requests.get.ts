import { getEmailHash } from '../../../utils/email-hash';
import { prisma } from '../../../utils/prisma';


export default defineEventHandler(async (event) => {
  const editionId = parseInt(event.context.params?.id as string);

  if (!editionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Edition ID invalide',
    });
  }

  try {
    const carpoolRequests = await prisma.carpoolRequest.findMany({
      where: {
        editionId,
      },
      include: {
        user: true,
        comments: {
          include: {
            user: true,
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

    // Transformer les données pour masquer les emails et ajouter les hash
    const transformedRequests = carpoolRequests.map(request => ({
      ...request,
      user: {
        id: request.user.id,
        pseudo: request.user.pseudo,
        prenom: request.user.prenom,
        nom: request.user.nom,
        emailHash: getEmailHash(request.user.email),
        profilePicture: request.user.profilePicture,
        updatedAt: request.user.updatedAt,
      },
      comments: request.comments.map(comment => ({
        ...comment,
        user: {
          id: comment.user.id,
          pseudo: comment.user.pseudo,
          emailHash: getEmailHash(comment.user.email),
          profilePicture: comment.user.profilePicture,
          updatedAt: comment.user.updatedAt,
        },
      })),
    }));

    return transformedRequests;
  } catch (error) {
    console.error('Erreur lors de la récupération des demandes:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur',
    });
  }
});