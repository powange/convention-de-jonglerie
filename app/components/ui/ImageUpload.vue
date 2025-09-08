<template>
  <div class="space-y-4">
    <!-- Zone d'upload -->
    <div class="flex flex-col space-y-3">
      <!-- Preview actuelle ou placeholder -->
      <div v-if="modelValue || previewUrl" class="relative">
        <img
          :src="previewUrl || modelValue"
          :alt="alt"
          class="w-full h-32 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-700"
        />
        <div class="absolute top-2 right-2 flex space-x-2">
          <!-- Bouton de suppression -->
          <UButton
            v-if="!uploading && (previewUrl || (modelValue && allowDelete))"
            icon="i-heroicons-trash"
            color="error"
            variant="solid"
            size="xs"
            @click="handleDelete"
          />
        </div>
        <!-- Overlay de progression -->
        <div
          v-if="uploading"
          class="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center"
        >
          <div class="text-center text-white">
            <UIcon name="i-heroicons-arrow-path" class="animate-spin text-2xl mb-2" />
            <div class="text-sm">{{ t('upload.uploading') }}</div>
            <div v-if="progress > 0" class="text-xs mt-1">{{ progress }}%</div>
          </div>
        </div>
      </div>

      <!-- Zone de drop ou bouton si pas d'image -->
      <div
        v-else
        class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
        :class="{ 'border-blue-400 bg-blue-50 dark:bg-blue-900/20': isDragOver }"
        @click="triggerFileInput"
        @dragover.prevent="onDragOver"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
      >
        <UIcon name="i-heroicons-photo" class="text-4xl text-gray-400 dark:text-gray-500 mb-3" />
        <p class="text-gray-600 dark:text-gray-400 mb-2">
          {{ placeholder || t('components.convention_form.click_to_select_image') }}
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ t('upload.formats_accepted') }}: {{ validation.allowedExtensions.join(', ') }}
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ t('upload.max_size') }}: {{ formatFileSize(validation.maxSize) }}
        </p>
      </div>

      <!-- Input file caché -->
      <input
        ref="fileInput"
        type="file"
        :accept="validation.allowedTypes.join(',')"
        class="hidden"
        @change="handleFileSelect"
      />

      <!-- Boutons d'action -->
      <div v-if="!uploading" class="flex justify-center space-x-2">
        <UButton variant="outline" icon="i-heroicons-photo" @click="triggerFileInput">
          {{ t('upload.select_file') }}
        </UButton>

        <UButton
          v-if="selectedFile && !autoUpload"
          color="primary"
          icon="i-heroicons-arrow-up-tray"
          @click="upload"
        >
          {{ t('upload.upload') }}
        </UButton>
      </div>
    </div>

    <!-- Messages d'erreur -->
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="t('upload.upload_error')"
      :description="error"
      :close-button="{
        icon: 'i-heroicons-x-mark-20-solid',
        color: 'neutral',
        variant: 'link',
        padded: false,
      }"
      @close="error = null"
    />

    <!-- Informations sur le fichier sélectionné -->
    <div v-if="selectedFile && !uploading" class="text-sm text-gray-600 dark:text-gray-400">
      <div class="flex items-center space-x-2">
        <UIcon name="i-heroicons-document" />
        <span>{{ selectedFile.name }}</span>
        <span class="text-xs">({{ formatFileSize(selectedFile.size) }})</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { UploadEndpoint, UploadOptions } from '~/types/upload'

interface Props {
  /** Valeur actuelle (URL de l'image) */
  modelValue?: string | null
  /** Endpoint pour l'upload */
  endpoint: UploadEndpoint
  /** Options d'upload personnalisées */
  options?: UploadOptions
  /** Texte alternatif pour l'image */
  alt?: string
  /** Placeholder pour la zone d'upload */
  placeholder?: string
  /** Upload automatique dès sélection */
  autoUpload?: boolean
  /** Autoriser la suppression de l'image actuelle */
  allowDelete?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string | null): void
  (e: 'uploaded', result: { success: boolean; imageUrl?: string }): void
  (e: 'deleted'): void
  (e: 'error', error: string): void
}

const props = withDefaults(defineProps<Props>(), {
  alt: 'Uploaded image',
  autoUpload: true,
  allowDelete: true,
})

const emit = defineEmits<Emits>()

// Composables
const { t } = useI18n()

// États locaux simplifiés - sans dépendance à useFileStorage qui ne fonctionne pas
const uploading = ref(false)
const progress = ref(0)
const selectedFile = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const error = ref<string | null>(null)
const serverFiles = ref<any[]>([])

// Validation par défaut
const validation = {
  maxSize: props.options?.validation?.maxSize || 5 * 1024 * 1024,
  allowedTypes: props.options?.validation?.allowedTypes || [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ],
  allowedExtensions: props.options?.validation?.allowedExtensions || [
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
  ],
}

