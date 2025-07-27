import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    });
  }

  const conventionId = parseInt(getRouterParam(event, 'id') as string);
  
  if (!conventionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID de convention invalide',
    });
  }

  try {
    // Vérifier que l'utilisateur est autorisé à modifier cette convention
    const convention = await prisma.convention.findUnique({
      where: { id: conventionId },
      include: {
        collaborators: {
          where: {
            userId: user.id,
            canEdit: true,
          },
        },
      },
    });

    if (!convention || (convention.creatorId !== user.id && convention.collaborators.length === 0)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Non autorisé à modifier cette convention',
      });
    }

    // Parser le multipart form data
    const form = await readMultipartFormData(event);
    
    if (!form || form.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Aucun fichier fourni',
      });
    }

    const file = form[0];
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB pour les conventions

    if (!file.type || !allowedMimeTypes.includes(file.type)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Format de fichier non supporté. Formats acceptés : JPG, PNG, GIF, WebP.',
      });
    }

    if (file.data.length > maxSize) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Fichier trop volumineux. Taille maximale : 10MB.',
      });
    }

    // Générer un nom de fichier unique
    const extension = file.filename?.split('.').pop() || 'jpg';
    const filename = `convention-${conventionId}-${randomUUID()}.${extension}`;
    
    // Créer le dossier uploads/conventions/[id] s'il n'existe pas
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'conventions', conventionId.toString());
    try {
      await fs.access(uploadsDir);
    } catch {
      await fs.mkdir(uploadsDir, { recursive: true });
    }

    // Sauvegarder le fichier
    const filePath = join(uploadsDir, filename);
    await fs.writeFile(filePath, file.data);

    // Supprimer l'ancienne image si elle existe
    if (convention.imageUrl) {
      // Extraire le chemin du fichier depuis l'URL
      const urlParts = convention.imageUrl.split('/');
      if (urlParts.includes('uploads') && urlParts.includes('conventions')) {
        const oldConventionId = urlParts[urlParts.indexOf('conventions') + 1];
        const oldFilename = urlParts[urlParts.length - 1];
        
        if (oldConventionId === conventionId.toString() && oldFilename.startsWith('convention-')) {
          const oldFilePath = join(process.cwd(), 'public', 'uploads', 'conventions', oldConventionId, oldFilename);
          try {
            await fs.unlink(oldFilePath);
            console.log('Ancienne image de convention supprimée:', oldFilePath);
          } catch (error) {
            console.error('Erreur lors de la suppression de l\'ancienne image:', error);
          }
        }
      }
    }

    // URL publique de l'image
    const imageUrl = `/uploads/conventions/${conventionId}/${filename}`;

    // Mettre à jour la convention
    const updatedConvention = await prisma.convention.update({
      where: { id: conventionId },
      data: { imageUrl },
      include: {
        creator: {
          select: { id: true, email: true, pseudo: true },
        },
        favoritedBy: {
          select: { id: true },
        },
      },
    });

    return {
      success: true,
      convention: updatedConvention,
    };
  } catch (error) {
    console.error('Erreur lors de l\'upload de l\'image de convention:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de l\'upload de l\'image',
    });
  }
});