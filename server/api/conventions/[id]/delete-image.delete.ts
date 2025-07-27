import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import { join } from 'path';

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
      statusMessage: 'ID d’édition invalide',
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

    // Supprimer le fichier physique si il existe
    if (edition.imageUrl) {
      // Extraire le chemin du fichier depuis l'URL
      const urlParts = edition.imageUrl.split('/');
      if (urlParts.includes('uploads') && urlParts.includes('conventions')) {
        const imageEditionId = urlParts[urlParts.indexOf('conventions') + 1];
        const filename = urlParts[urlParts.length - 1];
        
        if (imageEditionId === editionId.toString() && (filename.startsWith('convention-') || filename.startsWith('edition-'))) {
          const filePath = join(process.cwd(), 'public', 'uploads', 'conventions', imageEditionId, filename);
          try {
            await fs.unlink(filePath);
            console.log('Image d’édition supprimée:', filePath);
            
            // Essayer de supprimer le dossier s'il est vide
            const dirPath = join(process.cwd(), 'public', 'uploads', 'conventions', imageEditionId);
            try {
              await fs.rmdir(dirPath);
              console.log('Dossier d’édition supprimé:', dirPath);
            } catch {
              // Le dossier n'est pas vide ou erreur, on ignore
            }
          } catch (error) {
            console.error('Erreur lors de la suppression de l\'image:', error);
          }
        }
      }
    }

    // Mettre à jour l'édition
    const updatedEdition = await prisma.edition.update({
      where: { id: editionId },
      data: { imageUrl: null },
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
    console.error('Erreur lors de la suppression de l\'image d’édition:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la suppression de l\'image',
    });
  }
});