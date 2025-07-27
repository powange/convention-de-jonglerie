import { PrismaClient } from '@prisma/client';
import { getEmailHash } from '../../../utils/email-hash';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  const editionId = parseInt(event.context.params?.id as string);

  if (!editionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Edition ID invalide',
    });
  }

  try {
    const carpoolOffers = await prisma.carpoolOffer.findMany({
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
    const transformedOffers = carpoolOffers.map(offer => ({
      ...offer,
      user: {
        id: offer.user.id,
        pseudo: offer.user.pseudo,
        prenom: offer.user.prenom,
        nom: offer.user.nom,
        emailHash: getEmailHash(offer.user.email),
        profilePicture: offer.user.profilePicture,
        updatedAt: offer.user.updatedAt,
      },
      comments: offer.comments.map(comment => ({
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

    return transformedOffers;
  } catch (error) {
    console.error('Erreur lors de la récupération des covoiturages:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur',
    });
  }
});