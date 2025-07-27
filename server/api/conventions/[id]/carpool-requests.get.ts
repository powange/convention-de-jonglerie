import { PrismaClient } from '@prisma/client';
import { getEmailHash } from '../../../utils/email-hash';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  const conventionId = parseInt(event.context.params?.id as string);

  if (!conventionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Convention ID invalide',
    });
  }

  try {
    const carpoolRequests = await prisma.carpoolRequest.findMany({
      where: {
        conventionId,
      },
      include: {
        user: true,
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