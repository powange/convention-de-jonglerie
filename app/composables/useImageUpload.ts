import type { UploadEndpoint, UploadOptions, UploadResult, ValidationOptions } from '~/types/upload'

/**
 * Composable pour la gestion des uploads d'images
 * Centralise la logique d'upload, validation et gestion d'états
 */
export const useImageUpload = (options: UploadOptions = {}) => {
  const authStore = useAuthStore()
  const toast = useToast()
  const { t } = useI18n()

  // États réactifs
  const uploading = ref(false)
  const progress = ref(0)
  const selectedFile = ref<File | null>(null)
  const previewUrl = ref<string | null>(null)
  const error = ref<string | null>(null)

  // Options par défaut
  const defaultValidation: ValidationOptions = {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp']
  }

  const validation = { ...defaultValidation, ...options.validation }

  /**
   * Valide un fichier selon les critères définis
   */
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Vérification de la taille
    if (file.size > validation.maxSize) {
      const maxSizeMB = Math.round(validation.maxSize / (1024 * 1024))
      return {
        valid: false,
        error: t('upload.errors.file_too_large', { maxSize: `${maxSizeMB}MB` })
      }
    }

    // Vérification du type MIME
    if (!validation.allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: t('upload.errors.invalid_file_type', { 
          allowedTypes: validation.allowedTypes.join(', ') 
        })
      }
    }

    // Vérification de l'extension
    const extension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (extension && !validation.allowedExtensions.includes(extension)) {
      return {
        valid: false,
        error: t('upload.errors.invalid_file_extension', { 
          allowedExtensions: validation.allowedExtensions.join(', ') 
        })
      }
    }

    return { valid: true }
  }

  /**
   * Génère une URL de prévisualisation pour le fichier
   */
  const generatePreview = (file: File) => {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
    }
    previewUrl.value = URL.createObjectURL(file)
  }

  /**
   * Sélectionne un fichier avec validation
   */
  const selectFile = (file: File): boolean => {
    error.value = null

    const validation = validateFile(file)
    if (!validation.valid) {
      error.value = validation.error || t('upload.errors.validation_failed')
      if (options.showToast !== false) {
        toast.add({
          title: t('upload.validation_error'),
          description: error.value,
          color: 'red'
        })
      }
      return false
    }

    selectedFile.value = file
    generatePreview(file)
    return true
  }

  /**
   * Gère l'événement de sélection de fichier depuis un input
   */
  const handleFileSelect = (event: Event) => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    
    if (file) {
      selectFile(file)
    }
  }

  /**
   * Upload un fichier vers l'API spécifiée
   */
  const uploadFile = async (
    endpoint: UploadEndpoint,
    additionalData?: Record<string, string | number>
  ): Promise<UploadResult> => {
    if (!selectedFile.value) {
      throw new Error(t('upload.errors.no_file_selected'))
    }

    if (!authStore.token) {
      throw new Error(t('upload.errors.no_auth_token'))
    }

    uploading.value = true
    progress.value = 0
    error.value = null

    try {
      const formData = new FormData()
      formData.append('image', selectedFile.value)

      // Ajouter des données supplémentaires si fournies
      if (additionalData) {
        Object.entries(additionalData).forEach(([key, value]) => {
          formData.append(key, value.toString())
        })
      }

      // Construire l'URL de l'endpoint
      let uploadUrl: string
      switch (endpoint.type) {
        case 'convention':
          uploadUrl = endpoint.id 
            ? `/api/conventions/${endpoint.id}/upload-image`
            : '/api/upload/image'
          if (endpoint.id && additionalData) {
            additionalData.conventionId = endpoint.id
          }
          break
        
        case 'edition':
          uploadUrl = endpoint.id
            ? `/api/editions/${endpoint.id}/upload-image`
            : '/api/upload/image'
          if (endpoint.id && additionalData) {
            additionalData.editionId = endpoint.id
          }
          break
        
        case 'lost-found':
          if (!endpoint.id) {
            throw new Error(t('upload.errors.edition_id_required'))
          }
          uploadUrl = `/api/editions/${endpoint.id}/lost-found/upload-image`
          break
        
        case 'profile':
          uploadUrl = '/api/profile/upload-picture'
          break
        
        case 'generic':
        default:
          uploadUrl = '/api/upload/image'
          break
      }

      const response = await $fetch<UploadResult>(uploadUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            progress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          }
        }
      })

      if (options.showToast !== false) {
        toast.add({
          title: t('upload.success'),
          description: t('upload.image_uploaded_successfully'),
          color: 'green'
        })
      }

      // Réinitialiser après succès si demandé
      if (options.resetAfterUpload !== false) {
        reset()
      }

      return response

    } catch (uploadError: any) {
      const errorMessage = uploadError?.data?.message || 
                          uploadError?.message || 
                          t('upload.errors.upload_failed')
      
      error.value = errorMessage

      if (options.showToast !== false) {
        toast.add({
          title: t('upload.upload_error'),
          description: errorMessage,
          color: 'red'
        })
      }

      throw uploadError
    } finally {
      uploading.value = false
      progress.value = 0
    }
  }

  /**
   * Réinitialise l'état du composable
   */
  const reset = () => {
    selectedFile.value = null
    error.value = null
    progress.value = 0
    
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
      previewUrl.value = null
    }
  }

  /**
   * Supprime une image
   */
  const deleteImage = async (endpoint: UploadEndpoint): Promise<void> => {
    if (!authStore.token) {
      throw new Error(t('upload.errors.no_auth_token'))
    }

    try {
      let deleteUrl: string
      switch (endpoint.type) {
        case 'convention':
          if (!endpoint.id) throw new Error(t('upload.errors.convention_id_required'))
          deleteUrl = `/api/conventions/${endpoint.id}/delete-image`
          break
        
        case 'edition':
          if (!endpoint.id) throw new Error(t('upload.errors.edition_id_required'))
          deleteUrl = `/api/editions/${endpoint.id}/delete-image`
          break
        
        case 'profile':
          deleteUrl = '/api/profile/delete-picture'
          break
        
        default:
          throw new Error(t('upload.errors.unsupported_delete_endpoint'))
      }

      await $fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      })

      if (options.showToast !== false) {
        toast.add({
          title: t('upload.success'),
          description: t('upload.image_deleted_successfully'),
          color: 'green'
        })
      }

    } catch (deleteError: any) {
      const errorMessage = deleteError?.data?.message || 
                          deleteError?.message || 
                          t('upload.errors.delete_failed')

      if (options.showToast !== false) {
        toast.add({
          title: t('upload.delete_error'),
          description: errorMessage,
          color: 'red'
        })
      }

      throw deleteError
    }
  }

  // Nettoyage automatique de l'URL de prévisualisation
  onUnmounted(() => {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
    }
  })

  return {
    // États
    uploading: readonly(uploading),
    progress: readonly(progress),
    selectedFile: readonly(selectedFile),
    previewUrl: readonly(previewUrl),
    error: readonly(error),
    
    // Méthodes
    selectFile,
    handleFileSelect,
    uploadFile,
    deleteImage,
    reset,
    validateFile,
    
    // Configuration
    validation: readonly(validation)
  }
}