// États réactifs
const fileInput = ref<HTMLInputElement>()
const isDragOver = ref(false)

// Méthodes utilitaires
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

// Validation des fichiers
const validateFile = (file: File): { valid: boolean; error?: string } => {
  if (file.size > validation.maxSize) {
    const maxSizeMB = Math.round(validation.maxSize / (1024 * 1024))
    return {
      valid: false,
      error: t('upload.errors.file_too_large', { maxSize: `${maxSizeMB}MB` }),
    }
  }

  if (!validation.allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: t('upload.errors.invalid_file_type', {
        allowedTypes: validation.allowedTypes.join(', '),
      }),
    }
  }

  const extension = '.' + file.name.split('.').pop()?.toLowerCase()
  if (extension && !validation.allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: t('upload.errors.invalid_file_extension', {
        allowedExtensions: validation.allowedExtensions.join(', '),
      }),
    }
  }

  return { valid: true }
}

// Générer un aperçu
const generatePreview = (file: File) => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  previewUrl.value = URL.createObjectURL(file)
}

// Sélectionner et valider un fichier
const selectFile = (file: File): boolean => {
  error.value = null

  const validationResult = validateFile(file)
  if (!validationResult.valid) {
    error.value = validationResult.error || 'Fichier invalide'
    return false
  }

  selectedFile.value = file
  generatePreview(file)

  // Créer manuellement le ServerFile avec data URL
  const reader = new FileReader()
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string

    const serverFile = {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
      content: dataUrl, // C'est la clé pour nuxt-file-storage
    }

    serverFiles.value = [serverFile]
    console.log('Created ServerFile manually:', !!serverFile.content)
  }
  reader.readAsDataURL(file)

  return true
}

// Gestionnaires d'événements
const handleFileSelect = (event: Event) => {
  // Ne plus utiliser handleFileInput qui ne fonctionne pas
  // Gérer le fichier manuellement

  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (file) {
    console.log('File selected:', file.name)

    if (selectFile(file) && props.autoUpload) {
      // Attendre que le FileReader finisse avant d'uploader
      setTimeout(() => {
        upload()
      }, 100)
    }
  }
}

const onDragOver = (event: DragEvent) => {
  isDragOver.value = true
  event.dataTransfer!.dropEffect = 'copy'
}

const onDragLeave = () => {
  isDragOver.value = false
}

const onDrop = (event: DragEvent) => {
  isDragOver.value = false
  const droppedFiles = event.dataTransfer?.files

  if (droppedFiles && droppedFiles.length > 0) {
    const file = droppedFiles[0]

    console.log('File dropped:', file.name)

    if (selectFile(file) && props.autoUpload) {
      setTimeout(() => {
        upload()
      }, 100)
    }
  }
}

const upload = async () => {
  if (!serverFiles.value || serverFiles.value.length === 0) {
    error.value = 'Aucun fichier sélectionné'
    emit('error', error.value)
    return
  }

  uploading.value = true
  error.value = null

  try {
    console.log('Uploading files:', serverFiles.value)

    // Construire l'URL de l'API selon l'endpoint
    let apiUrl: string
    switch (props.endpoint.type) {
      case 'convention':
        apiUrl = '/api/files/convention'
        break
      case 'edition':
        apiUrl = '/api/files/edition'
        break
      case 'lost-found':
        apiUrl = '/api/files/lost-found'
        break
      case 'profile':
        apiUrl = '/api/files/profile'
        break
      default:
        apiUrl = '/api/files/generic'
        break
    }

    // Envoyer nos ServerFiles créés manuellement
    const response = await $fetch(apiUrl, {
      method: 'POST',
      body: {
        files: serverFiles.value,
        metadata: {
          endpoint: props.endpoint.type,
          entityId: props.endpoint.id,
        },
      },
    })

    emit('update:modelValue', response.imageUrl || null)
    emit('uploaded', response)
  } catch (uploadError: unknown) {
    console.error('Upload error:', uploadError)
    const message = uploadError instanceof Error ? uploadError.message : 'Upload failed'
    error.value = message
    emit('error', message)
  } finally {
    uploading.value = false
  }
}

// Fonction de reset
const reset = () => {
  selectedFile.value = null
  error.value = null
  serverFiles.value = []

  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }
}

const handleDelete = async () => {
  if (previewUrl.value) {
    // Suppression locale (fichier sélectionné mais pas encore uploadé)
    reset()
    return
  }

  if (props.modelValue && props.allowDelete) {
    // Pour la suppression d'images déjà uploadées, on peut implémenter plus tard
    emit('update:modelValue', null)
    emit('deleted')
  }
}

// Watchers
watch(error, (newError) => {
  if (newError) {
    emit('error', newError)
  }
})

// Nettoyage
onUnmounted(() => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
})
</script>
