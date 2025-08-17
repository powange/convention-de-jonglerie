import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  try {
    // Vérifier que c'est une requête POST
    if (getMethod(event) !== 'POST') {
      throw createError({
        statusCode: 405,
        statusMessage: 'Méthode non autorisée'
      });
    }

    // Récupérer l'ID de l'offre depuis l'URL
    const offerId = parseInt(getRouterParam(event, 'id')!);
    if (isNaN(offerId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID d\'offre invalide'
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
    
    let decoded;
    try {
  const { getJwtSecret } = await import('../../../utils/jwt')
      decoded = jwt.verify(token, getJwtSecret()) as { userId?: number };
    } catch {
      throw createError({
        statusCode: 401,
        statusMessage: 'Token invalide'
      });
    }

    // Récupérer les données du body
    const body = await readBody(event);
    const { userId } = body;

    if (!userId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID utilisateur requis'
      });
    }

    // Vérifier que l'offre existe et récupérer ses détails
    const offer = await prisma.carpoolOffer.findUnique({
      where: { id: offerId },
      include: {
        passengers: true,
        user: true
      }
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
        statusMessage: 'Seul le créateur de l\'offre peut ajouter des covoitureurs'
      });
    }

    // Vérifier que l'utilisateur à ajouter existe
    const userToAdd = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!userToAdd) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Utilisateur introuvable'
      });
    }

    // Vérifier que l'utilisateur n'est pas déjà passager
    const existingPassenger = await prisma.carpoolPassenger.findUnique({
      where: {
        carpoolOfferId_userId: {
          carpoolOfferId: offerId,
          userId: userId
        }
      }
    });

    if (existingPassenger) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cet utilisateur est déjà covoitureur de cette offre'
      });
    }

    // Vérifier qu'il reste des places disponibles
    const currentPassengers = offer.passengers.length;
    if (currentPassengers >= offer.availableSeats) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Plus de places disponibles dans cette offre'
      });
    }

    // Vérifier que ce n'est pas le créateur de l'offre qui s'ajoute lui-même
    if (userId === offer.userId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Le créateur de l\'offre ne peut pas s\'ajouter comme passager'
      });
    }

    // Ajouter le covoitureur
    const passenger = await prisma.carpoolPassenger.create({
      data: {
        carpoolOfferId: offerId,
        userId: userId,
        addedById: decoded.userId
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            profilePicture: true
          }
        }
      }
    });

    return {
      success: true,
      passenger: passenger
    };

  } catch (error) {
    if (error.statusCode) {
      throw error;
    }
    
    console.error('Erreur lors de l\'ajout du covoitureur:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur interne du serveur'
    });
  }
});