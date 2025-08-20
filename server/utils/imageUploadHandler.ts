import type { H3Event } from 'h3'
import { authenticateUser } from './auth'

export interface ImageUploadConfig {
  entityName: string
  maxFileSize?: number
  allowedFormats?: string[]
  getEntity?: (id: string) => Promise<any>
  checkPermission?: (userId: string, entity: any) => boolean
  onSuccess?: (entity: any, imageUrl: string) => Promise<void>
}

const defaultConfig: Partial<ImageUploadConfig> = {
  maxFileSize: 5 * 1024 * 1024, // 5 MB
  allowedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
}

export async function createImageUploadHandler(
  event: H3Event,
  config: ImageUploadConfig
) {
  const mergedConfig = { ...defaultConfig, ...config }
  
  try {
    // Authentification
    const user = await authenticateUser(event)
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentification requise'
      })
    }

    // Rate limiting (à implémenter si nécessaire)
    // await checkRateLimit(event, `upload:${user.id}`, 10, 3600000) // 10 uploads par heure

    // Récupération de l'ID depuis l'URL
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID manquant'
      })
    }

    // Récupération de l'entité si nécessaire
    let entity = null
    if (mergedConfig.getEntity) {
      entity = await mergedConfig.getEntity(id)
      if (!entity) {
        throw createError({
          statusCode: 404,
          statusMessage: `${mergedConfig.entityName} non trouvé(e)`
        })
      }
    }

    // Vérification des permissions
    if (mergedConfig.checkPermission && entity) {
      if (!mergedConfig.checkPermission(user.id, entity)) {
        throw createError({
          statusCode: 403,
          statusMessage: `Vous n'avez pas la permission de modifier ce/cette ${mergedConfig.entityName}`
        })
      }
    }

    // Upload de l'image (à implémenter avec la logique réelle)
    // const imageUrl = await handleImageUpload(event, {
    //   maxSize: mergedConfig.maxFileSize!,
    //   allowedTypes: mergedConfig.allowedFormats!,
    //   folder: mergedConfig.entityName.toLowerCase().replace(/\s+/g, '-')
    // })
    const imageUrl = 'placeholder-url' // À remplacer par la logique réelle

    // Callback de succès si fourni
    if (mergedConfig.onSuccess && entity) {
      await mergedConfig.onSuccess(entity, imageUrl)
    }

    return {
      success: true,
      imageUrl,
      message: `Image de ${mergedConfig.entityName} uploadée avec succès`
    }

  } catch (error: any) {
    console.error(`Erreur lors de l'upload de l'image de ${mergedConfig.entityName}:`, error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `Erreur lors de l'upload de l'image de ${mergedConfig.entityName}`
    })
  }
}