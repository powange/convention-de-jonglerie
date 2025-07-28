import { PrismaClient } from '@prisma/client';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';

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

    // Vérifier qu'il y a une image à supprimer
    if (!convention.logo) {
      throw createError({
        statusCode: 400,
        message: 'Aucune image à supprimer',
      });
    }

    // Supprimer le fichier physique s'il existe
    try {
      const filePath = join(process.cwd(), 'public', convention.logo);
      await unlink(filePath);
    } catch (fileError) {
      console.warn('Fichier image introuvable ou déjà supprimé:', fileError);
      // On continue même si le fichier n'existe pas
    }

    // Mettre à jour la convention pour supprimer l'URL du logo
    const updatedConvention = await prisma.convention.update({
      where: { id: conventionId },
      data: { logo: null },
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
      message: 'Image supprimée avec succès',
      convention: updatedConvention,
    };

  } catch (error) {
    // Si c'est déjà une erreur HTTP, la relancer
    if (error.statusCode) {
      throw error;
    }
    
    console.error('Erreur lors de la suppression de l\'image:', error);
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur lors de la suppression de l\'image',
    });
  }
});