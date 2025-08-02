import { prisma } from '../../../../../utils/prisma';
import jwt from 'jsonwebtoken';
import { hasEditionEditPermission } from '../../../../../utils/permissions';

export default defineEventHandler(async (event) => {
  try {
    const editionId = parseInt(getRouterParam(event, 'id') as string);
    const itemId = parseInt(getRouterParam(event, 'itemId') as string);

    if (!editionId || isNaN(editionId) || !itemId || isNaN(itemId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID invalide',
      });
    }

    // Vérifier l'authentification
    const token = getCookie(event, 'auth-token') || getHeader(event, 'authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Token d\'authentification requis',
      });
    }

    const decoded = jwt.verify(token, useRuntimeConfig().jwtSecret) as any;
    const userId = decoded.userId;

    if (!userId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Token invalide',
      });
    }

    // Vérifier que l'objet trouvé existe et appartient à l'édition
    const lostFoundItem = await prisma.lostFoundItem.findFirst({
      where: {
        id: itemId,
        editionId: editionId
      }
    });

    if (!lostFoundItem) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Objet trouvé non trouvé',
      });
    }

    // Vérifier que l'utilisateur est un collaborateur
    const hasPermission = await hasEditionEditPermission(userId, editionId);
    if (!hasPermission) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Vous devez être collaborateur pour modifier le statut d\'un objet trouvé',
      });
    }

    // Mettre à jour le statut
    const updatedItem = await prisma.lostFoundItem.update({
      where: { id: itemId },
      data: {
        status: lostFoundItem.status === 'RETURNED' ? 'LOST' : 'RETURNED',
        updatedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            prenom: true,
            nom: true,
            profilePicture: true
          }
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                prenom: true,
                nom: true,
                profilePicture: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    return updatedItem;
  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut:', error);
    
    if (error.statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur interne du serveur',
    });
  }
});