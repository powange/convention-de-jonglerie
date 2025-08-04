import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { getEmailHash } from '../../utils/email-hash';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  try {
    // Vérifier l'authentification
    const authorization = getCookie(event, 'authToken') || getHeader(event, 'authorization');
    
    if (!authorization) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Non autorisé',
      });
    }

    const token = authorization.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };

    if (!decoded.userId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Token invalide',
      });
    }

    // Récupérer le paramètre de recherche
    const query = getQuery(event);
    const searchQuery = query.q as string;

    if (!searchQuery || searchQuery.length < 2) {
      return [];
    }

    // Rechercher les utilisateurs par email ou pseudo
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: searchQuery } },
          { pseudo: { contains: searchQuery } }
        ],
        // Exclure l'utilisateur actuel
        NOT: { id: decoded.userId }
      },
      select: {
        id: true,
        pseudo: true,
        profilePicture: true,
        email: true
      },
      take: 10, // Limiter à 10 résultats
      orderBy: { pseudo: 'asc' }
    });

    // Transformer les emails en emailHash
    const transformedUsers = users.map(user => ({
      ...user,
      emailHash: getEmailHash(user.email),
      email: undefined
    } as any));

    return transformedUsers;

  } catch (error) {
    console.error('Erreur lors de la recherche d\'utilisateurs:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Token invalide',
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la recherche',
    });
  }
});