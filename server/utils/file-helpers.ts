import { readFile } from 'fs/promises'

/**
 * Timeout pour le téléchargement d'images depuis URL (en ms)
 */
const IMAGE_DOWNLOAD_TIMEOUT = 30000 // 30 secondes

/**
 * Taille maximale d'une image téléchargée (en bytes)
 */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10 MB

/**
 * Types MIME autorisés pour les images
 */
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/**
 * Résultat du téléchargement d'image depuis URL
 */
export interface DownloadImageResult {
  /**
   * Nom du fichier stocké (juste le nom, pas le chemin complet)
   */
  filename: string | null

  /**
   * Succès du téléchargement
   */
  success: boolean

  /**
   * Erreur éventuelle
   */
  error?: string
}

/**
 * Télécharge une image depuis une URL externe et la stocke localement
 *
 * @param imageUrl - URL de l'image à télécharger
 * @param resourceId - ID de la ressource (édition, convention, etc.)
 * @param resourceType - Type de ressource ('editions', 'conventions', etc.)
 * @param verbose - Activer les logs détaillés
 * @returns Résultat avec le nom du fichier stocké
 *
 * @example
 * const result = await downloadAndStoreImage(
 *   'https://example.com/poster.jpg',
 *   42,
 *   'editions'
 * )
 * if (result.success) {
 *   edition.imageUrl = result.filename
 * }
 */
