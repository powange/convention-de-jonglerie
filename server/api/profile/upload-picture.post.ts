import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

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
    const formData = await readMultipartFormData(event);
    
    if (!formData) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Aucun fichier fourni',
      });
    }

    const file = formData.find(field => field.name === 'profilePicture');
    
    if (!file || !file.data) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Fichier image requis',
      });
    }

    // Vérifier le type MIME
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimeTypes.includes(file.type || '')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Format d\'image non supporté. Utilisez JPG, PNG, GIF ou WebP.',
      });
    }

    // Vérifier la taille (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.data.length > maxSize) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Fichier trop volumineux. Taille maximale : 5MB.',
      });
    }

    // Générer un nom de fichier unique
    const extension = file.filename?.split('.').pop() || 'jpg';
    const filename = `profile-${user.id}-${randomUUID()}.${extension}`;
    
    // Créer le dossier uploads/profiles s'il n'existe pas
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'profiles');
    try {
      await fs.access(uploadsDir);
    } catch {
      await fs.mkdir(uploadsDir, { recursive: true });
    }

    // Sauvegarder le fichier
    const filePath = join(uploadsDir, filename);
    await fs.writeFile(filePath, file.data);

    // Récupérer l'utilisateur actuel depuis la BD pour avoir le profilePicture à jour
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { profilePicture: true },
    });
    
    // Supprimer l'ancienne photo si elle existe
    if (currentUser?.profilePicture) {
      const oldFilename = currentUser.profilePicture.split('/').pop();
      if (oldFilename && oldFilename.startsWith('profile-')) {
        const oldFilePath = join(uploadsDir, oldFilename);
        try {
          await fs.unlink(oldFilePath);
          console.log('Ancienne photo supprimée:', oldFilePath);
        } catch (error) {
          console.error('Erreur lors de la suppression de l\'ancienne photo:', error);
          // Continuer même si la suppression échoue
        }
      }
    }

    // URL publique de l'image
    const imageUrl = `/uploads/profiles/${filename}`;

    // Mettre à jour l'utilisateur
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { profilePicture: imageUrl },
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
      profilePicture: imageUrl,
      user: updatedUser,
    };
  } catch (error) {
    console.error('Erreur lors de l\'upload de la photo de profil:', error);
    
    if (error.statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de l\'upload de la photo de profil',
    });
  }
});