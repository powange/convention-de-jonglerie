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

  const editionId = parseInt(getRouterParam(event, 'id') as string);
  
  if (!editionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID d\'édition invalide',
    });
  }

  try {
    // Vérifier que l'utilisateur est autorisé à modifier cette édition
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        collaborators: {
          where: {
            userId: user.id,
            canEdit: true,
          },
        },
      },
    });

    if (!edition || (edition.creatorId !== user.id && edition.collaborators.length === 0)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Non autorisé à modifier cette édition',
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
    const maxSize = 10 * 1024 * 1024; // 10MB pour les éditions

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
    const filename = `edition-${editionId}-${randomUUID()}.${extension}`;
    
    // Créer le dossier uploads/conventions/[id] s'il n'existe pas
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'conventions', editionId.toString());
    try {
      await fs.access(uploadsDir);
    } catch {
      await fs.mkdir(uploadsDir, { recursive: true });
    }

    // Sauvegarder le fichier
    const filePath = join(uploadsDir, filename);
    await fs.writeFile(filePath, file.data);

    // Supprimer l'ancienne image si elle existe
    if (edition.imageUrl) {
      // Extraire le chemin du fichier depuis l'URL
      const urlParts = edition.imageUrl.split('/');
      if (urlParts.includes('uploads') && urlParts.includes('conventions')) {
        const oldEditionId = urlParts[urlParts.indexOf('conventions') + 1];
        const oldFilename = urlParts[urlParts.length - 1];
        
        if (oldEditionId === editionId.toString() && (oldFilename.startsWith('convention-') || oldFilename.startsWith('edition-'))) {
          const oldFilePath = join(process.cwd(), 'public', 'uploads', 'conventions', oldEditionId, oldFilename);
          try {
            await fs.unlink(oldFilePath);
            console.log('Ancienne image d\'édition supprimée:', oldFilePath);
          } catch (error) {
            console.error('Erreur lors de la suppression de l\'ancienne image:', error);
          }
        }
      }
    }

    // URL publique de l'image
    const imageUrl = `/uploads/conventions/${editionId}/${filename}`;

    // Mettre à jour l'édition
    const updatedEdition = await prisma.edition.update({
      where: { id: editionId },
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
      edition: updatedEdition,
    };
  } catch (error) {
    console.error('Erreur lors de l\'upload de l\'image d\'édition:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de l\'upload de l\'image',
    });
  }
});