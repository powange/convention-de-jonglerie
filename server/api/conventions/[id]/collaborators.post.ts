import { z } from 'zod';
import { addConventionCollaborator, findUserByPseudoOrEmail } from '../../../utils/collaborator-management';

const addCollaboratorSchema = z.object({
  userIdentifier: z.string().min(1, 'Pseudo ou email requis').optional(),
  userId: z.number().positive().optional(),
  // Droits optionnels (sinon valeurs par défaut côté service)
  rights: z.object({
    editConvention: z.boolean().optional(),
    deleteConvention: z.boolean().optional(),
    manageCollaborators: z.boolean().optional(),
    addEdition: z.boolean().optional(),
    editAllEditions: z.boolean().optional(),
    deleteAllEditions: z.boolean().optional(),
  }).partial().optional(),
  title: z.string().max(100).optional().nullable()
}).refine(data => data.userIdentifier || data.userId, {
  message: 'userIdentifier ou userId est requis'
});

export default defineEventHandler(async (event) => {
  try {
    const conventionId = parseInt(getRouterParam(event, 'id') as string);
    const body = await readBody(event);
    
    // Valider les données
  const { userIdentifier, userId, rights, title } = addCollaboratorSchema.parse(body);
    
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
        select: { id: true, pseudo: true }
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
    const collaborator = await addConventionCollaborator({
      conventionId,
      userId: userToAdd.id,
      addedById: event.context.user.id,
      rights,
      title: title ?? undefined
    });

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