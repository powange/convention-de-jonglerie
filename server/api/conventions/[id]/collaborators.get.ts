import { getConventionCollaborators, checkUserConventionPermission } from '../../../utils/collaborator-management';

export default defineEventHandler(async (event) => {
  try {
    const conventionId = parseInt(getRouterParam(event, 'id') as string);
    
    // Vérifier l'authentification (le middleware s'en charge déjà)
    if (!event.context.user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Non authentifié'
      });
    }

    // Vérifier les permissions de l'utilisateur sur la convention
    const permission = await checkUserConventionPermission(conventionId, event.context.user.id);
    
    if (!permission.hasPermission) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Vous n\'avez pas accès à cette convention'
      });
    }

    // Récupérer les collaborateurs de la convention
    const collaborators = await getConventionCollaborators(conventionId);

    // Les données sont déjà filtrées par l'utilitaire getConventionCollaborators
    // Plus besoin de transformation car il n'y a plus d'email à masquer

    return collaborators;
  } catch (error: unknown) {
    const httpError = error as { statusCode?: number; message?: string };
    if (httpError.statusCode) {
      throw error;
    }
    console.error('Erreur lors de la récupération des collaborateurs:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur'
    });
  }
});