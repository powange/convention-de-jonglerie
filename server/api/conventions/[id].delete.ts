import { prisma } from '../../utils/prisma';


export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié',
    });
  }

  try {
    const conventionId = parseInt(getRouterParam(event, 'id') as string);
    
    if (isNaN(conventionId)) {
      throw createError({
        statusCode: 400,
        message: 'ID de convention invalide',
      });
    }

    // Vérifier que la convention existe et que l'utilisateur est l'auteur
    const existingConvention = await prisma.convention.findUnique({
      where: {
        id: conventionId,
      },
    });

    if (!existingConvention) {
      throw createError({
        statusCode: 404,
        message: 'Convention introuvable',
      });
    }

    if (existingConvention.authorId !== event.context.user.id) {
      throw createError({
        statusCode: 403,
        message: 'Vous n\'avez pas les droits pour supprimer cette convention',
      });
    }

    // Supprimer la convention
    await prisma.convention.delete({
      where: {
        id: conventionId,
      },
    });

    return { message: 'Convention supprimée avec succès' };
  } catch (error) {
    // Si c'est déjà une erreur HTTP, la relancer
    if (error.statusCode) {
      throw error;
    }
    
    console.error('Erreur lors de la suppression de la convention:', error);
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur lors de la suppression de la convention',
    });
  }
});