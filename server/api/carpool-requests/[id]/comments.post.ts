import { prisma } from '../../../utils/prisma';


export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    });
  }

  const carpoolRequestId = parseInt(event.context.params?.id as string);
  const body = await readBody(event);

  if (!carpoolRequestId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Carpool Request ID invalide',
    });
  }

  // Validation des données
  if (!body.content || body.content.trim() === '') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Le commentaire ne peut pas être vide',
    });
  }

  try {
    // Vérifier que la demande de covoiturage existe
    const carpoolRequest = await prisma.carpoolRequest.findUnique({
      where: { id: carpoolRequestId },
    });

    if (!carpoolRequest) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Demande de covoiturage non trouvée',
      });
    }

    // Créer le commentaire
    const comment = await prisma.carpoolRequestComment.create({
      data: {
        carpoolRequestId,
        userId: event.context.user.id,
        content: body.content,
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
          },
        },
      },
    });

    return comment;
  } catch (error) {
    console.error('Erreur lors de la création du commentaire:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur',
    });
  }
});