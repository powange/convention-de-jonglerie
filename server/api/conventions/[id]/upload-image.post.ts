import { 
  handleImageUpload, 
  checkConventionUploadPermission, 
  updateEntityWithImage,
  deleteOldImage
} from '../../../utils/image-upload';

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    });
  }

  try {
    const conventionId = parseInt(getRouterParam(event, 'id') as string);
    
    if (isNaN(conventionId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID de convention invalide',
      });
    }

    // Vérifier les permissions
    const convention = await checkConventionUploadPermission(conventionId, event.context.user.id);

    // Supprimer l'ancienne image si elle existe
    if (convention.logo) {
      await deleteOldImage(
        convention.logo,
        `public/uploads/conventions/${conventionId}`,
        'logo-'
      );
    }

    // Effectuer l'upload
    const uploadResult = await handleImageUpload(event, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
      maxSize: 5 * 1024 * 1024, // 5MB
      prefix: 'logo',
      destinationFolder: 'conventions',
      entityId: conventionId,
      fieldName: 'image',
      copyToOutput: true,
    });

    // Mettre à jour la convention
    const updatedConvention = await updateEntityWithImage(
      'convention',
      conventionId,
      uploadResult.imageUrl,
      'logo'
    );

    return {
      success: true,
      imageUrl: uploadResult.imageUrl,
      convention: updatedConvention,
    };

  } catch (error: any) {
    // Si c'est déjà une erreur HTTP, la relancer
    if (error.statusCode) {
      throw error;
    }
    
    console.error('Erreur lors de l\'upload de l\'image:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur lors de l\'upload de l\'image',
    });
  }
});