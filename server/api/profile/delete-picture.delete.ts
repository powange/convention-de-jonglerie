import { deleteProfilePicture } from '../../utils/image-deletion';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    });
  }

  try {
    // Utiliser l'utilitaire de suppression
    const result = await deleteProfilePicture(user.id);

    return {
      success: result.success,
      user: result.entity,
    };
  } catch (error: unknown) {
    const httpError = error as { statusCode?: number; message?: string };
    if (httpError.statusCode) {
      throw error;
    }
    
    console.error('Erreur lors de la suppression de la photo de profil:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la suppression de la photo de profil',
    });
  }
});