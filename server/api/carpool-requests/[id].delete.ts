import { prisma } from '../../utils/prisma';

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié'
    });
  }

  const requestId = parseInt(getRouterParam(event, 'id') as string);
  
  if (isNaN(requestId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID de demande invalide'
    });
  }

  try {
    // Vérifier que la demande existe et que l'utilisateur en est le créateur
    const existingRequest = await prisma.carpoolRequest.findUnique({
      where: { id: requestId }
    });

    if (!existingRequest) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Demande de covoiturage introuvable'
      });
    }

    // Seul le créateur peut supprimer sa demande
    if (existingRequest.userId !== event.context.user.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Vous n\'avez pas les droits pour supprimer cette demande'
      });
    }

    // Supprimer la demande (les commentaires seront supprimés automatiquement grâce à CASCADE)
    await prisma.carpoolRequest.delete({
      where: { id: requestId }
    });

    return { message: 'Demande de covoiturage supprimée avec succès' };

  } catch (error: unknown) {
    console.error('Erreur lors de la suppression de la demande de covoiturage:', error);
    
    if (error.statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la suppression de la demande'
    });
  }
});