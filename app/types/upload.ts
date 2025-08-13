export interface ValidationOptions {
  /** Taille maximale du fichier en bytes (défaut: 5MB) */
  maxSize: number
  /** Types MIME autorisés */
  allowedTypes: string[]
  /** Extensions de fichiers autorisées */
  allowedExtensions: string[]
}

export interface UploadOptions {
  /** Configuration de validation des fichiers */
  validation?: Partial<ValidationOptions>
  /** Afficher les notifications toast (défaut: true) */
  showToast?: boolean
  /** Réinitialiser l'état après upload réussi (défaut: true) */
  resetAfterUpload?: boolean
}

export interface UploadEndpoint {
  /** Type d'endpoint d'upload */
  type: 'convention' | 'edition' | 'lost-found' | 'profile' | 'generic'
  /** ID de l'entité (requis pour convention, edition, lost-found) */
  id?: number | string
}

export interface UploadResult {
  /** Indique si l'upload a réussi */
  success: boolean
  /** URL de l'image uploadée */
  imageUrl?: string
  /** Nom du fichier généré */
  filename?: string
  /** Message de retour */
  message?: string
  /** Objet retourné par certaines APIs (convention, edition, user) */
  convention?: any
  edition?: any
  user?: any
}

export interface FileValidationResult {
  /** Le fichier est-il valide */
  valid: boolean
  /** Message d'erreur si invalide */
  error?: string
}

export interface UploadProgress {
  /** Pourcentage de progression (0-100) */
  percentage: number
  /** Nombre d'octets chargés */
  loaded: number
  /** Taille totale du fichier */
  total: number
}