import { prisma } from '../../utils/prisma';
import { updateProfileSchema, validateAndSanitize, handleValidationError } from '../../utils/validation-schemas';
import { z } from 'zod';


export default defineEventHandler(async (event) => {
  const user = event.context.user;
  
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    });
  }

  const body = await readBody(event);

  // Validation et sanitisation des données avec Zod
  let validatedData;
  try {
    validatedData = validateAndSanitize(updateProfileSchema, body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      handleValidationError(error);
    }
    throw error;
  }

  const { email, pseudo, nom, prenom, telephone } = validatedData;

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
        telephone,
      },
      select: {
        id: true,
        email: true,
        pseudo: true,
        nom: true,
        prenom: true,
        telephone: true,
        profilePicture: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  } catch (error) {
    console.error('Erreur lors de la mise à jour du profil:', error);
    
    if (error.statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la mise à jour du profil',
    });
  }
});