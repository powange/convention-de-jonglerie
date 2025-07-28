import { PrismaClient } from '@prisma/client';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { copyToOutputPublic } from '../../../utils/copy-to-output';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié',
    });
  }

  try {
    const conventionId = parseInt(getRouterParam(event, 'id') as string);
    
    if (isNaN(conventionId)) {
      throw createError({
        statusCode: 400,
        message: 'ID de convention invalide',
      });
    }

    // Vérifier que la convention existe et que l'utilisateur est l'auteur
    const convention = await prisma.convention.findUnique({
      where: { id: conventionId },
    });

    if (!convention) {
      throw createError({
        statusCode: 404,
        message: 'Convention introuvable',
      });
    }

    if (convention.authorId !== event.context.user.id) {
      throw createError({
        statusCode: 403,
        message: 'Vous n\'avez pas les droits pour modifier cette convention',
      });
    }

    // Traiter le fichier uploadé
    const formData = await readMultipartFormData(event);
    
    if (!formData || formData.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Aucun fichier fourni',
      });
    }

    const file = formData.find(item => item.name === 'image');
    
    if (!file || !file.data) {
      throw createError({
        statusCode: 400,
        message: 'Fichier image requis',
      });
    }

    // Vérifier le type de fichier
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!file.type || !allowedTypes.includes(file.type)) {
      throw createError({
        statusCode: 400,
        message: 'Type de fichier non autorisé. Formats acceptés: JPG, PNG, WEBP',
      });
    }

    // Vérifier la taille du fichier (5MB max)
    if (file.data.length > 5 * 1024 * 1024) {
      throw createError({
        statusCode: 400,
        message: 'Le fichier est trop volumineux. Taille maximum: 5MB',
      });
    }

    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const extension = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
    const filename = `logo-${timestamp}.${extension}`;

    // Créer le dossier de destination
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'conventions', conventionId.toString());
    await mkdir(uploadDir, { recursive: true });

    // Sauvegarder le fichier
    const filePath = join(uploadDir, filename);
    await writeFile(filePath, file.data);

    // Copier vers .output/public en production
    await copyToOutputPublic(`uploads/conventions/${conventionId}/${filename}`);

    // Construire l'URL publique
    const imageUrl = `/uploads/conventions/${conventionId}/${filename}`;

    // Mettre à jour la convention avec la nouvelle URL du logo
    const updatedConvention = await prisma.convention.update({
      where: { id: conventionId },
      data: { logo: imageUrl },
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

    return {
      success: true,
      imageUrl,
      convention: updatedConvention,
    };

  } catch (error) {
    // Si c'est déjà une erreur HTTP, la relancer
    if (error.statusCode) {
      throw error;
    }
    
    console.error('Erreur lors de l\'upload de l\'image:', error);
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur lors de l\'upload de l\'image',
    });
  }
});