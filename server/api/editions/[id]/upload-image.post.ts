import { uploadRateLimiter } from '../../../utils/api-rate-limiter'
import {
  handleImageUpload,
  checkEditionUploadPermission,
  updateEntityWithImage,
  deleteOldImage,
} from '../../../utils/image-upload'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    })
  }

  // Appliquer le rate limiting
  await uploadRateLimiter(event)

  const editionId = parseInt(getRouterParam(event, 'id') as string)

  if (!editionId) {
    throw createError({
      statusCode: 400,
      statusMessage: "ID d'édition invalide",
    })
  }

  try {
    // Vérifier les permissions
    const edition = await checkEditionUploadPermission(editionId, user.id)

    // Supprimer l'ancienne image si elle existe
    if (edition.imageUrl) {
      await deleteOldImage(edition.imageUrl, `public/uploads/conventions/${editionId}`, 'edition-')
    }

    // Effectuer l'upload
    const uploadResult = await handleImageUpload(event, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      maxSize: 10 * 1024 * 1024, // 10MB pour les éditions
      prefix: 'edition',
      destinationFolder: 'conventions',
      entityId: editionId,
      fieldName: 'image',
      copyToOutput: false, // Pas de copie vers output pour les éditions
    })

    // Mettre à jour l'édition
    const updatedEdition = await updateEntityWithImage(
      'edition',
      editionId,
      uploadResult.imageUrl,
      'imageUrl'
    )

    return {
      success: true,
      edition: updatedEdition,
    }
  } catch (error: unknown) {
    const httpError = error as { statusCode?: number; message?: string }
    if (httpError.statusCode) {
      throw error
    }

    console.error("Erreur lors de l'upload de l'image d'édition:", error)
    throw createError({
      statusCode: 500,
      statusMessage: "Erreur lors de l'upload de l'image",
    })
  }
})
