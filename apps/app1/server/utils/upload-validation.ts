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
 * Ce qu'un justificatif peut être : une photo, **ou un PDF**.
 *
 * Beaucoup de factures n'existent qu'en PDF, et l'organisateur n'avait d'autre choix que d'en faire
 * une capture d'écran — en y perdant la lisibilité et la valeur de la pièce.
 *
 * Deux listes séparées et non une seule : le validateur croise le type MIME et l'extension, et
 * c'est ce croisement qui sert d'anti-usurpation.
 */
export const ALLOWED_RECEIPT_MIME_TYPES = [...ALLOWED_IMAGE_MIME_TYPES, 'application/pdf'] as const

export const ALLOWED_RECEIPT_EXTENSIONS = [...ALLOWED_IMAGE_EXTENSIONS, 'pdf'] as const

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
 * Les octets de signature de chaque format accepté, et le type MIME qu'ils prouvent.
 *
 * ## ⚠️ POURQUOI (constat A2)
 *
 * La validation ne comparait que le type MIME **déclaré par le navigateur** et l'extension du nom
 * — deux valeurs que le client choisit. Un fichier arbitraire renommé `.png` était accepté, stocké,
 * puis servi avec `Content-Type: image/png` par la route `/uploads/**`. La CSP et le `nosniff` de
 * nuxt-security limitent l'exploitation, mais le stockage acceptait n'importe quoi de moins de
 * 10 Mo, et une image corrompue ne se découvrait qu'à l'affichage.
 *
 * Le commentaire de cette fonction l'écrivait noir sur blanc : « Pour une vraie validation,
 * contrôler aussi les magic bytes ». Un constat documenté dans le code n'est pas un constat traité.
 *
 * ⚠️ WEBP A SA SIGNATURE EN DEUX MORCEAUX : `RIFF` aux octets 0-3, `WEBP` aux octets 8-11. Les
 * quatre premiers octets seuls désignent n'importe quel conteneur RIFF — un fichier audio WAV les
 * porte aussi.
 *
 * ⚠️ LE PDF EST DANS LA LISTE, et il devait y être : un justificatif de trésorerie peut en être un
 * (`ALLOWED_RECEIPT_MIME_TYPES`). L'oublier aurait fait refuser toutes les factures.
 */
const SIGNATURES: { mime: string; octets: (number | null)[] }[] = [
  { mime: 'image/jpeg', octets: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', octets: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/gif', octets: [0x47, 0x49, 0x46, 0x38] },
  {
    mime: 'image/webp',
    // `null` : octet non contraint (la taille du conteneur RIFF, qui varie).
    octets: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
  },
  { mime: 'application/pdf', octets: [0x25, 0x50, 0x44, 0x46] },
]

/** Assez d'octets pour la plus longue signature (WebP, douze). */
const OCTETS_LUS = 16

/**
 * Le type RÉEL d'un contenu, d'après ses premiers octets — ou `null` si aucune signature connue.
 *
 * Le contenu arrive en data-URL (`data:image/png;base64,…`) ; le préfixe est retiré s'il est là, et
 * seuls les premiers octets sont décodés : décoder treize mégaoctets de base64 pour en lire douze
 * serait absurde, et c'est précisément le chemin d'un fichier refusé.
 */
export function typeReelDuContenu(content: string): string | null {
  const base64 = content.includes(',') ? content.slice(content.indexOf(',') + 1) : content
  // Le décodage base64 travaille par groupes de quatre caractères.
  const debut = Buffer.from(base64.slice(0, Math.ceil(OCTETS_LUS / 3) * 4), 'base64')

  for (const { mime, octets } of SIGNATURES) {
    if (debut.length < octets.length) continue
    if (octets.every((attendu, rang) => attendu === null || debut[rang] === attendu)) return mime
  }
  return null
}

/**
 * Valide un fichier uploadé via nuxt-file-storage (format ServerFile).
 *
 * Vérifie le type MIME déclaré, l'extension, la taille — **et les octets de signature du contenu**,
 * qui sont la seule de ces quatre valeurs que le client ne choisit pas.
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

  /*
   * Validation du CONTENU — la seule des quatre que le client ne choisit pas.
   *
   * Elle vient en dernier parce qu'elle est la plus coûteuse, et parce que les messages des trois
   * premières sont plus utiles à qui s'est simplement trompé de fichier.
   *
   * Le type réel doit non seulement être connu, mais CORRESPONDRE au type déclaré : un vrai PNG
   * annoncé `image/jpeg` serait servi avec le mauvais en-tête, et un vrai PDF annoncé `image/png`
   * passerait une liste blanche d'images.
   */
  const typeReel = typeReelDuContenu(String(file.content))
  if (!typeReel) {
    throw createError({
      status: 400,
      message: `Le contenu du fichier ne correspond à aucun format accepté : ${allowedMimeTypes.join(', ')}`,
    })
  }
  if (typeReel !== file.type) {
    throw createError({
      status: 400,
      message: `Le contenu du fichier est un ${typeReel}, pas un ${file.type}`,
    })
  }
  if (!allowedMimeTypes.includes(typeReel)) {
    throw createError({
      status: 400,
      message: `Type de fichier non autorisé : ${typeReel}. Types autorisés : ${allowedMimeTypes.join(', ')}`,
    })
  }
}
