import { CollaboratorRole } from '@prisma/client';
import { z } from 'zod';
import { addConventionCollaborator, findUserByPseudoOrEmail } from '../../../utils/collaborator-management';

const addCollaboratorSchema = z.object({
  userIdentifier: z.string().min(1, 'Pseudo ou email requis').optional(),
  userId: z.number().positive().optional(),
  role: z.nativeEnum(CollaboratorRole).default(CollaboratorRole.MODERATOR)
}).refine(data => data.userIdentifier || data.userId, {
  message: 'userIdentifier ou userId est requis'
});

export default defineEventHandler(async (event) => {
  try {
    const conventionId = parseInt(getRouterParam(event, 'id') as string);
    const body = await readBody(event);
    
    // Valider les données
    const { userIdentifier, userId, role } = addCollaboratorSchema.parse(body);
    
    // Vérifier l'authentification (le middleware s'en charge déjà)
    if (!event.context.user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Non authentifié'
      });
    }

    let userToAdd;
    
    // Si userId est fourni, l'utiliser directement
    if (userId) {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      userToAdd = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, pseudo: true }
      });
      
      if (!userToAdd) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Utilisateur introuvable'
        });
      }
    } else if (userIdentifier) {
      // Sinon, rechercher par pseudo ou email (comportement existant)
      userToAdd = await findUserByPseudoOrEmail(userIdentifier);
      
      if (!userToAdd) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Utilisateur introuvable avec ce pseudo ou cet email'
        });
      }
    } else {
      throw createError({
        statusCode: 400,
        statusMessage: 'userIdentifier ou userId est requis'
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