export async function downloadAndStoreImage(
  imageUrl: string | null | undefined,
  resourceId: number,
  resourceType: string,
  verbose: boolean = false
): Promise<DownloadImageResult> {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return {
      filename: null,
      success: false,
      error: 'URL non fournie',
    }
  }

  // Vérifier que c'est une URL externe (pas déjà un fichier local)
  if (imageUrl.startsWith('/uploads/') || !imageUrl.startsWith('http')) {
    // C'est déjà un fichier local, retourner le nom de fichier
    const existingFilename = imageUrl.split('/').pop() || null
    return {
      filename: existingFilename,
      success: true,
    }
  }

  try {
    if (verbose) {
      console.log('=== TÉLÉCHARGEMENT IMAGE DEPUIS URL ===')
      console.log('URL:', imageUrl)
    }

    // Télécharger l'image avec timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_DOWNLOAD_TIMEOUT)

    let response: Response
    try {
      response = await fetch(imageUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/*',
        },
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    // Vérifier le type MIME
    const contentType = response.headers.get('content-type')?.split(';')[0] || ''
    if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
      throw new Error(`Type de fichier non autorisé: ${contentType}`)
    }

    // Vérifier la taille
    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE) {
      throw new Error(
        `Image trop volumineuse: ${Math.round(parseInt(contentLength) / 1024 / 1024)}MB (max: 10MB)`
      )
    }

    // Lire le contenu
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length > MAX_IMAGE_SIZE) {
      throw new Error(
        `Image trop volumineuse: ${Math.round(buffer.length / 1024 / 1024)}MB (max: 10MB)`
      )
    }

    if (verbose) {
      console.log(`Image téléchargée: ${buffer.length} bytes, type: ${contentType}`)
    }

    // Déterminer l'extension du fichier
    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    }
    const extension = extensionMap[contentType] || 'jpg'

    // Générer un nom de fichier basé sur l'URL ou un nom générique
    const urlParts = new URL(imageUrl).pathname.split('/')
    let baseName = urlParts.pop()?.split('.')[0] || 'image'
    // Nettoyer le nom de fichier
    baseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50)
    const filename = `${baseName}.${extension}`

    // Convertir en base64 data URL
    const base64 = buffer.toString('base64')
    const dataUrl = `data:${contentType};base64,${base64}`

    // Créer l'objet ServerFile pour nuxt-file-storage
    const serverFile = {
      name: filename,
      content: dataUrl,
      size: dataUrl.length.toString(),
      type: contentType,
      lastModified: Date.now().toString(),
    }

    // Stocker directement dans le dossier final (pas temporaire)
    const finalPath = `${resourceType}/${resourceId}`
    const storedFilename = await storeFileLocally(serverFile, 8, finalPath)

    if (verbose) {
      console.log(`Image stockée: ${storedFilename} dans ${finalPath}`)
      console.log('=== FIN TÉLÉCHARGEMENT ===')
    }

    return {
      filename: storedFilename,
      success: true,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`Erreur lors du téléchargement de l'image depuis ${imageUrl}:`, errorMessage)

    return {
      filename: null,
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Options pour le déplacement de fichiers temporaires
 */
export interface MoveFileOptions {
  /**
   * ID de la ressource (convention, édition, utilisateur, etc.)
   */
  resourceId: number

  /**
   * Type de ressource ('conventions', 'users', 'editions', etc.)
   */
  resourceType: string

  /**
   * Chemin personnalisé du dossier temporaire (par défaut: temp/{resourceType}/{resourceId})
   */
  customTempPath?: string

  /**
   * Chemin personnalisé du dossier final (par défaut: {resourceType}/{resourceId})
   */
  customFinalPath?: string

  /**
   * Longueur du suffixe aléatoire pour le nom de fichier (par défaut: 8)
   */
  randomSuffixLength?: number

  /**
   * Activer les logs détaillés (par défaut: false)
   */
  verbose?: boolean
}

/**
 * Résultat du déplacement de fichier
 */
export interface MoveFileResult {
  /**
   * Nom du fichier final (juste le nom, pas le chemin complet)
   */
  filename: string | null

  /**
   * Succès du déplacement
   */
  success: boolean

  /**
   * Erreur éventuelle
   */
  error?: Error
}

/**
 * Déplace un fichier temporaire vers son emplacement final
 *
 * Gère automatiquement :
 * - Extraction du nom de fichier depuis l'URL temporaire
 * - Lecture du fichier temporaire
 * - Conversion en data URL
 * - Stockage dans le dossier final
 * - Suppression du fichier temporaire
 *
 * @param tempUrl - URL du fichier temporaire (ex: "/uploads/temp/conventions/6/abc123.png")
 * @param options - Options de déplacement
 * @returns Résultat du déplacement avec le nom du fichier final
 *
 * @example
 * const result = await moveTemporaryFile(validatedData.logo, {
 *   resourceId: conventionId,
 *   resourceType: 'conventions'
 * })
 * if (result.success) {
 *   finalLogoFilename = result.filename
 * }
 */
export async function moveTemporaryFile(
  tempUrl: string | null | undefined,
  options: MoveFileOptions
): Promise<MoveFileResult> {
  const {
    resourceId,
    resourceType,
    customTempPath,
    customFinalPath,
    randomSuffixLength = 8,
    verbose = false,
  } = options

  // Vérifier que le fichier est bien temporaire
  if (!tempUrl || typeof tempUrl !== 'string' || !tempUrl.includes('/temp/')) {
    return {
      filename: tempUrl || null,
      success: false,
      error: new Error('URL ne pointe pas vers un fichier temporaire'),
    }
  }

  try {
    if (verbose) {
      console.log('=== DÉPLACEMENT FICHIER TEMPORAIRE ===')
      console.log('URL temporaire:', tempUrl)
    }

    // Extraire le nom du fichier
    const tempFilename = tempUrl.split('/').pop()
    if (!tempFilename) {
      throw new Error('Nom de fichier temporaire non défini')
    }

    // Construire les chemins
    const tempPath = customTempPath || `temp/${resourceType}/${resourceId}/${tempFilename}`
    const finalPath = customFinalPath || `${resourceType}/${resourceId}`

    if (verbose) {
      console.log(`Nom de fichier: ${tempFilename}`)
      console.log(`Chemin temporaire: ${tempPath}`)
      console.log(`Chemin final: ${finalPath}`)
    }

    // Récupérer le path local via nuxt-file-storage
    const tempFilePath = getFileLocally(tempPath)

    if (!tempFilePath) {
      throw new Error(`Fichier temporaire introuvable: ${tempPath}`)
    }

    if (verbose) {
      console.log('Path local:', tempFilePath)
    }

    // Lire le contenu du fichier
    const fileBuffer = await readFile(tempFilePath)

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error(`Impossible de lire le fichier: ${tempFilePath}`)
    }

    if (verbose) {
      console.log(`Fichier lu: ${fileBuffer.length} bytes`)
    }

    // Convertir en data URL
    const base64 = fileBuffer.toString('base64')
    const dataUrl = `data:image/png;base64,${base64}`

    // Créer un objet ServerFile pour nuxt-file-storage
    const serverFile = {
      name: tempFilename,
      content: dataUrl,
      size: dataUrl.length.toString(),
      type: 'image/png',
      lastModified: Date.now().toString(),
    }

    if (verbose) {
      console.log('Stockage dans le dossier final...')
    }

    // Stocker dans le dossier final
    const newFilename = await storeFileLocally(serverFile, randomSuffixLength, finalPath)

    // Supprimer le fichier temporaire
    try {
      await deleteFile(tempPath)
      if (verbose) {
        console.log('Fichier temporaire supprimé')
      }
    } catch (deleteError) {
      console.warn('Impossible de supprimer le fichier temporaire:', deleteError)
    }

    if (verbose) {
      console.log(`Fichier déplacé avec succès: ${newFilename}`)
      console.log('=== FIN DÉPLACEMENT ===')
    }

    return {
      filename: newFilename,
      success: true,
    }
  } catch (error) {
    console.error('Erreur lors du déplacement du fichier:', error)

    // Extraire juste le nom de fichier comme fallback
    const fallbackFilename = tempUrl.split('/').pop() || null

    return {
      filename: fallbackFilename,
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}

/**
 * Supprime un ancien fichier uploadé
 *
 * @param oldFileUrl - URL ou nom de fichier de l'ancien fichier
 * @param resourceId - ID de la ressource
 * @param resourceType - Type de ressource
 * @param verbose - Activer les logs
 *
 * @example
 * await deleteOldFile(existingConvention.logo, conventionId, 'conventions')
 */
export async function deleteOldFile(
  oldFileUrl: string | null | undefined,
  resourceId: number,
  resourceType: string,
  verbose: boolean = false
): Promise<void> {
  if (!oldFileUrl) return

  try {
    // Si c'est une URL complète, extraire le chemin relatif
    const filePath = oldFileUrl.includes('/')
      ? oldFileUrl.replace('/uploads/', '')
      : `${resourceType}/${resourceId}/${oldFileUrl}`

    await deleteFile(filePath)

    if (verbose) {
      console.log(`Ancien fichier supprimé: ${filePath}`)
    }
  } catch (error) {
    console.warn(`Impossible de supprimer l'ancien fichier: ${oldFileUrl}`, error)
  }
}

/**
 * Gère le cycle complet de gestion d'un fichier uploadé :
 * - Déplace le nouveau fichier temporaire si présent
 * - Supprime l'ancien fichier si un nouveau est fourni ou si explicitement supprimé
 *
 * @param newFileUrl - URL du nouveau fichier (peut être null pour supprimer)
 * @param oldFileUrl - URL de l'ancien fichier à supprimer
 * @param options - Options de déplacement
 * @returns Le nom du fichier final ou null
 *
 * @example
 * const finalLogo = await handleFileUpload(
 *   validatedData.logo,
 *   existingConvention.logo,
 *   { resourceId: conventionId, resourceType: 'conventions' }
 * )
 */
export async function handleFileUpload(
  newFileUrl: string | null | undefined,
  oldFileUrl: string | null | undefined,
  options: MoveFileOptions
): Promise<string | null> {
  // Cas 1: Nouveau fichier temporaire à déplacer
  if (newFileUrl && typeof newFileUrl === 'string' && newFileUrl.includes('/temp/')) {
    const result = await moveTemporaryFile(newFileUrl, options)

    // Supprimer l'ancien fichier si le déplacement a réussi
    if (result.success && oldFileUrl) {
      await deleteOldFile(oldFileUrl, options.resourceId, options.resourceType, options.verbose)
    }

    return result.filename
  }

  // Cas 2: Suppression explicite (null)
  if (newFileUrl === null && oldFileUrl) {
    await deleteOldFile(oldFileUrl, options.resourceId, options.resourceType, options.verbose)
    return null
  }

  // Cas 3: Fichier existant non modifié
  if (newFileUrl && !newFileUrl.includes('/temp/')) {
    // Extraire juste le nom de fichier si c'est une URL complète
    return newFileUrl.split('/').pop() || newFileUrl
  }

  // Cas 4: Pas de changement
  return oldFileUrl || null
}
