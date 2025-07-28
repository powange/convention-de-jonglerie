import { CollaboratorRole } from '@prisma/client';
import { z } from 'zod';
import { addConventionCollaborator, findUserByPseudoOrEmail } from '../../../utils/collaborator-management';

const addCollaboratorSchema = z.object({
  userIdentifier: z.string().min(1, 'Pseudo ou email requis'),
  role: z.nativeEnum(CollaboratorRole).default(CollaboratorRole.MODERATOR)
});

export default defineEventHandler(async (event) => {
  try {
    const conventionId = parseInt(getRouterParam(event, 'id') as string);
    const body = await readBody(event);
    
    // Valider les données
    const { userIdentifier, role } = addCollaboratorSchema.parse(body);
    
    // Vérifier l'authentification (le middleware s'en charge déjà)
    if (!event.context.user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Non authentifié'
      });
    }

    // Rechercher l'utilisateur par pseudo ou email
    const userToAdd = await findUserByPseudoOrEmail(userIdentifier);

    if (!userToAdd) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Utilisateur introuvable avec ce pseudo ou cet email'
      });
    }

    // Empêcher l'utilisateur de s'ajouter lui-même
    if (userToAdd.id === event.context.user.id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Vous ne pouvez pas vous ajouter comme collaborateur'
      });
    }

    // Ajouter le collaborateur (la fonction gère les permissions et les vérifications)
    const collaborator = await addConventionCollaborator(
      conventionId,
      userToAdd.id,
      role,
      event.context.user.id
    );

    return {
      success: true,
      collaborator
    };
  } catch (error: unknown) {
    const httpError = error as { statusCode?: number; message?: string };
    if (httpError.statusCode) {
      throw error;
    }
    console.error('Erreur lors de l\'ajout du collaborateur:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur'
    });
  }
});