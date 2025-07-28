import { 
  handleImageUpload, 
  updateEntityWithImage,
  deleteOldImage
} from '../../utils/image-upload';
import { prisma } from '../../utils/prisma';


export default defineEventHandler(async (event) => {
  const user = event.context.user;
  
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    });
  }

  try {
    // Récupérer l'utilisateur actuel pour avoir l'ancienne photo
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { profilePicture: true },
    });
    
    // Supprimer l'ancienne photo si elle existe
    if (currentUser?.profilePicture) {
      await deleteOldImage(
        currentUser.profilePicture,
        'public/uploads/profiles',
        'profile-'
      );
    }

    // Effectuer l'upload
    const uploadResult = await handleImageUpload(event, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      maxSize: 5 * 1024 * 1024, // 5MB
      prefix: 'profile',
      destinationFolder: 'profiles',
      entityId: user.id,
      fieldName: 'profilePicture',
      copyToOutput: false, // Pas de copie vers output pour les profils
    });

    // Mettre à jour l'utilisateur
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { profilePicture: uploadResult.imageUrl },
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
      profilePicture: uploadResult.imageUrl,
      user: updatedUser,
    };
  } catch (error: unknown) {
    const httpError = error as { statusCode?: number; message?: string };
    if (httpError.statusCode) {
      throw error;
    }
    
    console.error('Erreur lors de l\'upload de la photo de profil:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de l\'upload de la photo de profil',
    });
  }
});