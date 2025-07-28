import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CollaboratorDeletionOptions {
  entityType: 'convention' | 'edition';
  entityId: number;
  collaboratorId: number;
  userId: number;
}

export interface CollaboratorDeletionResult {
  success: boolean;
  message: string;
}

/**
 * Vérifie les permissions pour supprimer un collaborateur d'une convention
 */
export async function checkConventionCollaboratorPermission(
  conventionId: number,
  collaboratorId: number,
  userId: number
): Promise<{ convention: any; collaborator: any }> {
  // Vérifier que la convention existe et que l'utilisateur est le créateur
  const convention = await prisma.convention.findUnique({
    where: { id: conventionId },
    select: { id: true, authorId: true }
  });

  if (!convention) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Convention introuvable'
    });
  }

  if (convention.authorId !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Seul le créateur peut retirer des collaborateurs'
    });
  }

  // Vérifier que le collaborateur existe
  const collaborator = await prisma.conventionCollaborator.findUnique({
    where: { id: collaboratorId },
    include: {
      user: {
        select: { pseudo: true }
      }
    }
  });

  if (!collaborator || collaborator.conventionId !== conventionId) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Collaborateur introuvable'
    });
  }

  return { convention, collaborator };
}

/**
 * Vérifie les permissions pour supprimer un collaborateur d'une édition
 */
export async function checkEditionCollaboratorPermission(
  editionId: number,
  collaboratorId: number,
  userId: number
): Promise<{ edition: any; collaborator: any }> {
  // Vérifier que l'édition existe et que l'utilisateur est le créateur
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: { id: true, creatorId: true }
  });

  if (!edition) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Edition introuvable'
    });
  }

  if (edition.creatorId !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Seul le créateur peut retirer des collaborateurs'
    });
  }

  // Vérifier que le collaborateur existe
  const collaborator = await prisma.editionCollaborator.findUnique({
    where: { id: collaboratorId },
    include: {
      user: {
        select: { pseudo: true }
      }
    }
  });

  if (!collaborator || collaborator.editionId !== editionId) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Collaborateur introuvable'
    });
  }

  return { edition, collaborator };
}

/**
 * Supprime un collaborateur de l'entité
 */
export async function deleteCollaboratorFromEntity(
  options: CollaboratorDeletionOptions
): Promise<CollaboratorDeletionResult> {
  try {
    let collaborator: any;

    // Vérifier les permissions selon le type d'entité
    if (options.entityType === 'convention') {
      const result = await checkConventionCollaboratorPermission(
        options.entityId,
        options.collaboratorId,
        options.userId
      );
      collaborator = result.collaborator;

      // Supprimer le collaborateur de la convention
      await prisma.conventionCollaborator.delete({
        where: { id: options.collaboratorId }
      });
    } else {
      const result = await checkEditionCollaboratorPermission(
        options.entityId,
        options.collaboratorId,
        options.userId
      );
      collaborator = result.collaborator;

      // Supprimer le collaborateur de l'édition
      await prisma.editionCollaborator.delete({
        where: { id: options.collaboratorId }
      });
    }

    return {
      success: true,
      message: `${collaborator.user.pseudo} a été retiré des collaborateurs`
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
}

/**
 * Fonctions spécialisées pour chaque type d'entité
 */
export async function deleteConventionCollaborator(
  conventionId: number,
  collaboratorId: number,
  userId: number
): Promise<CollaboratorDeletionResult> {
  return deleteCollaboratorFromEntity({
    entityType: 'convention',
    entityId: conventionId,
    collaboratorId,
    userId
  });
}

export async function deleteEditionCollaborator(
  editionId: number,
  collaboratorId: number,
  userId: number
): Promise<CollaboratorDeletionResult> {
  return deleteCollaboratorFromEntity({
    entityType: 'edition',
    entityId: editionId,
    collaboratorId,
    userId
  });
}