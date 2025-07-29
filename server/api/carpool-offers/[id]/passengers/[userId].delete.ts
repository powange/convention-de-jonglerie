import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  try {
    // Vérifier que c'est une requête DELETE
    if (getMethod(event) !== 'DELETE') {
      throw createError({
        statusCode: 405,
        statusMessage: 'Méthode non autorisée'
      });
    }

    // Récupérer les IDs depuis l'URL
    const offerId = parseInt(getRouterParam(event, 'id')!);
    const userId = parseInt(getRouterParam(event, 'userId')!);
    
    if (isNaN(offerId) || isNaN(userId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'IDs invalides'
      });
    }

    // Vérifier l'authentification
    const authHeader = getHeader(event, 'authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Token d\'authentification requis'
      });
    }

    const token = authHeader.substring(7);
    const runtimeConfig = useRuntimeConfig();
    let decoded;
    try {
      decoded = jwt.verify(token, runtimeConfig.jwtSecret) as any;
    } catch (error) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Token invalide'
      });
    }

    // Vérifier que l'offre existe
    const offer = await prisma.carpoolOffer.findUnique({
      where: { id: offerId }
    });

    if (!offer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Offre de covoiturage introuvable'
      });
    }

    // Vérifier que l'utilisateur authentifié est le créateur de l'offre
    if (offer.userId !== decoded.userId) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Seul le créateur de l\'offre peut retirer des covoitureurs'
      });
    }

    // Vérifier que le passager existe
    const passenger = await prisma.carpoolPassenger.findUnique({
      where: {
        carpoolOfferId_userId: {
          carpoolOfferId: offerId,
          userId: userId
        }
      }
    });

    if (!passenger) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Covoitureur introuvable'
      });
    }

    // Supprimer le covoitureur
    await prisma.carpoolPassenger.delete({
      where: {
        carpoolOfferId_userId: {
          carpoolOfferId: offerId,
          userId: userId
        }
      }
    });

    return {
      success: true,
      message: 'Covoitureur retiré avec succès'
    };

  } catch (error) {
    if (error.statusCode) {
      throw error;
    }
    
    console.error('Erreur lors de la suppression du covoitureur:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur interne du serveur'
    });
  }
});