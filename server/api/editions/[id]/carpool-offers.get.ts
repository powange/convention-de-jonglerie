import { getEmailHash } from '../../../utils/email-hash';
import { prisma } from '../../../utils/prisma';


export default defineEventHandler(async (event) => {
  const editionId = parseInt(event.context.params?.id as string);
  const viewerId = event.context.user?.id as number | undefined;

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
        bookings: {
          include: {
            requester: true,
          },
          orderBy: { createdAt: 'asc' },
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
    const transformedOffers = carpoolOffers.map(offer => {
      const viewerIsOwner = !!viewerId && viewerId === offer.userId;
      const viewerHasAccepted = !!viewerId && offer.bookings.some(b => b.status === 'ACCEPTED' && b.requesterId === viewerId);
      return {
        id: offer.id,
        editionId: offer.editionId,
        userId: offer.userId,
        departureDate: offer.departureDate,
        departureCity: offer.departureCity,
        departureAddress: offer.departureAddress,
        availableSeats: offer.availableSeats,
        description: offer.description,
        // n'exposer le contact que pour le propriétaire ou un réservant ACCEPTED
        phoneNumber: (viewerIsOwner || viewerHasAccepted) ? offer.phoneNumber : null,
        createdAt: offer.createdAt,
        updatedAt: offer.updatedAt,
        remainingSeats: Math.max(0, offer.availableSeats - offer.bookings.filter(b => b.status === 'ACCEPTED').reduce((s, b) => s + (b.seats || 0), 0)),
        user: {
          id: offer.user.id,
          pseudo: offer.user.pseudo,
          emailHash: getEmailHash(offer.user.email),
          profilePicture: offer.user.profilePicture,
          updatedAt: offer.user.updatedAt,
        },
        // Maintenu temporairement pour compatibilité, mais l'UI ne l'utilisera plus
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
        // Exposer les réservations avec requester anonymisé
        bookings: offer.bookings.map(b => ({
          id: b.id,
          carpoolOfferId: b.carpoolOfferId,
          requestId: b.requestId,
          seats: b.seats,
          message: b.message,
          status: b.status,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
          requester: {
            id: b.requester.id,
            pseudo: b.requester.pseudo,
            emailHash: getEmailHash(b.requester.email),
            profilePicture: b.requester.profilePicture,
            updatedAt: b.requester.updatedAt,
          },
        })),
        comments: offer.comments.map(comment => ({
          id: comment.id,
          content: comment.content,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
          user: {
            id: comment.user.id,
            pseudo: comment.user.pseudo,
            emailHash: getEmailHash(comment.user.email),
            profilePicture: comment.user.profilePicture,
            updatedAt: comment.user.updatedAt,
          },
        })),
      };
    });

    return transformedOffers;
  } catch (error) {
    console.error('Erreur lors de la récupération des covoiturages:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur',
    });
  }
});