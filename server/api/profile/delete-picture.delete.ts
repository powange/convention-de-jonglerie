import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    });
  }

  try {
    // Récupérer l'utilisateur actuel depuis la BD pour avoir le profilePicture à jour
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { profilePicture: true },
    });
    
    // Supprimer le fichier physique si il existe
    if (currentUser?.profilePicture) {
      const filename = currentUser.profilePicture.split('/').pop();
      if (filename && filename.startsWith('profile-')) {
        const filePath = join(process.cwd(), 'public', 'uploads', 'profiles', filename);
        try {
          await fs.unlink(filePath);
          console.log('Photo supprimée physiquement:', filePath);
        } catch (error) {
          console.error('Erreur lors de la suppression du fichier:', error);
          // Continuer même si la suppression échoue
        }
      }
    }

    // Mettre à jour l'utilisateur
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { profilePicture: null },
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

    return {
      success: true,
      user: updatedUser,
    };
  } catch (error) {
    console.error('Erreur lors de la suppression de la photo de profil:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la suppression de la photo de profil',
    });
  }
});