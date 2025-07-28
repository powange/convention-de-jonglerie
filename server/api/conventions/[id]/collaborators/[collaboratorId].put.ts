import { CollaboratorRole } from '@prisma/client';
import { z } from 'zod';
import { updateCollaboratorRole } from '../../../../utils/collaborator-management';

const updateRoleSchema = z.object({
  role: z.nativeEnum(CollaboratorRole)
});

export default defineEventHandler(async (event) => {
  try {
    const conventionId = parseInt(getRouterParam(event, 'id') as string);
    const collaboratorId = parseInt(getRouterParam(event, 'collaboratorId') as string);
    const body = await readBody(event);
    
    // Valider les données
    const { role } = updateRoleSchema.parse(body);
    
    // Vérifier l'authentification (le middleware s'en charge déjà)
    if (!event.context.user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Non authentifié'
      });
    }

    // Mettre à jour le rôle (la fonction gère les permissions)
    const updatedCollaborator = await updateCollaboratorRole(
      conventionId,
      collaboratorId,
      role,
      event.context.user.id
    );

    return {
      success: true,
      collaborator: updatedCollaborator
    };
  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }
    console.error('Erreur lors de la mise à jour du rôle:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur'
    });
  }
});