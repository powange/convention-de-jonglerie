import { deleteEditionCollaborator } from '../../../../utils/collaborator-management';

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification (le middleware s'en charge déjà)
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié'
    });
  }

  try {
    const editionId = parseInt(getRouterParam(event, 'id') as string);
    const collaboratorId = parseInt(getRouterParam(event, 'collaboratorId') as string);

    // Utiliser l'utilitaire de suppression
    const result = await deleteEditionCollaborator(
      editionId,
      collaboratorId,
      event.context.user.id
    );

    return {
      success: result.success,
      message: result.message
    };
  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }
    
    console.error('Erreur lors de la suppression du collaborateur:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur'
    });
  }
});