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
    const carpoolOffers = await prisma.carpoolOffer.findMany({
      where: {
        editionId,
      },
      include: {
        user: true,
        passengers: {
          include: {
            user: true,
          },
          orderBy: {
            addedAt: 'asc',
          },
        },
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
      passengers: offer.passengers.map(passenger => ({
        id: passenger.id,
        addedAt: passenger.addedAt,
        user: {
          id: passenger.user.id,
          pseudo: passenger.user.pseudo,
          emailHash: getEmailHash(passenger.user.email),
          profilePicture: passenger.user.profilePicture,
          updatedAt: passenger.user.updatedAt,
        },
      })),
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