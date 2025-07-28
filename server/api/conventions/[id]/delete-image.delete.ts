import { deleteConventionImage } from '../../../utils/image-deletion';

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    });
  }

  try {
    const conventionId = parseInt(getRouterParam(event, 'id') as string);
    
    if (isNaN(conventionId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID de convention invalide',
      });
    }

    // Utiliser l'utilitaire de suppression
    const result = await deleteConventionImage(conventionId, event.context.user.id);

    return {
      success: result.success,
      message: result.message,
      convention: result.entity,
    };

  } catch (error: unknown) {
    // Si c'est déjà une erreur HTTP, la relancer
    const httpError = error as { statusCode?: number; message?: string };
    if (httpError.statusCode) {
      throw error;
    }
    
    console.error('Erreur lors de la suppression de l\'image:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur lors de la suppression de l\'image',
    });
  }
});