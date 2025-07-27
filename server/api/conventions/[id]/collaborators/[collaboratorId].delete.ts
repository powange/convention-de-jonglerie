import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  try {
    const editionId = parseInt(getRouterParam(event, 'id') as string);
    const collaboratorId = parseInt(getRouterParam(event, 'collaboratorId') as string);
    
    // Vérifier l'authentification
    const token = getCookie(event, 'auth-token') || getHeader(event, 'authorization')?.replace('Bearer ', '');
    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Token manquant'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

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

    if (edition.creatorId !== decoded.id) {
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

    // Supprimer le collaborateur
    await prisma.editionCollaborator.delete({
      where: { id: collaboratorId }
    });

    return { 
      success: true, 
      message: `${collaborator.user.pseudo} a été retiré des collaborateurs` 
    };
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }
    console.error('Erreur lors de la suppression du collaborateur:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur'
    });
  }
});