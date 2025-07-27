import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    });
  }

  const body = await readBody(event);
  const { email, pseudo, nom, prenom } = body;

  if (!email || !pseudo || !nom || !prenom) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Tous les champs sont requis',
    });
  }

  try {
    // Vérifier si l'email est déjà utilisé par un autre utilisateur
    if (email !== user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser && existingUser.id !== user.id) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Cette adresse email est déjà utilisée',
        });
      }
    }

    // Vérifier si le pseudo est déjà utilisé par un autre utilisateur
    if (pseudo !== user.pseudo) {
      const existingUser = await prisma.user.findUnique({
        where: { pseudo },
      });

      if (existingUser && existingUser.id !== user.id) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Ce pseudo est déjà utilisé',
        });
      }
    }

    // Mettre à jour le profil
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        email,
        pseudo,
        nom,
        prenom,
      },
      select: {
        id: true,
        email: true,
        pseudo: true,
        nom: true,
        prenom: true,
        profilePicture: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  } catch (error) {
    console.error('Erreur lors de la mise à jour du profil:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la mise à jour du profil',
    });
  }
});