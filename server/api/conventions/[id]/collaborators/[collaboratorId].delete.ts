import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  try {
    const conventionId = parseInt(getRouterParam(event, 'id') as string);
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

    // Vérifier que la convention existe et que l'utilisateur est le créateur
    const convention = await prisma.convention.findUnique({
      where: { id: conventionId },
      select: { id: true, creatorId: true }
    });

    if (!convention) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Convention introuvable'
      });
    }

    if (convention.creatorId !== decoded.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Seul le créateur peut retirer des collaborateurs'
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

    // Supprimer le collaborateur
    await prisma.conventionCollaborator.delete({
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