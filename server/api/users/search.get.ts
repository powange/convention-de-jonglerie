import { PrismaClient } from '@prisma/client';
import { getEmailHash } from '../../utils/email-hash';
import { requireUserSession } from '#auth-utils'

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  try {
  // Vérifier l'authentification via la session scellée
  const { user } = await requireUserSession(event)

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
  NOT: { id: user.id }
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
    const transformedUsers = users.map(u => ({
      id: u.id,
      pseudo: u.pseudo,
      profilePicture: u.profilePicture,
      emailHash: getEmailHash(u.email)
    }));

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