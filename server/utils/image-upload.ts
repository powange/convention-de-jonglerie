import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { copyToOutputPublic } from './copy-to-output';
import { prisma } from './prisma';

export interface ImageUploadOptions {
  allowedTypes?: string[];
  maxSize?: number; // en bytes
  prefix: string;
  destinationFolder: string;
  entityId?: string | number;
  fieldName?: string; // nom du champ dans le formulaire
  deleteOldImage?: boolean;
  copyToOutput?: boolean;
}

export interface ImageUploadResult {
  success: boolean;
  imageUrl: string;
  filename: string;
}

/**
 * Valide un fichier image selon les critères fournis
 */
export async function validateImageFile(
  file: any,
  options: ImageUploadOptions
): Promise<void> {
  if (!file || !file.data) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Fichier image requis',
    });
  }

  // Vérifier le type MIME
  const allowedTypes = options.allowedTypes || [
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'image/webp'
  ];
  
  if (!file.type || !allowedTypes.includes(file.type)) {
    const typesString = allowedTypes
      .map(type => type.split('/')[1].toUpperCase())
      .join(', ');
    throw createError({
      statusCode: 400,
      statusMessage: `Type de fichier non autorisé. Formats acceptés: ${typesString}`,
    });
  }

  // Vérifier la taille
  const maxSize = options.maxSize || 5 * 1024 * 1024; // 5MB par défaut
  if (file.data.length > maxSize) {
    const sizeInMB = Math.round(maxSize / (1024 * 1024));
    throw createError({
      statusCode: 400,
      statusMessage: `Fichier trop volumineux. Taille maximale: ${sizeInMB}MB`,
    });
  }
}

/**
 * Génère un nom de fichier unique
 */
export function generateUniqueFilename(
  file: any,
  prefix: string,
  entityId?: string | number
): string {
  const timestamp = Date.now();
  const uuid = randomUUID().substring(0, 8);
  
  // Déterminer l'extension
  let extension = 'jpg';
  if (file.type) {
    extension = file.type.split('/')[1];
    if (extension === 'jpeg') extension = 'jpg';
  } else if (file.filename) {
    extension = file.filename.split('.').pop() || 'jpg';
  }

  if (entityId) {
    return `${prefix}-${entityId}-${timestamp}-${uuid}.${extension}`;
  } else {
    return `${prefix}-${timestamp}-${uuid}.${extension}`;
  }
}

/**
 * Supprime l'ancienne image si elle existe
 */
export async function deleteOldImage(
  imageUrl: string | null,
  uploadsDir: string,
  prefix: string
): Promise<void> {
  if (!imageUrl) return;

  try {
    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    
    // Vérifier que le fichier correspond au préfixe attendu (sécurité)
    if (filename && filename.startsWith(prefix)) {
      const filePath = join(uploadsDir, filename);
      await fs.unlink(filePath);
      console.log('Ancienne image supprimée:', filePath);
    }
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'ancienne image:', error);
    // Ne pas échouer si la suppression rate
  }
}

/**
 * Effectue l'upload d'une image avec toutes les validations et traitements
 */
export async function handleImageUpload(
  event: any,
  options: ImageUploadOptions
): Promise<ImageUploadResult> {
  try {
    // Lire les données du formulaire
    const formData = await readMultipartFormData(event);
    if (!formData || formData.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Aucun fichier fourni',
      });
    }

    // Trouver le fichier image
    const fieldName = options.fieldName || 'image';
    const file = formData.find(item => item.name === fieldName) || formData[0];
    
    // Valider le fichier
    await validateImageFile(file, options);

    // Générer le nom de fichier unique
    const filename = generateUniqueFilename(file, options.prefix, options.entityId);

    // Créer le dossier de destination
    const uploadsDir = join(
      process.cwd(), 
      'public', 
      'uploads', 
      options.destinationFolder,
      ...(options.entityId ? [options.entityId.toString()] : [])
    );
    
    await fs.mkdir(uploadsDir, { recursive: true });

    // Sauvegarder le fichier
    const filePath = join(uploadsDir, filename);
    await fs.writeFile(filePath, file.data);

    // Construire l'URL publique
    let imageUrl: string;
    if (options.entityId) {
      imageUrl = `/uploads/${options.destinationFolder}/${options.entityId}/${filename}`;
    } else {
      imageUrl = `/uploads/${options.destinationFolder}/${filename}`;
    }

    // Copier vers .output/public si nécessaire (production Docker)
    if (options.copyToOutput) {
      const outputPath = options.entityId 
        ? `uploads/${options.destinationFolder}/${options.entityId}/${filename}`
        : `uploads/${options.destinationFolder}/${filename}`;
      await copyToOutputPublic(outputPath);
    }

    return {
      success: true,
      imageUrl,
      filename,
    };

  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }
    
    console.error('Erreur lors de l\'upload d\'image:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur lors de l\'upload de l\'image',
    });
  }
}

/**
 * Vérifie les permissions pour l'upload d'image d'une convention
 */
export async function checkConventionUploadPermission(
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
 * Vérifie les permissions pour l'upload d'image d'une édition
 */
export async function checkEditionUploadPermission(
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
 * Met à jour l'entité avec la nouvelle URL d'image
 */
export async function updateEntityWithImage<T = any>(
  entityType: 'convention' | 'edition' | 'user',
  entityId: number,
  imageUrl: string,
  imageField: string = 'logo'
): Promise<T> {
  const prismaModel = {
    convention: prisma.convention,
    edition: prisma.edition,
    user: prisma.user,
  }[entityType];

  const updateData = { [imageField]: imageUrl };
  
  // Inclure les relations nécessaires selon le type d'entité
  const include = entityType === 'convention' 
    ? { author: { select: { id: true, pseudo: true, email: true } } }
    : entityType === 'edition'
    ? { 
        creator: { select: { id: true, email: true, pseudo: true } },
        favoritedBy: { select: { id: true } },
      }
    : undefined;

  return await prismaModel.update({
    where: { id: entityId },
    data: updateData,
    ...(include && { include }),
  }) as T;
}