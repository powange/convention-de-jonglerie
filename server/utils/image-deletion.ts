import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import { join } from 'path';
import { deleteFromBothLocations } from './copy-to-output';

const prisma = new PrismaClient();

export interface ImageDeletionOptions {
  entityType: 'convention' | 'edition' | 'user';
  entityId: number;
  imageField: string;
  useOutputDeletion?: boolean; // Utiliser deleteFromBothLocations (pour conventions)
  pathExtraction?: 'convention' | 'edition' | 'profile'; // Comment extraire le chemin du fichier
}

export interface ImageDeletionResult {
  success: boolean;
  message: string;
  entity: any;
}

/**
 * Vérifie les permissions pour supprimer l'image d'une convention
 */
export async function checkConventionDeletionPermission(
  conventionId: number,
  userId: number
): Promise<any> {
  const convention = await prisma.convention.findUnique({
    where: { id: conventionId },
  });

  if (!convention) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Convention introuvable',
    });
  }

  if (convention.authorId !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Vous n\'avez pas les droits pour modifier cette convention',
    });
  }

  return convention;
}

/**
 * Vérifie les permissions pour supprimer l'image d'une édition
 */
export async function checkEditionDeletionPermission(
  editionId: number,
  userId: number
): Promise<any> {
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    include: {
      collaborators: {
        where: {
          userId: userId,
          canEdit: true,
        },
      },
    },
  });

  if (!edition || (edition.creatorId !== userId && edition.collaborators.length === 0)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Non autorisé à modifier cette édition',
    });
  }

  return edition;
}

/**
 * Supprime physiquement le fichier image
 */
export async function deletePhysicalImageFile(
  imageUrl: string | null,
  options: ImageDeletionOptions
): Promise<void> {
  if (!imageUrl) return;

  try {
    if (options.useOutputDeletion) {
      // Pour les conventions : utiliser deleteFromBothLocations
      const relativePath = imageUrl.startsWith('/') 
        ? imageUrl.substring(1) 
        : imageUrl;
      
      await deleteFromBothLocations(relativePath);
      console.log('Image supprimée des deux emplacements:', relativePath);
    } else {
      // Pour les éditions et profils : suppression directe
      const filePath = extractFilePath(imageUrl, options);
      if (filePath) {
        await fs.unlink(filePath);
        console.log('Image supprimée:', filePath);

        // Pour les éditions : essayer de supprimer le dossier s'il est vide
        if (options.pathExtraction === 'edition') {
          try {
            const dirPath = join(process.cwd(), 'public', 'uploads', 'conventions', options.entityId.toString());
            await fs.rmdir(dirPath);
            console.log('Dossier d\'édition supprimé:', dirPath);
          } catch {
            // Le dossier n'est pas vide ou erreur, on ignore
          }
        }
      }
    }
  } catch (error) {
    console.warn('Erreur lors de la suppression du fichier:', error);
    // On continue même si le fichier n'existe pas
  }
}

/**
 * Extrait le chemin du fichier selon le type d'entité
 */
function extractFilePath(imageUrl: string, options: ImageDeletionOptions): string | null {
  const urlParts = imageUrl.split('/');
  const filename = urlParts[urlParts.length - 1];

  switch (options.pathExtraction) {
    case 'edition': {
      if (urlParts.includes('uploads') && urlParts.includes('conventions')) {
        const imageEditionId = urlParts[urlParts.indexOf('conventions') + 1];
        
        if (imageEditionId === options.entityId.toString() && 
            (filename.startsWith('convention-') || filename.startsWith('edition-'))) {
          return join(process.cwd(), 'public', 'uploads', 'conventions', imageEditionId, filename);
        }
      }
      break;
    }
    case 'profile': {
      if (filename && filename.startsWith('profile-')) {
        return join(process.cwd(), 'public', 'uploads', 'profiles', filename);
      }
      break;
    }
    case 'convention': {
      // Les conventions utilisent deleteFromBothLocations, pas cette fonction
      break;
    }
  }

  return null;
}

/**
 * Met à jour l'entité en supprimant l'URL d'image
 */
export async function updateEntityRemoveImage(
  options: ImageDeletionOptions
): Promise<any> {
  const prismaModel = {
    convention: prisma.convention,
    edition: prisma.edition,
    user: prisma.user,
  }[options.entityType];

  const updateData = { [options.imageField]: null };
  
  // Inclure les relations nécessaires selon le type d'entité
  const include = options.entityType === 'convention' 
    ? { author: { select: { id: true, pseudo: true, email: true } } }
    : options.entityType === 'edition'
    ? { 
        creator: { select: { id: true, email: true, pseudo: true } },
        favoritedBy: { select: { id: true } },
      }
    : options.entityType === 'user'
    ? undefined // Les utilisateurs ont une sélection spécifique
    : undefined;

  if (options.entityType === 'user') {
    // Sélection spécifique pour les utilisateurs
    return await prisma.user.update({
      where: { id: options.entityId },
      data: updateData,
      select: {
        id: true,
        email: true,
        pseudo: true,
        nom: true,
        prenom: true,
        profilePicture: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  return await prismaModel.update({
    where: { id: options.entityId },
    data: updateData,
    ...(include && { include }),
  });
}

/**
 * Fonction principale pour supprimer une image d'entité
 */
export async function handleImageDeletion(
  options: ImageDeletionOptions,
  userId: number
): Promise<ImageDeletionResult> {
  try {
    let entity: any;
    let imageUrl: string | null = null;

    // Vérifier les permissions et récupérer l'entité
    switch (options.entityType) {
      case 'convention':
        entity = await checkConventionDeletionPermission(options.entityId, userId);
        imageUrl = entity[options.imageField];
        break;
      case 'edition':
        entity = await checkEditionDeletionPermission(options.entityId, userId);
        imageUrl = entity[options.imageField];
        break;
      case 'user':
        // Pour les utilisateurs, récupérer depuis la base pour avoir l'image actuelle
        entity = await prisma.user.findUnique({
          where: { id: options.entityId },
          select: { [options.imageField]: true },
        });
        imageUrl = entity?.[options.imageField];
        break;
    }

    // Vérifier qu'il y a une image à supprimer
    if (!imageUrl) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Aucune image à supprimer',
      });
    }

    // Supprimer le fichier physique
    await deletePhysicalImageFile(imageUrl, options);

    // Mettre à jour la base de données
    const updatedEntity = await updateEntityRemoveImage(options);

    return {
      success: true,
      message: 'Image supprimée avec succès',
      entity: updatedEntity,
    };

  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }
    
    console.error('Erreur lors de la suppression de l\'image:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur lors de la suppression de l\'image',
    });
  }
}

/**
 * Fonctions spécialisées pour chaque type d'entité
 */
export async function deleteConventionImage(conventionId: number, userId: number) {
  return handleImageDeletion({
    entityType: 'convention',
    entityId: conventionId,
    imageField: 'logo',
    useOutputDeletion: true,
    pathExtraction: 'convention',
  }, userId);
}

export async function deleteEditionImage(editionId: number, userId: number) {
  return handleImageDeletion({
    entityType: 'edition',
    entityId: editionId,
    imageField: 'imageUrl',
    useOutputDeletion: false,
    pathExtraction: 'edition',
  }, userId);
}

export async function deleteProfilePicture(userId: number) {
  return handleImageDeletion({
    entityType: 'user',
    entityId: userId,
    imageField: 'profilePicture',
    useOutputDeletion: false,
    pathExtraction: 'profile',
  }, userId);
}