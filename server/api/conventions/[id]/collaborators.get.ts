import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { getEmailHash } from '../../../utils/email-hash';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  try {
    const editionId = parseInt(getRouterParam(event, 'id') as string);
    
    // Vérifier l'authentification
    const token = getCookie(event, 'auth-token') || getHeader(event, 'authorization')?.replace('Bearer ', '');
    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Token manquant'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    event.context.user = decoded;

    // Récupérer l'édition avec ses collaborateurs
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        creator: {
          select: { id: true, pseudo: true }
        },
        collaborators: {
          include: {
            user: true,
            addedBy: {
              select: { id: true, pseudo: true }
            }
          }
        }
      }
    });

    if (!edition) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Edition introuvable'
      });
    }

    // Vérifier que l'utilisateur est le créateur
    if (edition.creatorId !== decoded.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Seul le créateur peut voir les collaborateurs'
      });
    }

    // Transformer les données pour masquer les emails et ajouter les hash
    const transformedCollaborators = edition.collaborators.map(collab => ({
      ...collab,
      user: {
        id: collab.user.id,
        pseudo: collab.user.pseudo,
        prenom: collab.user.prenom,
        nom: collab.user.nom,
        emailHash: getEmailHash(collab.user.email),
        profilePicture: collab.user.profilePicture,
        updatedAt: collab.user.updatedAt,
      },
    }));

    return transformedCollaborators;
  } catch (error) {
    console.error('Erreur lors de la récupération des collaborateurs:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur'
    });
  }
});