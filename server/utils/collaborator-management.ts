import { CollaboratorRole } from '@prisma/client';
import type { ConventionCollaborator, User } from '~/app/types';
import { prisma } from './prisma';

export interface CollaboratorPermissionCheck {
  hasPermission: boolean;
  userRole?: CollaboratorRole;
  isOwner: boolean;
  isCollaborator: boolean;
}

/**
 * Vérifie les permissions d'un utilisateur sur une convention
 */
export async function checkUserConventionPermission(
  conventionId: number,
  userId: number
): Promise<CollaboratorPermissionCheck> {
  // Vérifier si l'utilisateur est le créateur
  const convention = await prisma.convention.findUnique({
    where: { id: conventionId },
    select: { authorId: true }
  });

  if (!convention) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Convention introuvable'
    });
  }

  const isOwner = convention.authorId === userId;

  // Vérifier si l'utilisateur est un collaborateur
  const collaborator = await prisma.conventionCollaborator.findUnique({
    where: {
      conventionId_userId: {
        conventionId,
        userId
      }
    }
  });

  return {
    hasPermission: isOwner || !!collaborator,
    userRole: collaborator?.role,
    isOwner,
    isCollaborator: !!collaborator
  };
}

/**
 * Vérifie si un utilisateur peut gérer les collaborateurs d'une convention
 */
export async function canManageCollaborators(
  conventionId: number,
  userId: number
): Promise<boolean> {
  const permission = await checkUserConventionPermission(conventionId, userId);
  
  // Seuls le propriétaire et les administrateurs peuvent gérer les collaborateurs
  return permission.isOwner || permission.userRole === CollaboratorRole.ADMINISTRATOR;
}

/**
 * Vérifie si un utilisateur peut éditer une convention
 */
export async function canEditConvention(
  conventionId: number,
  userId: number
): Promise<boolean> {
  const permission = await checkUserConventionPermission(conventionId, userId);
  
  // Seuls le propriétaire et les administrateurs peuvent éditer la convention
  return permission.isOwner || permission.userRole === CollaboratorRole.ADMINISTRATOR;
}

/**
 * Vérifie si un utilisateur peut éditer une édition
 */
export async function canEditEdition(
  editionId: number,
  userId: number
): Promise<boolean> {
  // Récupérer l'édition avec sa convention
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: { 
      creatorId: true,
      conventionId: true 
    }
  });

  if (!edition) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Édition introuvable'
    });
  }

  // Vérifier si l'utilisateur est le créateur de l'édition
  if (edition.creatorId === userId) {
    return true;
  }

  // Vérifier les permissions sur la convention
  const permission = await checkUserConventionPermission(edition.conventionId, userId);
  
  // Tous les collaborateurs peuvent éditer les éditions (modérateurs et administrateurs)
  return permission.hasPermission;
}

/**
 * Ajoute un collaborateur à une convention
 */
export async function addConventionCollaborator(
  conventionId: number,
  userToAddId: number,
  role: CollaboratorRole,
  addedById: number
): Promise<ConventionCollaborator & { user: Pick<User, 'id' | 'pseudo'> }> {
  // Vérifier les permissions
  const canManage = await canManageCollaborators(conventionId, addedById);
  
  if (!canManage) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Seuls les administrateurs peuvent ajouter des collaborateurs'
    });
  }

  // Vérifier que l'utilisateur existe
  const userToAdd = await prisma.user.findUnique({
    where: { id: userToAddId },
    select: { id: true, pseudo: true }
  });

  if (!userToAdd) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Utilisateur introuvable'
    });
  }

  // Créer le collaborateur
  return await prisma.conventionCollaborator.create({
    data: {
      conventionId,
      userId: userToAddId,
      role,
      addedById
    },
    include: {
      user: {
        select: { id: true, pseudo: true }
      }
    }
  });
}

/**
 * Recherche un utilisateur par pseudo ou email
 */
export async function findUserByPseudoOrEmail(
  searchTerm: string
): Promise<Pick<User, 'id' | 'pseudo'> | null> {
  return await prisma.user.findFirst({
    where: {
      OR: [
        { pseudo: searchTerm },
        { email: searchTerm }
      ]
    },
    select: {
      id: true,
      pseudo: true
    }
  });
}

/**
 * Supprime un collaborateur d'une convention
 */
export async function deleteConventionCollaborator(
  conventionId: number,
  collaboratorId: number,
  userId: number
): Promise<{ success: boolean; message: string }> {
  // Vérifier les permissions
  const canManage = await canManageCollaborators(conventionId, userId);
  
  if (!canManage) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Seuls les administrateurs peuvent retirer des collaborateurs'
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

  // Empêcher l'utilisateur de se supprimer lui-même
  if (collaborator.userId === userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Vous ne pouvez pas vous retirer vous-même des collaborateurs'
    });
  }

  // Supprimer le collaborateur
  await prisma.conventionCollaborator.delete({
    where: { id: collaboratorId }
  });

  return {
    success: true,
    message: `${collaborator.user.pseudo} a été retiré des collaborateurs`
  };
}

/**
 * Récupère tous les collaborateurs d'une convention
 */
export async function getConventionCollaborators(
  conventionId: number
): Promise<(ConventionCollaborator & {
  user: Pick<User, 'id' | 'pseudo'>;
  addedBy: Pick<User, 'pseudo'>;
})[]> {
  return await prisma.conventionCollaborator.findMany({
    where: { conventionId },
    include: {
      user: {
        select: {
          id: true,
          pseudo: true
        }
      },
      addedBy: {
        select: {
          pseudo: true
        }
      }
    },
    orderBy: {
      addedAt: 'desc'
    }
  });
}

/**
 * Met à jour le rôle d'un collaborateur
 */
export async function updateCollaboratorRole(
  conventionId: number,
  collaboratorId: number,
  newRole: CollaboratorRole,
  userId: number
): Promise<ConventionCollaborator & {
  user: Pick<User, 'id' | 'pseudo'>;
}> {
  // Vérifier les permissions
  const canManage = await canManageCollaborators(conventionId, userId);
  
  if (!canManage) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Seuls les administrateurs peuvent modifier les rôles'
    });
  }

  // Vérifier que le collaborateur existe
  const collaborator = await prisma.conventionCollaborator.findUnique({
    where: { id: collaboratorId }
  });

  if (!collaborator || collaborator.conventionId !== conventionId) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Collaborateur introuvable'
    });
  }

  // Mettre à jour le rôle
  return await prisma.conventionCollaborator.update({
    where: { id: collaboratorId },
    data: { role: newRole },
    include: {
      user: {
        select: {
          id: true,
          pseudo: true
        }
      }
    }
  });
}