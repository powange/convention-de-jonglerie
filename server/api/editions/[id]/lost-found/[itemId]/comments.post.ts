import { prisma } from '../../../../../utils/prisma';
import jwt from 'jsonwebtoken';

export default defineEventHandler(async (event) => {
  try {
    const editionId = parseInt(getRouterParam(event, 'id') as string);
    const itemId = parseInt(getRouterParam(event, 'itemId') as string);
    const body = await readBody(event);

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

    // Valider le contenu
    const { content } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Le contenu du commentaire est requis',
      });
    }

    // Créer le commentaire
    const comment = await prisma.lostFoundComment.create({
      data: {
        lostFoundItemId: itemId,
        userId,
        content: content.trim()
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
        }
      }
    });

    return comment;
  } catch (error) {
    console.error('Erreur lors de la création du commentaire:', error);
    
    if (error.statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur interne du serveur',
    });
  }
});