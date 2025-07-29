import { z } from 'zod';
import { prisma } from '../../utils/prisma';
import { conventionSchema, handleValidationError } from '../../utils/validation-schemas';

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    });
  }

  try {
    const body = await readBody(event);
    
    // Validation avec Zod
    const validatedData = conventionSchema.parse(body);
    
    // Sanitisation
    const cleanName = validatedData.name.trim();
    const cleanDescription = validatedData.description?.trim() || null;

    // Créer la convention
    const convention = await prisma.convention.create({
      data: {
        name: cleanName,
        description: cleanDescription,
        authorId: event.context.user.id,
      },
      include: {
        author: {
          select: {
            id: true,
            pseudo: true,
            email: true,
          },
        },
      },
    });

    // Ajouter automatiquement le créateur comme collaborateur ADMINISTRATOR
    await prisma.conventionCollaborator.create({
      data: {
        conventionId: convention.id,
        userId: event.context.user.id,
        role: 'ADMINISTRATOR',
        addedById: event.context.user.id,
      },
    });

    // Retourner la convention avec les collaborateurs inclus
    const conventionWithCollaborators = await prisma.convention.findUnique({
      where: { id: convention.id },
      include: {
        author: {
          select: {
            id: true,
            pseudo: true,
            email: true,
          },
        },
        collaborators: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                email: true,
              },
            },
            addedBy: {
              select: {
                id: true,
                pseudo: true,
              },
            },
          },
        },
      },
    });

    return conventionWithCollaborators;
  } catch (error) {
    // Gestion des erreurs de validation Zod
    if (error instanceof z.ZodError) {
      return handleValidationError(error);
    }
    
    // Si c'est déjà une erreur HTTP, la relancer
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }
    
    console.error('Erreur lors de la création de la convention:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur lors de la création de la convention',
    });
  }
});