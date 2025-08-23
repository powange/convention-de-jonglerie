import { z } from 'zod';
import { updateCollaboratorRights } from '../../../../utils/collaborator-management';

const updateRightsSchema = z.object({
  rights: z.object({
    editConvention: z.boolean().optional(),
    deleteConvention: z.boolean().optional(),
    manageCollaborators: z.boolean().optional(),
    addEdition: z.boolean().optional(),
    editAllEditions: z.boolean().optional(),
    deleteAllEditions: z.boolean().optional(),
  }).partial().optional(),
  title: z.string().max(100).optional().nullable()
});

export default defineEventHandler(async (event) => {
  try {
    const conventionId = parseInt(getRouterParam(event, 'id') as string);
    const collaboratorId = parseInt(getRouterParam(event, 'collaboratorId') as string);
    const body = await readBody(event);
    
    // Valider les données
    const { rights, title } = updateRightsSchema.parse(body);
    
    // Empêcher une mise à jour vide (aucun champ fourni)
    if (!rights && (title === undefined || title === null)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Aucune donnée à mettre à jour'
      });
    }
    
    // Vérifier l'authentification (le middleware s'en charge déjà)
    if (!event.context.user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Non authentifié'
      });
    }

    // Mettre à jour le rôle (la fonction gère les permissions)
    const updatedCollaborator = await updateCollaboratorRights({
      conventionId,
      collaboratorId,
      userId: event.context.user.id,
      rights,
      title: title ?? undefined
    });

    return {
      success: true,
      collaborator: updatedCollaborator
    };
  } catch (error: unknown) {
    const httpError = error as { statusCode?: number; message?: string };
    if (httpError.statusCode) {
      throw error;
    }
    console.error('Erreur lors de la mise à jour du rôle:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur'
    });
  }
});