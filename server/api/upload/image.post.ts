import { handleImageUpload } from '../../utils/image-upload';

export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    });
  }

  try {
    // Lire les données du formulaire pour déterminer le contexte
    const form = await readMultipartFormData(event);
    const conventionIdField = form?.find(item => item.name === 'conventionId');
    const conventionId = conventionIdField ? conventionIdField.data.toString() : null;

    // Configurer l'upload selon le contexte
    const uploadOptions = conventionId 
      ? {
          // Pour une convention existante
          allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
          maxSize: 5 * 1024 * 1024, // 5MB
          prefix: 'convention',
          destinationFolder: 'conventions',
          entityId: conventionId,
          fieldName: 'image',
          copyToOutput: true,
        }
      : {
          // Pour une nouvelle convention (temporaire)
          allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
          maxSize: 5 * 1024 * 1024, // 5MB
          prefix: 'temp',
          destinationFolder: 'temp',
          fieldName: 'image',
          copyToOutput: true,
        };

    // Effectuer l'upload
    const uploadResult = await handleImageUpload(event, uploadOptions);
    
    return {
      success: true,
      imageUrl: uploadResult.imageUrl,
    };
  } catch (error: unknown) {
    const httpError = error as { statusCode?: number; message?: string };
    if (httpError.statusCode) {
      throw error;
    }
    
    console.error('Erreur lors de l\'upload d\'image:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de l\'upload de l\'image',
    });
  }
});