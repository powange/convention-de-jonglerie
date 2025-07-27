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
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Mot de passe actuel et nouveau mot de passe requis',
    });
  }

  try {
    // Récupérer l'utilisateur avec son mot de passe
    const userWithPassword = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        password: true,
      },
    });

    if (!userWithPassword) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Utilisateur non trouvé',
      });
    }

    // Vérifier le mot de passe actuel
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userWithPassword.password);

    if (!isCurrentPasswordValid) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Mot de passe actuel incorrect',
      });
    }

    // Hasher le nouveau mot de passe
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Mettre à jour le mot de passe
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedNewPassword,
      },
    });

    return { success: true, message: 'Mot de passe mis à jour avec succès' };
  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error);
    
    if (error.statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors du changement de mot de passe',
    });
  }
});