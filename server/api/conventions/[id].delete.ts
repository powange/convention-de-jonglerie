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

    // Charger convention + droits granularisés
    const existingConvention = await prisma.convention.findUnique({
      where: { id: conventionId },
      include: {
        editions: { select: { id: true } },
        collaborators: { where: { userId: event.context.user.id } }
      }
    });

    if (!existingConvention) {
      throw createError({
        statusCode: 404,
        message: 'Convention introuvable',
      });
    }

    const isAuthor = existingConvention.authorId === event.context.user.id;
    const collab = existingConvention.collaborators[0];
    const canDelete = isAuthor || (collab && collab.canDeleteConvention);
    if (!canDelete) {
      throw createError({ statusCode: 403, message: 'Droit insuffisant pour supprimer cette convention' });
    }

    if (existingConvention.editions.length > 0) {
      // Archiver à la place
      if (!existingConvention.isArchived) {
        const archived = await prisma.convention.update({
          where: { id: conventionId },
          data: { isArchived: true, archivedAt: new Date() }
        });
        await prisma.collaboratorPermissionHistory.create({
          data: {
            conventionId,
            actorId: event.context.user.id,
            changeType: 'ARCHIVED',
            before: { isArchived: false } as any,
            after: { isArchived: true, archivedAt: archived.archivedAt } as any
          }
        });
      }
      return { message: 'Convention archivée (non supprimée car elle possède des éditions)' };
    } else {
      await prisma.convention.delete({ where: { id: conventionId } });
      return { message: 'Convention supprimée avec succès' };
    }
  } catch (error) {
    if (typeof error === 'object' && error && 'statusCode' in error) throw error as any;
    console.error('Erreur lors de la suppression/archivage de la convention:', error);
    throw createError({ statusCode: 500, message: 'Erreur serveur lors de la suppression/archivage' });
  }
});