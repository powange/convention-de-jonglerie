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

    // Supprimer le fichier physique si il existe
    if (convention.imageUrl) {
      // Extraire le chemin du fichier depuis l'URL
      const urlParts = convention.imageUrl.split('/');
      if (urlParts.includes('uploads') && urlParts.includes('conventions')) {
        const imageConventionId = urlParts[urlParts.indexOf('conventions') + 1];
        const filename = urlParts[urlParts.length - 1];
        
        if (imageConventionId === conventionId.toString() && filename.startsWith('convention-')) {
          const filePath = join(process.cwd(), 'public', 'uploads', 'conventions', imageConventionId, filename);
          try {
            await fs.unlink(filePath);
            console.log('Image de convention supprimée:', filePath);
            
            // Essayer de supprimer le dossier s'il est vide
            const dirPath = join(process.cwd(), 'public', 'uploads', 'conventions', imageConventionId);
            try {
              await fs.rmdir(dirPath);
              console.log('Dossier de convention supprimé:', dirPath);
            } catch {
              // Le dossier n'est pas vide ou erreur, on ignore
            }
          } catch (error) {
            console.error('Erreur lors de la suppression de l\'image:', error);
          }
        }
      }
    }

    // Mettre à jour la convention
    const updatedConvention = await prisma.convention.update({
      where: { id: conventionId },
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
      convention: updatedConvention,
    };
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'image de convention:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la suppression de l\'image',
    });
  }
});