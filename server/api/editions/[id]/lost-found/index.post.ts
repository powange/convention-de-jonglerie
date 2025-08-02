import { prisma } from '../../../../utils/prisma';
import jwt from 'jsonwebtoken';
import { hasEditionEditPermission } from '../../../../utils/permissions';

export default defineEventHandler(async (event) => {
  try {
    const editionId = parseInt(getRouterParam(event, 'id') as string);
    const body = await readBody(event);

    if (!editionId || isNaN(editionId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID d\'édition invalide',
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

    // Vérifier que l'édition existe et est terminée
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        convention: {
          include: {
            collaborators: {
              include: { user: true }
            }
          }
        }
      }
    });

    if (!edition) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Édition non trouvée',
      });
    }

    // Vérifier que l'édition est terminée
    const now = new Date();
    if (now <= new Date(edition.endDate)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Les objets trouvés ne peuvent être ajoutés qu\'après la fin de l\'édition',
      });
    }

    // Vérifier que l'utilisateur est un collaborateur
    const hasPermission = await hasEditionEditPermission(userId, editionId);
    if (!hasPermission) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Vous devez être collaborateur pour ajouter un objet trouvé',
      });
    }

    // Valider les données
    const { description, imageUrl } = body;

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'La description est requise',
      });
    }

    // Créer l'objet trouvé
    const lostFoundItem = await prisma.lostFoundItem.create({
      data: {
        editionId,
        userId,
        description: description.trim(),
        imageUrl: imageUrl || null,
        status: 'LOST'
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
          }
        }
      }
    });

    return lostFoundItem;
  } catch (error) {
    console.error('Erreur lors de la création de l\'objet trouvé:', error);
    
    if (error.statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur interne du serveur',
    });
  }
});