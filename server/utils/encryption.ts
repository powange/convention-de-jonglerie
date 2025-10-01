import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const KEY_LENGTH = 32

/**
 * Récupère la clé de chiffrement depuis les variables d'environnement
 * ou génère une erreur si elle n'existe pas
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET
  if (!secret) {
    throw new Error('ENCRYPTION_SECRET must be defined in environment variables')
  }

  // Dériver une clé de 32 bytes à partir du secret
  const salt = Buffer.from(process.env.ENCRYPTION_SALT || 'default-salt-change-me')
  return scryptSync(secret, salt, KEY_LENGTH)
}

/**
 * Chiffre une chaîne de caractères
 * @param text - Texte à chiffrer
 * @returns Texte chiffré au format: salt:iv:encrypted:authTag (base64)
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const authTag = cipher.getAuthTag()

  // Retourner: iv:encrypted:authTag (tous en base64)
  return `${iv.toString('base64')}:${encrypted}:${authTag.toString('base64')}`
}

/**
 * Déchiffre une chaîne de caractères
 * @param encryptedText - Texte chiffré au format: iv:encrypted:authTag (base64)
 * @returns Texte déchiffré
 */
export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey()
  const parts = encryptedText.split(':')

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format')
  }

  const iv = Buffer.from(parts[0], 'base64')
  const encrypted = parts[1]
  const authTag = Buffer.from(parts[2], 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
