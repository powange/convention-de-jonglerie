import type { ServerFile } from 'nuxt-file-storage'

/**
 * Types MIME autorisés pour les images uploadées par les utilisateurs.
 * Aligné sur ALLOWED_IMAGE_TYPES de file-helpers.ts (téléchargement depuis URL).
 */
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const

/**
 * Taille maximale par défaut pour un upload d'image (10 MB).
 */
export const DEFAULT_MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

interface ValidateUploadOptions {
  /** Liste blanche des MIME types acceptés (défaut : images) */
  allowedMimeTypes?: readonly string[]
  /** Liste blanche des extensions acceptées sans le point (défaut : images) */
  allowedExtensions?: readonly string[]
  /** Taille maximale en octets (défaut : 10 MB) */
  maxSizeBytes?: number
}

/**
 * Valide un fichier uploadé via nuxt-file-storage (format ServerFile).
 *
 * Vérifie que le type MIME et l'extension sont dans les listes blanches,
 * et que la taille est inférieure à la limite. Ces vérifications sont basées
 * sur les métadonnées fournies par le client : un attaquant peut les forger.
 * Pour une vraie validation, contrôler aussi les magic bytes du `content`.
 *
 * @throws Error si le fichier ne respecte pas les contraintes
 */
export function validateUploadedFile(file: ServerFile, options: ValidateUploadOptions = {}): void {
  const {
    allowedMimeTypes = ALLOWED_IMAGE_MIME_TYPES,
    allowedExtensions = ALLOWED_IMAGE_EXTENSIONS,
    maxSizeBytes = DEFAULT_MAX_IMAGE_SIZE_BYTES,
  } = options

  if (!file || typeof file !== 'object') {
    throw createError({ status: 400, message: 'Fichier invalide' })
  }

  if (!file.name || typeof file.name !== 'string') {
    throw createError({ status: 400, message: 'Nom de fichier manquant' })
  }

  if (!file.content) {
    throw createError({ status: 400, message: 'Contenu de fichier manquant' })
  }

  // Validation MIME type
  if (!file.type || !allowedMimeTypes.includes(file.type)) {
    throw createError({
      status: 400,
      message: `Type de fichier non autorisé : ${file.type || 'inconnu'}. Types autorisés : ${allowedMimeTypes.join(', ')}`,
    })
  }

  // Validation extension (anti-spoofing supplémentaire)
  const lowerName = file.name.toLowerCase()
  const ext = lowerName.includes('.') ? lowerName.split('.').pop() : ''
  if (!ext || !allowedExtensions.includes(ext as (typeof allowedExtensions)[number])) {
    throw createError({
      status: 400,
      message: `Extension de fichier non autorisée : .${ext || 'aucune'}. Extensions autorisées : ${allowedExtensions.map((e) => '.' + e).join(', ')}`,
    })
  }

  // Validation taille (file.size est une string sérialisée par nuxt-file-storage)
  const size = Number(file.size) || 0
  if (size > maxSizeBytes) {
    throw createError({
      status: 400,
      message: `Fichier trop volumineux : ${(size / 1024 / 1024).toFixed(2)} MB (max : ${(maxSizeBytes / 1024 / 1024).toFixed(2)} MB)`,
    })
  }
}
