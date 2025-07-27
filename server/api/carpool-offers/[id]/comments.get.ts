import { PrismaClient } from '@prisma/client';
import { getEmailHash } from '../../../utils/email-hash';

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
        user: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Transformer les données pour masquer les emails et ajouter les hash
    const transformedComments = comments.map(comment => ({
      ...comment,
      user: {
        id: comment.user.id,
        pseudo: comment.user.pseudo,
        emailHash: getEmailHash(comment.user.email),
        profilePicture: comment.user.profilePicture,
        updatedAt: comment.user.updatedAt,
      },
    }));

    return transformedComments;
  } catch (error) {
    console.error('Erreur lors de la récupération des commentaires:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur',
    });
  }
});