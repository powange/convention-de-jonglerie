import jwt from 'jsonwebtoken';
import { hasEditionEditPermission } from '../../../../utils/permissions';
import { handleImageUpload } from '../../../../utils/image-upload';

export default defineEventHandler(async (event) => {
  try {
    const editionId = parseInt(getRouterParam(event, 'id') as string);

    if (!editionId || isNaN(editionId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID d\'édition invalide',
      });
    }

    // Vérifier l'authentification
    const token = getCookie(event, 'auth-token') || getHeader(event, 'authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Token d\'authentification requis',
      });
    }

    const decoded = jwt.verify(token, useRuntimeConfig().jwtSecret) as any;
    const userId = decoded.userId;

    if (!userId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Token invalide',
      });
    }

    // Vérifier que l'utilisateur est un collaborateur
    const hasPermission = await hasEditionEditPermission(userId, editionId);
    if (!hasPermission) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Vous devez être collaborateur pour uploader une image',
      });
    }

    // Upload de l'image en utilisant le système existant
    const uploadResult = await handleImageUpload(event, {
      prefix: 'lost-found',
      destinationFolder: 'lost-found',
      entityId: editionId,
      fieldName: 'image',
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
      maxSize: 5 * 1024 * 1024, // 5MB
      copyToOutput: true
    });

    if (!uploadResult.success) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Erreur lors de l\'upload de l\'image',
      });
    }

    return { imageUrl: uploadResult.imageUrl };
  } catch (error) {
    console.error('Erreur lors de l\'upload de l\'image:', error);
    
    if (error.statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de l\'upload de l\'image',
    });
  }
});